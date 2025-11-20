/**
 * Data Converter - Excel/CSV/WMS to JSON
 * Converts various warehouse data formats into unified JSON structure
 */

class DataConverter {
  /**
   * Convert CSV string to warehouse JSON
   */
  parseCSV(csvString) {
    const lines = csvString.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have header row and at least one data row');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length !== headers.length) continue;

      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index].trim();
      });
      data.push(row);
    }

    return this._convertToWarehouseModel(data, 'csv');
  }

  /**
   * Convert Excel-style data (array of objects) to warehouse JSON
   */
  parseExcel(excelData) {
    if (!Array.isArray(excelData) || excelData.length === 0) {
      throw new Error('Excel data must be array of objects');
    }

    return this._convertToWarehouseModel(excelData, 'excel');
  }

  /**
   * Convert WMS export to warehouse JSON
   */
  parseWMS(wmsData) {
    // WMS formats vary - handle common structures
    if (wmsData.inventory) {
      return this._convertInventoryExport(wmsData.inventory);
    } else if (wmsData.locations) {
      return this._convertLocationExport(wmsData.locations);
    } else if (Array.isArray(wmsData)) {
      return this._convertToWarehouseModel(wmsData, 'wms');
    }

    throw new Error('Unrecognized WMS format');
  }

  /**
   * Convert generic data to unified warehouse model
   */
  _convertToWarehouseModel(data, source) {
    const warehouse = {
      metadata: {
        source,
        imported_at: new Date().toISOString(),
        total_records: data.length,
      },
      locations: [],
      inventory: [],
      aisles: [],
      zones: [],
      products: [],
    };

    // Extract locations
    const locationMap = new Map();
    const productMap = new Map();
    const aisleSet = new Set();
    const zoneSet = new Set();

    data.forEach((row, index) => {
      // Parse location info
      const locationId = this._extractField(row, [
        'location',
        'bin',
        'shelf',
        'position',
        'loc_id',
      ]);
      const aisleId = this._extractField(row, ['aisle', 'aisle_id', 'aisle_number']);
      const zoneId = this._extractField(row, ['zone', 'zone_id', 'area']);

      // Parse product info
      const sku = this._extractField(row, ['sku', 'product_id', 'item_number', 'product_code']);
      const description = this._extractField(row, [
        'description',
        'product_name',
        'item_name',
        'name',
      ]);
      const quantity = parseInt(
        this._extractField(row, ['quantity', 'qty', 'count', 'stock']) || '0',
      );
      const weight = parseFloat(this._extractField(row, ['weight', 'weight_lbs', 'wt']) || '0');
      const height = parseFloat(this._extractField(row, ['height', 'height_in', 'ht']) || '0');

      // Parse metrics
      const pickFrequency = parseInt(
        this._extractField(row, ['pick_frequency', 'picks_per_day', 'daily_picks']) || '0',
      );
      const velocity = this._extractField(row, ['velocity', 'abc_class', 'class']) || 'C';

      // Add to location map
      if (locationId && !locationMap.has(locationId)) {
        locationMap.set(locationId, {
          location_id: locationId,
          aisle: aisleId || 'unknown',
          zone: zoneId || 'unknown',
          height_inches: height || 48,
          occupied: true,
          capacity_used: quantity > 0 ? 0.8 : 0,
          sku: sku || null,
        });
      }

      // Add to product map
      if (sku && !productMap.has(sku)) {
        productMap.set(sku, {
          sku,
          description,
          weight_lbs: weight,
          height_inches: height,
          quantity_on_hand: quantity,
          pick_frequency: pickFrequency,
          velocity_class: velocity,
          current_location: locationId || 'unknown',
          ergonomic_risk: this._calculateErgonomicRisk(weight, height, pickFrequency),
        });
      }

      // Track aisles and zones
      if (aisleId) aisleSet.add(aisleId);
      if (zoneId) zoneSet.add(zoneId);
    });

    // Convert maps to arrays
    warehouse.locations = Array.from(locationMap.values());
    warehouse.products = Array.from(productMap.values());

    // Generate aisle metadata
    warehouse.aisles = Array.from(aisleSet).map((id) => ({
      aisle_id: id,
      location_count: warehouse.locations.filter((l) => l.aisle === id).length,
      utilization: this._calculateUtilization(warehouse.locations.filter((l) => l.aisle === id)),
    }));

    // Generate zone metadata
    warehouse.zones = Array.from(zoneSet).map((id) => ({
      zone_id: id,
      location_count: warehouse.locations.filter((l) => l.zone === id).length,
      product_count: warehouse.products.filter((p) => {
        const loc = warehouse.locations.find((l) => l.location_id === p.current_location);
        return loc && loc.zone === id;
      }).length,
      avg_pick_frequency: this._calculateAvgPickFrequency(
        warehouse.products,
        warehouse.locations,
        id,
      ),
    }));

    return warehouse;
  }

  /**
   * Extract field from row (case-insensitive, multiple aliases)
   */
  _extractField(row, aliases) {
    for (const alias of aliases) {
      const key = Object.keys(row).find((k) => k.toLowerCase() === alias.toLowerCase());
      if (key && row[key]) return row[key];
    }
    return null;
  }

  /**
   * Calculate ergonomic risk score
   */
  _calculateErgonomicRisk(weight, height, pickFrequency) {
    let risk = 0;

    // Weight factor (0-30 points)
    if (weight > 50) risk += 30;
    else if (weight > 40) risk += 20;
    else if (weight > 30) risk += 10;

    // Height factor (0-40 points)
    if (height > 72 || height < 24) risk += 40;
    else if (height > 60 || height < 30) risk += 25;
    else if (height > 54 || height < 36) risk += 10;

    // Frequency factor (0-30 points)
    if (pickFrequency > 100) risk += 30;
    else if (pickFrequency > 50) risk += 20;
    else if (pickFrequency > 20) risk += 10;

    return Math.min(risk, 100);
  }

  /**
   * Calculate aisle/zone utilization
   */
  _calculateUtilization(locations) {
    if (locations.length === 0) return 0;
    const occupied = locations.filter((l) => l.occupied).length;
    return Math.round((occupied / locations.length) * 100);
  }

  /**
   * Calculate average pick frequency for zone
   */
  _calculateAvgPickFrequency(products, locations, zoneId) {
    const zoneProducts = products.filter((p) => {
      const loc = locations.find((l) => l.location_id === p.current_location);
      return loc && loc.zone === zoneId;
    });

    if (zoneProducts.length === 0) return 0;

    const total = zoneProducts.reduce((sum, p) => sum + (p.pick_frequency || 0), 0);
    return Math.round(total / zoneProducts.length);
  }

  /**
   * Convert inventory-focused WMS export
   */
  _convertInventoryExport(inventory) {
    return this._convertToWarehouseModel(inventory, 'wms_inventory');
  }

  /**
   * Convert location-focused WMS export
   */
  _convertLocationExport(locations) {
    return this._convertToWarehouseModel(locations, 'wms_locations');
  }

  /**
   * Validate warehouse model structure
   */
  validateModel(model) {
    const errors = [];

    if (!model.metadata) errors.push('Missing metadata');
    if (!Array.isArray(model.locations)) errors.push('Locations must be array');
    if (!Array.isArray(model.products)) errors.push('Products must be array');
    if (!Array.isArray(model.aisles)) errors.push('Aisles must be array');
    if (!Array.isArray(model.zones)) errors.push('Zones must be array');

    if (model.locations.length === 0) errors.push('No locations found');
    if (model.products.length === 0) errors.push('No products found');

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Merge multiple warehouse models
   */
  mergeModels(models) {
    const merged = {
      metadata: {
        source: 'merged',
        merged_count: models.length,
        merged_at: new Date().toISOString(),
      },
      locations: [],
      inventory: [],
      aisles: [],
      zones: [],
      products: [],
    };

    // Deduplicate and merge
    const locationIds = new Set();
    const productSkus = new Set();
    const aisleIds = new Set();
    const zoneIds = new Set();

    models.forEach((model) => {
      model.locations.forEach((loc) => {
        if (!locationIds.has(loc.location_id)) {
          locationIds.add(loc.location_id);
          merged.locations.push(loc);
        }
      });

      model.products.forEach((prod) => {
        if (!productSkus.has(prod.sku)) {
          productSkus.add(prod.sku);
          merged.products.push(prod);
        }
      });

      model.aisles.forEach((aisle) => {
        if (!aisleIds.has(aisle.aisle_id)) {
          aisleIds.add(aisle.aisle_id);
          merged.aisles.push(aisle);
        }
      });

      model.zones.forEach((zone) => {
        if (!zoneIds.has(zone.zone_id)) {
          zoneIds.add(zone.zone_id);
          merged.zones.push(zone);
        }
      });
    });

    return merged;
  }
}

module.exports = DataConverter;
