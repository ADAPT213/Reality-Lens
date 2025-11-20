// ============================================================================
// AUTOMATED WAREHOUSE SIMULATION ENGINE
// Mimics Dexatronix robot behavior with real-time scanning and PLC integration
// ============================================================================

class WarehouseSimulator {
  constructor() {
    this.locations = [];
    this.scanning = false;
    this.scanInterval = null;
    this.plcConnected = false;
    this.lastScanTime = null;
    this.movements = [];
  }

  initializeWarehouse() {
    console.log('🏭 Initializing warehouse simulation...');
    const aisles = ['A', 'B', 'C', 'D', 'E'];
    const zones = ['PICK', 'RESERVE', 'STAGING'];
    
    for (let aisle of aisles) {
      for (let bay = 1; bay <= 20; bay++) {
        for (let level of ['BOTTOM', 'MID', 'TOP']) {
          const location = {
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
            last_scan: new Date().toISOString()
          };
          
          if (location.occupied) {
            location.sku = `SKU-${Math.floor(Math.random() * 9000) + 1000}`;
            location.quantity = Math.floor(Math.random() * 50) + 1;
            location.weight_lbs = Math.floor(Math.random() * 80) + 5;
            location.pick_frequency = Math.floor(Math.random() * 100);
            location.ergonomic_risk = this.calculateErgonomicRisk(location);
          }
          
          this.locations.push(location);
        }
      }
    }
    
    console.log(`✅ Warehouse initialized: ${this.locations.length} locations`);
    return this.locations;
  }

  calculateErgonomicRisk(location) {
    let risk = 0;
    if (location.height_inches < 24 || location.height_inches > 72) risk += 40;
    if (location.weight_lbs > 50) risk += 30;
    if (location.pick_frequency > 50) risk += 20;
    if (location.level === 'TOP') risk += 15;
    return Math.min(risk, 100);
  }

  startAutomatedScanning(intervalSeconds = 30) {
    if (this.scanning) return;
    
    this.scanning = true;
    console.log(`🤖 Starting automated warehouse scanning (every ${intervalSeconds}s)`);
    
    this.scanInterval = setInterval(() => {
      this.performScan();
    }, intervalSeconds * 1000);
    
    // Perform first scan immediately
    this.performScan();
  }

  performScan() {
    const changes = [];
    const scanTime = new Date().toISOString();
    
    // Simulate warehouse activity
    for (let loc of this.locations) {
      // Random picks (10% chance)
      if (Math.random() < 0.1 && loc.occupied) {
        loc.quantity -= Math.floor(Math.random() * 5) + 1;
        loc.last_pick = scanTime;
        loc.pick_frequency++;
        
        if (loc.quantity <= 0) {
          loc.occupied = false;
          loc.sku = null;
          loc.quantity = 0;
          changes.push({ location: loc.id, change: 'DEPLETED', time: scanTime });
        } else {
          changes.push({ location: loc.id, change: 'PICKED', remaining: loc.quantity });
        }
      }
      
      // Random restocks (5% chance for empty)
      if (Math.random() < 0.05 && !loc.occupied) {
        loc.occupied = true;
        loc.sku = `SKU-${Math.floor(Math.random() * 9000) + 1000}`;
        loc.quantity = Math.floor(Math.random() * 50) + 10;
        loc.weight_lbs = Math.floor(Math.random() * 80) + 5;
        loc.ergonomic_risk = this.calculateErgonomicRisk(loc);
        changes.push({ location: loc.id, change: 'RESTOCKED', sku: loc.sku });
      }
      
      loc.last_scan = scanTime;
      loc.temperature = 68 + Math.random() * 10;
    }
    
    this.lastScanTime = scanTime;
    
    if (changes.length > 0) {
      console.log(`📊 Scan complete: ${changes.length} changes detected`);
      
      // Check for high-risk situations
      const highRisk = this.locations.filter(l => l.ergonomic_risk > 70).length;
      if (highRisk > 5) {
        console.log(`⚠️  High ergonomic risk detected in ${highRisk} locations`);
        return { changes, triggerOptimization: true };
      }
    }
    
    return { changes, triggerOptimization: false };
  }

  applyMoves(moves) {
    console.log(`🔧 Applying ${moves.length} moves to warehouse...`);
    const applied = [];
    
    for (let move of moves.slice(0, 10)) {
      const fromLoc = this.locations.find(l => l.id === move.from_location);
      const toLoc = this.locations.find(l => l.id === move.to_location);
      
      if (fromLoc && toLoc && fromLoc.occupied && !toLoc.occupied) {
        // Execute move
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
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Moved ${move.sku}: ${move.from_location} → ${move.to_location}`);
      }
    }
    
    this.movements.push(...applied);
    return applied;
  }

  enablePLCIntegration() {
    this.plcConnected = true;
    console.log('🔌 PLC Integration ENABLED - auto-execution active');
  }

  getAutomationStatus() {
    const occupied = this.locations.filter(l => l.occupied).length;
    const highRisk = this.locations.filter(l => l.ergonomic_risk > 70).length;

    return {
      automation_enabled: this.scanning,
      plc_connected: this.plcConnected,
      tracked_locations: this.locations.length,
      occupied_locations: occupied,
      occupancy_percentage: Math.round((occupied / this.locations.length) * 100),
      high_risk_locations: highRisk,
      last_scan: this.lastScanTime,
      total_movements: this.movements.length,
      scan_interval_seconds: 30,
      status: this.scanning ? 'ACTIVE' : 'IDLE'
    };
  }

  getSummary() {
    const occupied = this.locations.filter(l => l.occupied).length;
    const highRisk = this.locations.filter(l => l.ergonomic_risk > 70).length;
    const avgTemp = this.locations.reduce((sum, l) => sum + l.temperature, 0) / this.locations.length;
    
    const aisleStats = {};
    for (let loc of this.locations) {
      if (!aisleStats[loc.aisle]) {
        aisleStats[loc.aisle] = { total: 0, occupied: 0 };
      }
      aisleStats[loc.aisle].total++;
      if (loc.occupied) aisleStats[loc.aisle].occupied++;
    }
    
    return {
      totalLocations: this.locations.length,
      occupied: occupied,
      empty: this.locations.length - occupied,
      occupancyRate: occupied / this.locations.length,
      highRiskLocations: highRisk,
      averageTemperature: avgTemp,
      lastScanAt: this.lastScanTime,
      scanningActive: this.scanning,
      plcConnected: this.plcConnected,
      totalMovements: this.movements.length,
      aisles: Object.entries(aisleStats).map(([name, stats]) => ({
        name,
        total: stats.total,
        occupied: stats.occupied
      })),
      statusBreakdown: {
        'Optimal': this.locations.filter(l => l.ergonomic_risk < 30).length,
        'Warning': this.locations.filter(l => l.ergonomic_risk >= 30 && l.ergonomic_risk < 70).length,
        'Critical': this.locations.filter(l => l.ergonomic_risk >= 70).length
      }
    };
  }

  getLocations() {
    return this.locations;
  }

  getAllLocations() {
    return this.locations;
  }

  importLocations(locations) {
    console.log(`📥 [Simulator] Importing ${locations.length} locations`);
    locations.forEach(loc => {
      const existing = this.locations.find(l => l.id === loc.id);
      if (existing) {
        Object.assign(existing, loc);
      } else {
        this.locations.push(loc);
      }
    });
    console.log(`✅ [Simulator] Now tracking ${this.locations.length} total locations`);
  }

  stopScanning() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanning = false;
      console.log('🛑 Automated scanning stopped');
    }
  }
}

module.exports = WarehouseSimulator;
