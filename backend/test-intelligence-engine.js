/**
 * Test file for Warehouse Intelligence Engine
 * Tests all Intelligence Engine endpoints with sample data
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:4010/api';

// Sample CSV warehouse data
const SAMPLE_CSV = `SKU,Location,Description,Weight_lbs,Pick_Frequency,Height_Inches,Aisle,Zone
SKU-1001,A1-01-A,Heavy Boxes 50lb,52,85,18,A1,Zone-A
SKU-1002,A1-02-B,Light Parts,8,120,48,A1,Zone-A
SKU-1003,A1-03-C,Medium Tools,25,45,72,A1,Zone-A
SKU-1004,A2-01-A,Safety Equipment,15,95,42,A2,Zone-A
SKU-1005,A2-02-B,Fasteners Bulk,35,65,24,A2,Zone-A
SKU-1006,B1-01-A,Slow Moving Stock,18,8,84,B1,Zone-B
SKU-1007,B1-02-B,Seasonal Items,12,5,78,B1,Zone-B
SKU-1008,C1-01-A,Rare Parts,5,2,36,C1,Zone-C`;

const tests = [];
let testsPassed = 0;
let testsFailed = 0;

// Helper: Log test result
function logTest(name, passed, details = '') {
  tests.push({ name, passed, details });
  if (passed) {
    testsPassed++;
    console.log(`✅ ${name}`);
  } else {
    testsFailed++;
    console.error(`❌ ${name}`, details);
  }
}

// Helper: Make HTTP request
async function request(method, endpoint, body = null, isFormData = false) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
  };

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();
  return { status: response.status, data };
}

// Helper: Create form data for file upload
function createFormData(filename, content, fieldName = 'data') {
  const formData = new FormData();

  const buffer = Buffer.from(content, 'utf-8');
  formData.append(fieldName, buffer, {
    filename,
    contentType: 'text/csv',
  });

  return formData;
}

// ============================================================================
// TEST SUITE
// ============================================================================

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Warehouse Intelligence Engine - Test Suite');
  console.log('='.repeat(60) + '\n');

  // Test 1: Health Check
  try {
    const { status, data } = await request('GET', '/health');
    logTest('1. Health Check', status === 200 && data.status === 'ok');
  } catch (error) {
    logTest('1. Health Check', false, error.message);
  }

  // Test 2: AI Assistant (Basic)
  try {
    const { status, data } = await request('POST', '/v1/assistant/ask', {
      question: 'What is ergonomic risk analysis?',
    });
    logTest('2. AI Assistant Query', status === 200 && data.answer);
  } catch (error) {
    logTest('2. AI Assistant Query', false, error.message);
  }

  // Test 3: Upload Warehouse Data (CSV)
  try {
    const formData = new FormData();
    formData.append('data', Buffer.from(SAMPLE_CSV), {
      filename: 'warehouse-data.csv',
      contentType: 'text/csv',
    });
    formData.append('sourceType', 'csv');

    const response = await fetch(`${BASE_URL}/v1/intelligence/upload-data`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });

    const data = await response.json();
    logTest(
      '3. Upload Warehouse Data (CSV)',
      response.status === 200 && data.success && data.metadata,
      data.metadata
        ? `Loaded ${data.metadata.total_locations} locations, ${data.metadata.total_products} products`
        : '',
    );
  } catch (error) {
    logTest('3. Upload Warehouse Data (CSV)', false, error.message);
  }

  // Wait a moment for data to process
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Test 4: Get Warehouse State
  try {
    const { status, data } = await request('GET', '/v1/intelligence/warehouse');
    logTest(
      '4. Get Warehouse State',
      status === 200 && data.state && data.state.locations.length > 0,
      data.state
        ? `${data.state.locations.length} locations, ${data.state.products.length} products`
        : '',
    );
  } catch (error) {
    logTest('4. Get Warehouse State', false, error.message);
  }

  // Test 5: Get Warehouse Summary & Health
  try {
    const { status, data } = await request('GET', '/v1/intelligence/summary');
    logTest(
      '5. Get Warehouse Summary',
      status === 200 && data.summary && data.health_explanation,
      data.summary
        ? `Health Score: ${data.summary.overall_health_score}/100, Utilization: ${data.summary.utilization_rate}%`
        : '',
    );
  } catch (error) {
    logTest('5. Get Warehouse Summary', false, error.message);
  }

  // Test 6: Generate Optimization Plan
  try {
    const { status, data } = await request('POST', '/v1/intelligence/optimize', {
      optimize_slotting: true,
      optimize_ergonomics: true,
      optimize_congestion: true,
      max_moves: 10,
    });
    logTest(
      '6. Generate Optimization Plan',
      status === 200 && data.optimization_plan && data.explanation,
      data.optimization_plan ? `${data.optimization_plan.total_moves} moves recommended` : '',
    );
  } catch (error) {
    logTest('6. Generate Optimization Plan', false, error.message);
  }

  // Test 7: Get 3D Layout Data
  try {
    const { status, data } = await request('GET', '/v1/intelligence/layout-3d');
    logTest(
      '7. Get 3D Layout Data',
      status === 200 && data.layout_3d && data.layout_3d.aisles,
      data.layout_3d
        ? `${data.layout_3d.aisles.length} aisles, ${data.layout_3d.locations.length} locations`
        : '',
    );
  } catch (error) {
    logTest('7. Get 3D Layout Data', false, error.message);
  }

  // Test 8: Generate Pick Path
  try {
    const { status, data } = await request('POST', '/v1/intelligence/pick-path', {
      orderItems: [
        { sku: 'SKU-1001', quantity: 2 },
        { sku: 'SKU-1002', quantity: 5 },
        { sku: 'SKU-1004', quantity: 1 },
      ],
    });
    logTest(
      '8. Generate Pick Path',
      status === 200 && data.pick_path && data.pick_path.optimized_sequence,
      data.pick_path ? `${data.pick_path.total_items} items, ${data.pick_path.estimated_time}` : '',
    );
  } catch (error) {
    logTest('8. Generate Pick Path', false, error.message);
  }

  // Test 9: What-If Analysis
  try {
    const { status, data } = await request('POST', '/v1/intelligence/what-if', {
      scenario: {
        description: 'What if we move all A-class items to Zone A?',
        changes: [
          'Move high-frequency items to golden zone',
          'Relocate slow movers to outer zones',
        ],
      },
    });
    logTest(
      '9. What-If Analysis',
      status === 200 && data.analysis,
      data.analysis ? 'Scenario analyzed successfully' : '',
    );
  } catch (error) {
    logTest('9. What-If Analysis', false, error.message);
  }

  // Test 10: Clarity - Risk Analysis (Legacy module)
  try {
    const { status, data } = await request('GET', '/v1/clarity/zones/risk-analysis');
    logTest('10. Clarity Risk Analysis', status === 200 && data.zones);
  } catch (error) {
    logTest('10. Clarity Risk Analysis', false, error.message);
  }

  // Test 11: Slotting - ABC Analysis (Legacy module)
  try {
    const { status, data } = await request('GET', '/v1/slotting/abc-analysis');
    logTest('11. Slotting ABC Analysis', status === 200 && data.classification);
  } catch (error) {
    logTest('11. Slotting ABC Analysis', false, error.message);
  }

  // Test 12: Vision - Zone Classification (Legacy module)
  try {
    const { status, data } = await request('GET', '/v1/vision/zone-classification');
    logTest('12. Vision Zone Classification', status === 200 && data.zones);
  } catch (error) {
    logTest('12. Vision Zone Classification', false, error.message);
  }

  // Test 13: Analytics Dashboard (Legacy module)
  try {
    const { status, data } = await request('GET', '/v1/analytics/dashboard');
    logTest('13. Analytics Dashboard', status === 200 && data.metrics);
  } catch (error) {
    logTest('13. Analytics Dashboard', false, error.message);
  }

  // Test 14: Active Alerts (Legacy module)
  try {
    const { status, data } = await request('GET', '/v1/alerts/active');
    logTest('14. Active Alerts', status === 200 && Array.isArray(data.alerts));
  } catch (error) {
    logTest('14. Active Alerts', false, error.message);
  }

  // Test 15: Daily Summary Report (Legacy module)
  try {
    const { status, data } = await request('GET', '/v1/reports/daily-summary');
    logTest('15. Daily Summary Report', status === 200 && data.operations);
  } catch (error) {
    logTest('15. Daily Summary Report', false, error.message);
  }

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
  console.log('='.repeat(60) + '\n');

  // Exit with appropriate code
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
if (require.main === module) {
  runTests().catch((error) => {
    console.error('❌ Test suite error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
