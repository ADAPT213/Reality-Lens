/**
 * Test Dexatronix Integration
 * Validates connection and data conversion
 */

const DexatronixClient = require('./dexatronix-client');

// Sample Dexatronix location data (v2 format)
const SAMPLE_DEXATRONIX_DATA = [
  {
    name: 'A1-01-01',
    location_type: 'rack',
    aisle: 'A1',
    scan_date: '2025-11-18T10:30:00Z',
    occupancy: 0.85,
    zoning: {
      priority: 'high',
      client_categories: ['Fast Moving Goods'],
    },
    expected_inventory_objects: [
      {
        marker: 'QR-SKU-1001',
        sku: 'SKU-1001',
        description: 'Heavy Pallets',
        expected_weight_g: 22680, // 50 lbs
        quantity: 2,
        product_code: 'PALLET-HEAVY',
        client: 'Acme Corp',
      },
    ],
    scanned_markers: [{ marker: 'QR-SKU-1001' }],
    status: 'occupied_with_exact_match',
    status_type: 'Correct',
    message: 'Contains expected item',
    image_url: 'https://api.service.dexoryview.com/customer-api/v2/images/abc123',
  },
  {
    name: 'A1-01-02',
    location_type: 'pick',
    aisle: 'A1',
    scan_date: '2025-11-18T10:30:00Z',
    occupancy: 0.0,
    zoning: {
      priority: 'medium',
    },
    expected_inventory_objects: [],
    scanned_markers: [],
    status: 'correctly_empty',
    status_type: 'Correct',
    message: 'Location is empty as expected',
    image_url: 'https://api.service.dexoryview.com/customer-api/v2/images/abc124',
  },
  {
    name: 'B2-03-05',
    location_type: 'rack',
    aisle: 'B2',
    scan_date: '2025-11-18T10:32:00Z',
    occupancy: 0.45,
    zoning: {
      priority: 'low',
    },
    expected_inventory_objects: [
      {
        marker: 'QR-SKU-2500',
        sku: 'SKU-2500',
        description: 'Seasonal Items',
        expected_weight_g: 5443, // 12 lbs
        quantity: 8,
        product_code: 'SEASONAL-WINTER',
        expiry_date: '2026-03-31',
      },
    ],
    scanned_markers: [{ marker: 'QR-SKU-2500' }],
    status: 'occupied_with_exact_match',
    status_type: 'Correct',
    message: 'Contains expected item',
    image_url: 'https://api.service.dexoryview.com/customer-api/v2/images/abc125',
  },
];

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 Dexatronix Integration - Test Suite');
  console.log('='.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Initialize client (without credentials)
  try {
    const client = new DexatronixClient({});
    console.log('✅ Test 1: Client initialization (no credentials)');
    passed++;
  } catch (error) {
    console.log('❌ Test 1: Client initialization failed:', error.message);
    failed++;
  }

  // Test 2: Data conversion
  try {
    const client = new DexatronixClient({
      customer: 'test-customer',
      site: 'test-site',
    });

    const converted = client.convertToSmartPickFormat(SAMPLE_DEXATRONIX_DATA);

    console.log('✅ Test 2: Data conversion');
    console.log(`   - Locations: ${converted.locations.length}`);
    console.log(`   - Products: ${converted.products.length}`);
    console.log(`   - Aisles: ${converted.aisles.length}`);
    console.log(`   - Zones: ${converted.zones.length}`);

    if (converted.locations.length !== 3) {
      throw new Error('Expected 3 locations');
    }
    if (converted.products.length !== 2) {
      throw new Error('Expected 2 products');
    }

    passed++;
  } catch (error) {
    console.log('❌ Test 2: Data conversion failed:', error.message);
    failed++;
  }

  // Test 3: Product data mapping
  try {
    const client = new DexatronixClient({
      customer: 'test-customer',
      site: 'test-site',
    });

    const converted = client.convertToSmartPickFormat(SAMPLE_DEXATRONIX_DATA);
    const product = converted.products.find((p) => p.sku === 'SKU-1001');

    if (!product) {
      throw new Error('Product SKU-1001 not found');
    }

    console.log('✅ Test 3: Product data mapping');
    console.log(`   - SKU: ${product.sku}`);
    console.log(`   - Weight: ${product.weight_lbs} lbs`);
    console.log(`   - Pick Frequency: ${product.pick_frequency}/day`);
    console.log(`   - Ergonomic Risk: ${product.ergonomic_risk_score}`);
    console.log(`   - Location: ${product.current_location}`);

    if (product.weight_lbs < 49 || product.weight_lbs > 51) {
      throw new Error('Weight conversion incorrect (expected ~50 lbs)');
    }

    passed++;
  } catch (error) {
    console.log('❌ Test 3: Product data mapping failed:', error.message);
    failed++;
  }

  // Test 4: Aisle aggregation
  try {
    const client = new DexatronixClient({
      customer: 'test-customer',
      site: 'test-site',
    });

    const converted = client.convertToSmartPickFormat(SAMPLE_DEXATRONIX_DATA);
    const aisleA1 = converted.aisles.find((a) => a.aisle_id === 'A1');

    if (!aisleA1) {
      throw new Error('Aisle A1 not found');
    }

    console.log('✅ Test 4: Aisle aggregation');
    console.log(`   - Aisle: ${aisleA1.aisle_id}`);
    console.log(`   - Locations: ${aisleA1.location_count}`);
    console.log(`   - Occupied: ${aisleA1.occupied_count}`);

    if (aisleA1.location_count !== 2) {
      throw new Error('Expected 2 locations in aisle A1');
    }

    passed++;
  } catch (error) {
    console.log('❌ Test 4: Aisle aggregation failed:', error.message);
    failed++;
  }

  // Test 5: Priority-based pick frequency estimation
  try {
    const client = new DexatronixClient({
      customer: 'test-customer',
      site: 'test-site',
    });

    const highFreq = client._estimatePickFrequency('high');
    const mediumFreq = client._estimatePickFrequency('medium');
    const lowFreq = client._estimatePickFrequency('low');

    console.log('✅ Test 5: Pick frequency estimation');
    console.log(`   - High priority: ${highFreq}/day`);
    console.log(`   - Medium priority: ${mediumFreq}/day`);
    console.log(`   - Low priority: ${lowFreq}/day`);

    if (highFreq <= mediumFreq || mediumFreq <= lowFreq) {
      throw new Error('Pick frequency priorities incorrect');
    }

    passed++;
  } catch (error) {
    console.log('❌ Test 5: Pick frequency estimation failed:', error.message);
    failed++;
  }

  // Test 6: Configuration validation
  try {
    const client = new DexatronixClient({});

    try {
      client.validateConfig();
      throw new Error('Should have thrown validation error');
    } catch (validationError) {
      if (validationError.message.includes('Missing')) {
        console.log('✅ Test 6: Configuration validation');
        passed++;
      } else {
        throw validationError;
      }
    }
  } catch (error) {
    console.log('❌ Test 6: Configuration validation failed:', error.message);
    failed++;
  }

  // Test 7: Metadata preservation
  try {
    const client = new DexatronixClient({
      customer: 'test-customer',
      site: 'test-site',
    });

    const converted = client.convertToSmartPickFormat(SAMPLE_DEXATRONIX_DATA);
    const product = converted.products[0];

    if (!product.dexatronix_metadata || !product.dexatronix_metadata.marker) {
      throw new Error('Dexatronix metadata not preserved');
    }

    console.log('✅ Test 7: Metadata preservation');
    console.log(`   - Marker: ${product.dexatronix_metadata.marker}`);
    console.log(`   - Client: ${product.dexatronix_metadata.client}`);
    console.log(`   - Product Code: ${product.dexatronix_metadata.product_code}`);

    passed++;
  } catch (error) {
    console.log('❌ Test 7: Metadata preservation failed:', error.message);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
if (require.main === module) {
  runTests().catch((error) => {
    console.error('❌ Test suite error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
