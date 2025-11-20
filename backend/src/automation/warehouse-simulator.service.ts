import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

interface WarehouseLocation {
  id: string;
  aisle: string;
  bay: number;
  level: 'BOTTOM' | 'MID' | 'TOP';
  zone: string;
  occupied: boolean;
  sku: string | null;
  quantity: number;
  weight_lbs: number;
  height_inches: number;
  pick_frequency: number;
  last_pick: string | null;
  ergonomic_risk: number;
  temperature: number;
  last_scan: string;
}

interface AppliedMove {
  from: string;
  to: string;
  sku: string | null;
  status: 'COMPLETED' | 'SKIPPED';
  timestamp: string;
}

@Injectable()
export class WarehouseSimulatorService implements OnModuleInit, OnModuleDestroy {
  private locations: WarehouseLocation[] = [];
  private scanning = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private plcConnected = false;
  private lastScanTime: string | null = null;
  private movements: AppliedMove[] = [];
  private readonly scanSeconds: number;

  constructor() {
    this.scanSeconds = Number(process.env.AUTOMATION_SCAN_INTERVAL || 30);
  }

  onModuleInit() {
    this.initializeWarehouse();
    if (process.env.PLC_ENABLED !== 'false') {
      this.enablePLCIntegration();
    }
    this.startAutomatedScanning(this.scanSeconds);
  }

  onModuleDestroy() {
    this.stopScanning();
  }

  private initializeWarehouse() {
    const aisles = ['A', 'B', 'C', 'D', 'E'];
    const zones = ['PICK', 'RESERVE', 'STAGING'];
    for (const aisle of aisles) {
      for (let bay = 1; bay <= 20; bay++) {
        for (const level of ['BOTTOM', 'MID', 'TOP'] as const) {
          const loc: WarehouseLocation = {
            id: `${aisle}${bay}-${level}`,
            aisle,
            bay,
            level,
            zone: zones[Math.floor(Math.random() * zones.length)],
            occupied: Math.random() > 0.3,
            sku: null,
            quantity: 0,
            weight_lbs: 0,
            height_inches: level === 'BOTTOM' ? 12 : level === 'MID' ? 42 : 72,
            pick_frequency: 0,
            last_pick: null,
            ergonomic_risk: 0,
            temperature: 68 + Math.random() * 10,
            last_scan: new Date().toISOString(),
          };
          if (loc.occupied) {
            loc.sku = `SKU-${Math.floor(Math.random() * 9000) + 1000}`;
            loc.quantity = Math.floor(Math.random() * 50) + 1;
            loc.weight_lbs = Math.floor(Math.random() * 80) + 5;
            loc.pick_frequency = Math.floor(Math.random() * 100);
            loc.ergonomic_risk = this.calculateErgonomicRisk(loc);
          }
          this.locations.push(loc);
        }
      }
    }
  }

  private calculateErgonomicRisk(loc: WarehouseLocation): number {
    let risk = 0;
    if (loc.height_inches < 24 || loc.height_inches > 70) risk += 40;
    if (loc.weight_lbs > 50) risk += 30;
    if (loc.pick_frequency > 50) risk += 20;
    if (loc.level === 'TOP') risk += 15;
    return Math.min(risk, 100);
  }

  private startAutomatedScanning(intervalSeconds: number) {
    if (this.scanning) return;
    this.scanning = true;
    this.scanInterval = setInterval(() => this.performScan(), intervalSeconds * 1000);
    this.performScan();
  }

  private performScan() {
    const scanTime = new Date().toISOString();
    for (const loc of this.locations) {
      if (Math.random() < 0.1 && loc.occupied) {
        loc.quantity -= Math.floor(Math.random() * 5) + 1;
        loc.last_pick = scanTime;
        loc.pick_frequency++;
        if (loc.quantity <= 0) {
          loc.occupied = false;
          loc.sku = null;
          loc.quantity = 0;
          loc.ergonomic_risk = 0;
        }
      }
      if (Math.random() < 0.05 && !loc.occupied) {
        loc.occupied = true;
        loc.sku = `SKU-${Math.floor(Math.random() * 9000) + 1000}`;
        loc.quantity = Math.floor(Math.random() * 50) + 10;
        loc.weight_lbs = Math.floor(Math.random() * 80) + 5;
        loc.pick_frequency = Math.floor(Math.random() * 100);
        loc.ergonomic_risk = this.calculateErgonomicRisk(loc);
      }
      loc.last_scan = scanTime;
      loc.temperature = 68 + Math.random() * 10;
      if (loc.occupied) {
        loc.ergonomic_risk = this.calculateErgonomicRisk(loc);
      }
    }
    this.lastScanTime = scanTime;
  }

  private stopScanning() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.scanning = false;
  }

  enablePLCIntegration() {
    this.plcConnected = true;
  }

  applyMoves(
    moves: { from_location: string; to_location: string; sku: string | null }[],
  ): AppliedMove[] {
    const applied: AppliedMove[] = [];
    for (const move of moves) {
      const fromLoc = this.locations.find((l) => l.id === move.from_location);
      const toLoc = this.locations.find((l) => l.id === move.to_location);
      if (fromLoc && toLoc && fromLoc.occupied && !toLoc.occupied) {
        toLoc.occupied = true;
        toLoc.sku = fromLoc.sku;
        toLoc.quantity = fromLoc.quantity;
        toLoc.weight_lbs = fromLoc.weight_lbs;
        toLoc.pick_frequency = fromLoc.pick_frequency;
        toLoc.ergonomic_risk = this.calculateErgonomicRisk(toLoc);
        fromLoc.occupied = false;
        fromLoc.sku = null;
        fromLoc.quantity = 0;
        fromLoc.ergonomic_risk = 0;
        applied.push({
          from: move.from_location,
          to: move.to_location,
          sku: move.sku,
          status: 'COMPLETED',
          timestamp: new Date().toISOString(),
        });
      }
    }
    this.movements.push(...applied);
    return applied;
  }

  getSummary() {
    const occupiedCount = this.locations.filter((l) => l.occupied).length;
    const highRisk = this.locations.filter((l) => l.ergonomic_risk > 70).length;
    const avgTemp =
      this.locations.reduce((sum, l) => sum + l.temperature, 0) / this.locations.length;
    const aisleMap: Record<string, { total: number; occupied: number }> = {};
    for (const loc of this.locations) {
      if (!aisleMap[loc.aisle]) aisleMap[loc.aisle] = { total: 0, occupied: 0 };
      aisleMap[loc.aisle].total++;
      if (loc.occupied) aisleMap[loc.aisle].occupied++;
    }
    return {
      totalLocations: this.locations.length,
      occupied: occupiedCount,
      empty: this.locations.length - occupiedCount,
      occupancyRate: occupiedCount / this.locations.length,
      highRiskLocations: highRisk,
      averageTemperature: avgTemp,
      lastScanAt: this.lastScanTime,
      scanningActive: this.scanning,
      plcConnected: this.plcConnected,
      totalMovements: this.movements.length,
      aisles: Object.entries(aisleMap).map(([aisle, stats]) => ({ aisle, ...stats })),
    };
  }

  getLocations() {
    return this.locations;
  }
}
