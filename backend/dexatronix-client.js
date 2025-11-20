/**
 * Dexatronix (DexoryView) API Client
 * Integrates real-time warehouse scan data from Dexatronix robots
 */

const fetch = require('node-fetch');

class DexatronixClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://api.service.dexoryview.com';
    this.apiKey = config.apiKey || process.env.DEXATRONIX_API_KEY;
    this.customer = config.customer || process.env.DEXATRONIX_CUSTOMER;
    this.site = config.site || process.env.DEXATRONIX_SITE;
    this.apiVersion = config.apiVersion || 'v2'; // v1 or v2
  }

  /**
   * Get authorization headers
   */
  _getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make API request
   */
  async _request(method, endpoint, body = null, useApiKey = false) {
    const url = useApiKey
      ? `${this.baseUrl}${endpoint}&api_key=${this.apiKey}`
      : `${this.baseUrl}${endpoint}`;

    const options = {
      method,
      headers: this._getHeaders(),
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Dexatronix API error: ${response.status} - ${errorData.error || response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Dexatronix API request failed:', error.message);
      throw error;
    }
  }

  /**
   * Fetch all locations with scan data
   */
  async fetchLocations(options = {}) {
    const { aisles = null, page = 1, pageSize = 100, upTo = null } = options;

    let endpoint = `/customer-api/${this.apiVersion}/locations?customer=${this.customer}&site=${this.site}`;

    if (aisles && Array.isArray(aisles)) {
      aisles.forEach((aisle) => {
        endpoint += `&aisle[]=${encodeURIComponent(aisle)}`;
      });
    }

    if (page) {
      endpoint += `&page[number]=${page}`;
    }

    if (pageSize) {
      endpoint += `&page[size]=${pageSize}`;
    }

    if (upTo) {
      endpoint += `&up_to=${upTo}`;
    }

    console.log(`📡 [Dexatronix] Fetching locations: ${endpoint}`);

    const response = await this._request('GET', endpoint, null, true);

    return {
      locations: response.data || [],
      pagination: response.links || null,
      total: response.data?.length || 0,
    };
  }

  /**
   * Fetch all locations across all pages
   */
  async fetchAllLocations(options = {}) {
    const allLocations = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.fetchLocations({ ...options, page, pageSize: 1000 });
      allLocations.push(...result.locations);

      // Check if there's a next page
      hasMore = result.pagination?.next !== null;
      page++;

      console.log(
        `📊 [Dexatronix] Fetched page ${page - 1}, total locations: ${allLocations.length}`,
      );
    }

    return allLocations;
  }

  /**
   * Fetch locations for specific aisles
   */
  async fetchAisleData(aisleNames) {
    return await this.fetchLocations({ aisles: aisleNames });
  }

  /**
   * Get image URL for a location
   */
  getImageUrl(imageUrl) {
    // Image URLs from API already include token
    return imageUrl;
  }

  /**
   * Push WMS import to Dexatronix
   */
  async pushWMSImport(locations, sharedId = null) {
    const endpoint = `/customer-api/${this.apiVersion}/wms-imports`;

    const payload = {
      customer: this.customer,
      site: this.site,
      locations: locations.map((loc) => ({
        name: loc.name,
        aisle: loc.aisle,
        expected_goods: loc.expected_goods || [],
      })),
    };

    if (sharedId) {
      payload.shared_id = sharedId;
    }

    console.log(`📤 [Dexatronix] Pushing WMS import: ${locations.length} locations`);

    const response = await this._request('POST', endpoint, payload);

    return response;
  }

  /**
   * Convert Dexatronix location to SmartPick format
   */
  convertToSmartPickFormat(dexatronixLocations) {
    const converted = {
      metadata: {
        source: 'dexatronix',
        timestamp: new Date().toISOString(),
        total_locations: dexatronixLocations.length,
        total_products: 0,
        customer: this.customer,
        site: this.site,
      },
      locations: [],
      products: [],
      aisles: [],
      zones: [],
    };

    const aisleMap = new Map();
    const zoneMap = new Map();
    const productMap = new Map();

    dexatronixLocations.forEach((loc) => {
      // Track aisles
      if (!aisleMap.has(loc.aisle)) {
        aisleMap.set(loc.aisle, {
          aisle_id: loc.aisle,
          location_count: 0,
          occupied_count: 0,
        });
      }
      const aisleData = aisleMap.get(loc.aisle);
      aisleData.location_count++;
      if (loc.occupancy > 0) aisleData.occupied_count++;

      // Track zones
      if (loc.zoning) {
        const zonePriority = loc.zoning.priority || 'medium';
        if (!zoneMap.has(loc.aisle)) {
          zoneMap.set(loc.aisle, {
            zone_id: `Zone-${loc.aisle}`,
            priority: zonePriority,
            location_count: 0,
            utilization_rate: 0,
          });
        }
        zoneMap.get(loc.aisle).location_count++;
      }

      // Convert location
      const smartPickLocation = {
        location_id: loc.name,
        aisle: loc.aisle,
        zone: loc.zoning?.priority
          ? `Zone-${loc.aisle}-${loc.zoning.priority}`
          : `Zone-${loc.aisle}`,
        occupied: loc.occupancy > 0,
        occupancy_percent: Math.round(loc.occupancy * 100),
        location_type: loc.location_type,
        scan_date: loc.scan_date,
        status: loc.status,
        status_type: loc.status_type,
        message: loc.message,
        image_url: loc.image_url,
        height_inches: this._estimateHeightFromType(loc.location_type),
        dexatronix_metadata: {
          scanned_markers: loc.scanned_markers || [],
          raw_status: loc.status,
        },
      };

      converted.locations.push(smartPickLocation);

      // Convert products
      if (loc.expected_inventory_objects && loc.expected_inventory_objects.length > 0) {
        loc.expected_inventory_objects.forEach((inv) => {
          const productKey =
            inv.sku || inv.marker || inv.product_code || `UNKNOWN-${Math.random()}`;

          if (!productMap.has(productKey)) {
            const product = {
              sku: inv.sku || inv.marker || productKey,
              description: inv.description || 'Unknown Product',
              current_location: loc.name,
              weight_lbs: inv.expected_weight_g ? Math.round(inv.expected_weight_g / 453.592) : 25,
              pick_frequency: this._estimatePickFrequency(loc.zoning?.priority),
              height_inches: smartPickLocation.height_inches,
              aisle: loc.aisle,
              zone: smartPickLocation.zone,
              quantity: inv.quantity || 1,
              dexatronix_metadata: {
                marker: inv.marker,
                batch: inv.batch,
                client: inv.client,
                supplier: inv.supplier,
                expiry_date: inv.expiry_date,
                received_date: inv.received_date,
                part_number: inv.part_number,
                product_code: inv.product_code,
                awb: inv.awb,
                lot: inv.lot,
                tracking_number: inv.tracking_number,
              },
            };

            // Calculate ergonomic risk
            product.ergonomic_risk_score = this._calculateErgonomicRisk(
              product.weight_lbs,
              product.height_inches,
              product.pick_frequency,
            );

            productMap.set(productKey, product);
            converted.products.push(product);
          }
        });
      }
    });

    // Finalize aisles and zones
    converted.aisles = Array.from(aisleMap.values());
    converted.zones = Array.from(zoneMap.values());
    converted.metadata.total_products = converted.products.length;

    return converted;
  }

  /**
   * Estimate height based on location type
   */
  _estimateHeightFromType(locationType) {
    switch (locationType) {
      case 'block':
        return 12; // Ground level
      case 'pick':
        return 42; // Waist level
      case 'rack':
        return 60; // Typical rack height
      default:
        return 48; // Default mid-height
    }
  }

  /**
   * Estimate pick frequency from zone priority
   */
  _estimatePickFrequency(priority) {
    switch (priority) {
      case 'high':
        return 75; // A-class
      case 'medium':
        return 35; // B-class
      case 'low':
        return 10; // C-class
      default:
        return 25; // Default B-class
    }
  }

  /**
   * Calculate ergonomic risk score
   */
  _calculateErgonomicRisk(weightLbs, heightInches, pickFrequency) {
    const weightFactor = weightLbs > 40 ? 3.0 : weightLbs > 20 ? 1.5 : 1.0;
    const heightFactor = heightInches < 30 || heightInches > 60 ? 2.0 : 1.0;
    const frequencyFactor = pickFrequency / 100;

    return Math.min(100, Math.round(weightFactor * heightFactor * frequencyFactor * 100));
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    const missing = [];

    if (!this.apiKey) missing.push('apiKey');
    if (!this.customer) missing.push('customer');
    if (!this.site) missing.push('site');

    if (missing.length > 0) {
      throw new Error(`Dexatronix configuration incomplete. Missing: ${missing.join(', ')}`);
    }

    return true;
  }

  /**
   * Test connection to Dexatronix API
   */
  async testConnection() {
    try {
      this.validateConfig();

      console.log('🔍 [Dexatronix] Testing connection...');
      console.log(`   Customer: ${this.customer}`);
      console.log(`   Site: ${this.site}`);
      console.log(`   API Version: ${this.apiVersion}`);

      const result = await this.fetchLocations({ page: 1, pageSize: 1 });

      console.log('✅ [Dexatronix] Connection successful!');
      console.log(`   Total locations available: ${result.total > 0 ? '1+' : '0'}`);

      return {
        success: true,
        message: 'Connection successful',
        sample_location: result.locations[0] || null,
      };
    } catch (error) {
      console.error('❌ [Dexatronix] Connection failed:', error.message);
      return {
        success: false,
        message: error.message,
        error: error,
      };
    }
  }

  /**
   * Get summary statistics from Dexatronix data
   */
  async getSummary() {
    try {
      const locations = await this.fetchAllLocations();

      const summary = {
        total_locations: locations.length,
        occupied_locations: locations.filter((l) => l.occupancy > 0).length,
        empty_locations: locations.filter((l) => l.occupancy === 0).length,
        average_occupancy: locations.reduce((sum, l) => sum + l.occupancy, 0) / locations.length,
        aisles: [...new Set(locations.map((l) => l.aisle))],
        status_breakdown: {},
        last_scan_date: null,
      };

      // Status breakdown
      locations.forEach((loc) => {
        summary.status_breakdown[loc.status_type] =
          (summary.status_breakdown[loc.status_type] || 0) + 1;

        if (!summary.last_scan_date || new Date(loc.scan_date) > new Date(summary.last_scan_date)) {
          summary.last_scan_date = loc.scan_date;
        }
      });

      return summary;
    } catch (error) {
      console.error('❌ [Dexatronix] Summary failed:', error.message);
      throw error;
    }
  }
}

module.exports = DexatronixClient;
