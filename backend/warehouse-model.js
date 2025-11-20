/**
 * Warehouse Model - Unified warehouse state representation
 * Merges vision data + imported data into single source of truth
 */

class WarehouseModel {
  constructor() {
    this.state = {
      warehouse_id: null,
      name: 'Default Warehouse',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),

      // Core data
      locations: [], // All storage locations
      products: [], // All SKUs/products
      aisles: [], // Aisle metadata
      zones: [], // Zone definitions

      // Vision data
      photos: [], // Uploaded photos with analysis
      detected_issues: [], // Issues found via vision

      // Calculated metrics
      metrics: {
        total_locations: 0,
        utilized_locations: 0,
        utilization_rate: 0,
        total_products: 0,
        avg_pick_frequency: 0,
        ergonomic_risk_score: 0,
        congestion_score: 0,
      },

      // Optimization state
      optimization_status: 'not_started',
      last_optimized: null,
      recommendations: [],
    };
  }

  /**
   * Initialize from data converter output
   */
  loadFromConverter(converterOutput) {
    this.state.locations = converterOutput.locations || [];
    this.state.products = converterOutput.products || [];
    this.state.aisles = converterOutput.aisles || [];
    this.state.zones = converterOutput.zones || [];
    this.state.updated_at = new Date().toISOString();

    this._recalculateMetrics();
    return this;
  }

  /**
   * Merge vision analysis results
   */
  mergeVisionData(photoAnalysis) {
    // Add photo to collection
    this.state.photos.push({
      photo_id: `photo_${this.state.photos.length + 1}`,
      uploaded_at: new Date().toISOString(),
      analysis: photoAnalysis,
    });

    // Extract detected issues
    if (photoAnalysis.success && photoAnalysis.result) {
      const issues =
        photoAnalysis.result.issues ||
        photoAnalysis.result.violations ||
        photoAnalysis.result.hazards ||
        [];

      issues.forEach((issue) => {
        this.state.detected_issues.push({
          issue_id: `issue_${this.state.detected_issues.length + 1}`,
          detected_at: new Date().toISOString(),
          source: 'vision',
          description: typeof issue === 'string' ? issue : issue.description,
          severity: typeof issue === 'object' ? issue.severity : 'medium',
          photo_id: `photo_${this.state.photos.length}`,
          status: 'open',
        });
      });
    }

    // Try to match vision data to existing locations/products
    this._matchVisionToLocations(photoAnalysis);

    this.state.updated_at = new Date().toISOString();
    return this;
  }

  /**
   * Match vision-detected SKUs to inventory
   */
  _matchVisionToLocations(photoAnalysis) {
    if (!photoAnalysis.success || !photoAnalysis.result) return;

    const { skus, locations } = photoAnalysis.result;

    // Update product verification status
    if (skus && Array.isArray(skus)) {
      skus.forEach((detectedSku) => {
        const sku = typeof detectedSku === 'string' ? detectedSku : detectedSku.sku;
        const product = this.state.products.find((p) => p.sku === sku);

        if (product) {
          product.vision_verified = true;
          product.last_verified = new Date().toISOString();
        } else {
          // Unknown SKU detected - add as unmatched
          this.state.products.push({
            sku,
            description: 'Detected via vision - unmatched',
            vision_verified: true,
            matched_to_wms: false,
            last_verified: new Date().toISOString(),
            needs_verification: true,
          });
        }
      });
    }

    // Update location verification
    if (locations && Array.isArray(locations)) {
      locations.forEach((detectedLoc) => {
        const locId = typeof detectedLoc === 'string' ? detectedLoc : detectedLoc.location_id;
        const location = this.state.locations.find((l) => l.location_id === locId);

        if (location) {
          location.vision_verified = true;
          location.last_verified = new Date().toISOString();
        }
      });
    }
  }

  /**
   * Get location by ID
   */
  getLocation(locationId) {
    return this.state.locations.find((l) => l.location_id === locationId);
  }

  /**
   * Get product by SKU
   */
  getProduct(sku) {
    return this.state.products.find((p) => p.sku === sku);
  }

  /**
   * Get all products in a zone
   */
  getProductsByZone(zoneId) {
    const locationIds = this.state.locations
      .filter((l) => l.zone === zoneId)
      .map((l) => l.location_id);

    return this.state.products.filter((p) => locationIds.includes(p.current_location));
  }

  /**
   * Get all products in an aisle
   */
  getProductsByAisle(aisleId) {
    const locationIds = this.state.locations
      .filter((l) => l.aisle === aisleId)
      .map((l) => l.location_id);

    return this.state.products.filter((p) => locationIds.includes(p.current_location));
  }

  /**
   * Update product location
   */
  updateProductLocation(sku, newLocationId) {
    const product = this.getProduct(sku);
    if (!product) throw new Error(`Product ${sku} not found`);

    const oldLocationId = product.current_location;
    product.current_location = newLocationId;
    product.last_moved = new Date().toISOString();

    // Update location occupancy
    const oldLoc = this.getLocation(oldLocationId);
    if (oldLoc) oldLoc.occupied = false;

    const newLoc = this.getLocation(newLocationId);
    if (newLoc) {
      newLoc.occupied = true;
      newLoc.sku = sku;
    }

    this._recalculateMetrics();
    return { success: true, sku, old_location: oldLocationId, new_location: newLocationId };
  }

  /**
   * Recalculate all metrics
   */
  _recalculateMetrics() {
    const m = this.state.metrics;

    m.total_locations = this.state.locations.length;
    m.utilized_locations = this.state.locations.filter((l) => l.occupied).length;
    m.utilization_rate =
      m.total_locations > 0 ? Math.round((m.utilized_locations / m.total_locations) * 100) : 0;

    m.total_products = this.state.products.length;

    const totalFreq = this.state.products.reduce((sum, p) => sum + (p.pick_frequency || 0), 0);
    m.avg_pick_frequency = m.total_products > 0 ? Math.round(totalFreq / m.total_products) : 0;

    const totalRisk = this.state.products.reduce((sum, p) => sum + (p.ergonomic_risk || 0), 0);
    m.ergonomic_risk_score = m.total_products > 0 ? Math.round(totalRisk / m.total_products) : 0;

    m.congestion_score = this._calculateCongestionScore();
  }

  /**
   * Calculate congestion based on pick frequency density
   */
  _calculateCongestionScore() {
    if (this.state.aisles.length === 0) return 0;

    // Find aisles with high pick frequency concentration
    let totalCongestion = 0;

    this.state.aisles.forEach((aisle) => {
      const aisleProducts = this.getProductsByAisle(aisle.aisle_id);
      const totalPicks = aisleProducts.reduce((sum, p) => sum + (p.pick_frequency || 0), 0);

      // Congestion increases with total pick frequency
      if (totalPicks > 500) totalCongestion += 30;
      else if (totalPicks > 300) totalCongestion += 20;
      else if (totalPicks > 100) totalCongestion += 10;
    });

    return Math.min(totalCongestion, 100);
  }

  /**
   * Get high-risk products (ergonomic)
   */
  getHighRiskProducts(threshold = 60) {
    return this.state.products
      .filter((p) => (p.ergonomic_risk || 0) >= threshold)
      .sort((a, b) => (b.ergonomic_risk || 0) - (a.ergonomic_risk || 0));
  }

  /**
   * Get fast-moving products (A-class)
   */
  getFastMovers(threshold = 50) {
    return this.state.products
      .filter((p) => (p.pick_frequency || 0) >= threshold)
      .sort((a, b) => (b.pick_frequency || 0) - (a.pick_frequency || 0));
  }

  /**
   * Get misplaced products (fast movers in bad locations)
   */
  getMisplacedProducts() {
    return this.state.products.filter((p) => {
      const location = this.getLocation(p.current_location);
      if (!location) return false;

      // Fast movers above 60 inches or below 30 inches are misplaced
      if (p.pick_frequency > 50) {
        return location.height_inches > 60 || location.height_inches < 30;
      }

      // Heavy items below 36 inches are misplaced
      if (p.weight_lbs > 40) {
        return location.height_inches < 36;
      }

      return false;
    });
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      warehouse_id: this.state.warehouse_id,
      name: this.state.name,
      updated_at: this.state.updated_at,
      metrics: this.state.metrics,
      counts: {
        locations: this.state.locations.length,
        products: this.state.products.length,
        aisles: this.state.aisles.length,
        zones: this.state.zones.length,
        photos: this.state.photos.length,
        open_issues: this.state.detected_issues.filter((i) => i.status === 'open').length,
      },
      health: {
        utilization: this.state.metrics.utilization_rate,
        ergonomic_risk: this.state.metrics.ergonomic_risk_score,
        congestion: this.state.metrics.congestion_score,
        overall_score: this._calculateOverallHealth(),
      },
    };
  }

  /**
   * Calculate overall warehouse health score (0-100)
   */
  _calculateOverallHealth() {
    const utilization = this.state.metrics.utilization_rate;
    const risk = this.state.metrics.ergonomic_risk_score;
    const congestion = this.state.metrics.congestion_score;

    // Good utilization: 70-90%
    let utilizationScore =
      utilization >= 70 && utilization <= 90
        ? 35
        : utilization < 70
          ? utilization / 2
          : 100 - utilization;

    // Low risk is good
    let riskScore = Math.max(0, 35 - risk * 0.35);

    // Low congestion is good
    let congestionScore = Math.max(0, 30 - congestion * 0.3);

    return Math.round(utilizationScore + riskScore + congestionScore);
  }

  /**
   * Export warehouse state as JSON
   */
  export() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Import warehouse state from JSON
   */
  import(stateJson) {
    this.state = stateJson;
    this._recalculateMetrics();
    return this;
  }

  /**
   * Get full state
   */
  getState() {
    return this.state;
  }
}

module.exports = WarehouseModel;
