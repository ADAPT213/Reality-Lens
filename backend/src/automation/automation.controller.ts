import { Controller, Get, Post } from '@nestjs/common';
import { WarehouseSimulatorService } from './warehouse-simulator.service';

@Controller({ path: 'slotting', version: '1' })
export class AutomationSlottingController {
  constructor(private readonly simulator: WarehouseSimulatorService) {}

  @Get('heatmap')
  getHeatmap() {
    const bands: Record<string, string> = { BOTTOM: 'Low', MID: 'Golden', TOP: 'High-Risk' };
    const locations = this.simulator.getLocations();
    const tiles = locations.map((loc) => ({
      label: loc.id,
      reachBand: bands[loc.level],
      travelCost: (loc.aisle.charCodeAt(0) - 65) * 10 + loc.bay,
      congestion: loc.pick_frequency,
      ergonomicRisk: loc.ergonomic_risk,
      occupied: loc.occupied,
      sku: loc.sku,
      quantity: loc.quantity,
      weight: loc.weight_lbs,
      temperature: Math.round(loc.temperature),
      lastScan: loc.last_scan,
    }));
    const summary = this.simulator.getSummary();
    return {
      warehouseId: 'AUTO-SCAN',
      generatedAt: new Date().toISOString(),
      tiles,
      metrics: {
        totalZones: summary.totalLocations,
        occupancyRate: `${Math.round(summary.occupancyRate * 100)}%`,
        highRiskZoneUsage: `${summary.highRiskLocations} locations`,
        avgTemperature: `${Math.round(summary.averageTemperature)}°F`,
        lastScan: summary.lastScanAt,
      },
      automation: {
        scanning: summary.scanningActive,
        plcConnected: summary.plcConnected,
        totalMovements: summary.totalMovements,
      },
    };
  }

  @Get('move-plan')
  getMovePlan() {
    const locations = this.simulator.getLocations();
    const highRisk = locations
      .filter((l) => l.occupied && l.ergonomic_risk > 70)
      .sort((a, b) => b.ergonomic_risk - a.ergonomic_risk)
      .slice(0, 10);
    const moves = highRisk
      .map((loc) => {
        const target =
          locations.find((l) => !l.occupied && l.level === 'MID' && l.aisle !== loc.aisle) ||
          locations.find((l) => !l.occupied && l.level === 'MID');
        if (!target) return null;
        const reasons: string[] = [];
        if (loc.height_inches > 70) reasons.push('High-reach hazard');
        if (loc.height_inches < 24) reasons.push('Ground-level strain');
        if (loc.weight_lbs > 50) reasons.push(`Heavy item (${loc.weight_lbs}lbs)`);
        if (loc.pick_frequency > 50) reasons.push('High-frequency picks');
        return {
          sku: loc.sku,
          from_location: loc.id,
          to_location: target.id,
          reason: `${reasons.join(' + ')} → Golden Zone`,
          priority: loc.ergonomic_risk > 85 ? 'CRITICAL' : 'HIGH',
          ergonomicGain: Math.round(
            loc.ergonomic_risk -
              this.simulator['calculateErgonomicRisk']?.({ ...loc, height_inches: 42 } as any) || 0,
          ),
          timeGain: loc.pick_frequency > 50 ? Math.round(loc.pick_frequency * 0.3) : 10,
          currentRisk: loc.ergonomic_risk,
          weight: loc.weight_lbs,
          frequency: loc.pick_frequency,
        };
      })
      .filter((m) => m);
    return {
      warehouseId: 'AUTO-SCAN',
      generatedAt: new Date().toISOString(),
      totalMoves: moves.length,
      estimatedErgoImpact:
        moves.length > 0
          ? `+${Math.round(moves.reduce((sum, m) => sum + (m!.ergonomicGain || 0), 0) / moves.length)}% avg safety improvement`
          : 'No high-risk items',
      estimatedTimeImpact:
        moves.length > 0
          ? `+${Math.round(moves.reduce((sum, m) => sum + (m!.timeGain || 0), 0) / moves.length)}% efficiency gain`
          : 'Optimized',
      moves,
    };
  }

  @Post('auto-apply')
  autoApply() {
    if (!this.simulator['plcConnected']) {
      return { error: 'PLC integration not enabled' };
    }
    const locations = this.simulator.getLocations();
    const candidates = locations
      .filter((l) => l.occupied && l.ergonomic_risk > 70)
      .sort((a, b) => b.ergonomic_risk - a.ergonomic_risk)
      .slice(0, 5);
    const moves = candidates
      .map((loc) => {
        const target = locations.find((l) => !l.occupied && l.level === 'MID');
        return target ? { from_location: loc.id, to_location: target.id, sku: loc.sku } : null;
      })
      .filter((m) => m) as { from_location: string; to_location: string; sku: string | null }[];
    const applied = this.simulator.applyMoves(moves);
    return {
      success: true,
      movesRequested: moves.length,
      movesApplied: applied.length,
      moves: applied,
      timestamp: new Date().toISOString(),
    };
  }
}

@Controller({ path: 'automation', version: '1' })
export class AutomationStatusController {
  constructor(private readonly simulator: WarehouseSimulatorService) {}

  @Get('status')
  status() {
    const summary = this.simulator.getSummary();
    return {
      automation: {
        scanningActive: summary.scanningActive,
        plcConnected: summary.plcConnected,
        lastScan: summary.lastScanAt,
        totalMovements: summary.totalMovements,
      },
      warehouse: {
        totalLocations: summary.totalLocations,
        occupied: summary.occupied,
        occupancyRate: `${Math.round(summary.occupancyRate * 100)}%`,
        highRiskLocations: summary.highRiskLocations,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
