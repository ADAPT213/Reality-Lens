/**
 * SmartPick AI Platform - Comprehensive Test Suite
 * Tests all endpoints and validates AI integration
 */

const http = require('http');

const BASE_URL = 'http://localhost:4010';
let testsPassed = 0;
let testsFailed = 0;

function colorLog(color, message) {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest(name, testFn) {
  try {
    await testFn();
    colorLog('green', `✅ PASS: ${name}`);
    testsPassed++;
  } catch (error) {
    colorLog('red', `❌ FAIL: ${name}`);
    console.error(`   Error: ${error.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  colorLog('blue', '🧪 SmartPick AI Platform - Test Suite');
  console.log('='.repeat(60) + '\n');

  // ========== HEALTH & STATUS TESTS ==========
  colorLog('yellow', '📋 Testing Health & Status Endpoints...');

  await runTest('Health Check', async () => {
    const res = await makeRequest('GET', '/api/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.status === 'ok', 'Status should be ok');
    assert(res.data.service === 'SmartPick AI Platform', 'Wrong service name');
    assert(res.data.modules, 'Should include modules');
  });

  await runTest('Status Endpoint', async () => {
    const res = await makeRequest('GET', '/api/status');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.platform === 'SmartPick AI', 'Wrong platform name');
    assert(res.data.uptime > 0, 'Uptime should be positive');
    assert(res.data.features.length === 5, 'Should have 5 features');
  });

  // ========== AI ASSISTANT TESTS ==========
  colorLog('yellow', '\n🤖 Testing AI Assistant...');

  await runTest('AI Assistant - Ergonomic Query', async () => {
    const res = await makeRequest('POST', '/api/v1/assistant/ask', {
      question: 'What are the ergonomic risks?',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.answer, 'Should have answer');
    assert(res.data.source, 'Should have source');
    assert(res.data.answer.length > 100, 'Answer should be substantial');
  });

  await runTest('AI Assistant - Slotting Query', async () => {
    const res = await makeRequest('POST', '/api/v1/assistant/ask', {
      question: 'How should I optimize product placement?',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(
      res.data.answer.toLowerCase().includes('slot') ||
        res.data.answer.toLowerCase().includes('placement'),
      'Answer should mention slotting',
    );
  });

  await runTest('AI Assistant - Vision Query', async () => {
    const res = await makeRequest('POST', '/api/v1/assistant/ask', {
      question: 'Explain safety zone detection',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.answer, 'Should have answer');
  });

  await runTest('AI Assistant - No Question', async () => {
    const res = await makeRequest('POST', '/api/v1/assistant/ask', {});
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.answer, 'Should provide default response');
  });

  // ========== CLARITY MODULE TESTS ==========
  colorLog('yellow', '\n🛡️  Testing Clarity Module (Ergonomics)...');

  await runTest('Clarity - Risk Analysis', async () => {
    const res = await makeRequest('GET', '/api/v1/clarity/zones/risk-analysis');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.zones, 'Should have zones');
    assert(res.data.zones.length > 0, 'Should have at least one zone');
    assert(res.data.summary, 'Should have summary');
    assert(res.data.aiInsights, 'Should have AI insights');

    const zone = res.data.zones[0];
    assert(zone.id, 'Zone should have id');
    assert(zone.riskScore !== undefined, 'Zone should have risk score');
    assert(zone.recommendations, 'Zone should have recommendations');
  });

  await runTest('Clarity - Worker Fatigue', async () => {
    const res = await makeRequest('GET', '/api/v1/clarity/worker/123/fatigue');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.workerId === '123', 'Should return correct worker ID');
    assert(res.data.fatigueScore !== undefined, 'Should have fatigue score');
    assert(res.data.recommendation, 'Should have recommendation');
    assert(res.data.riskExposure, 'Should have risk exposure data');
  });

  // ========== SLOTTING MODULE TESTS ==========
  colorLog('yellow', '\n📦 Testing Slotting Module...');

  await runTest('Slotting - Optimization Plan', async () => {
    const res = await makeRequest('GET', '/api/v1/slotting/optimization-plan');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.movePlan, 'Should have move plan');
    assert(res.data.movePlan.length > 0, 'Should have moves');
    assert(res.data.summary, 'Should have summary');
    assert(res.data.implementationStrategy, 'Should have strategy');

    const move = res.data.movePlan[0];
    assert(move.sku, 'Move should have SKU');
    assert(move.currentLocation, 'Move should have current location');
    assert(move.recommendedLocation, 'Move should have recommended location');
    assert(move.ergonomicImpact, 'Move should explain ergonomic impact');
  });

  await runTest('Slotting - ABC Analysis', async () => {
    const res = await makeRequest('GET', '/api/v1/slotting/abc-analysis');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.analysis, 'Should have analysis');
    assert(res.data.analysis.aClass, 'Should have A-class data');
    assert(res.data.analysis.bClass, 'Should have B-class data');
    assert(res.data.analysis.cClass, 'Should have C-class data');
    assert(res.data.analysis.aClass.recommendation, 'Should have recommendations');
  });

  // ========== VISION MODULE TESTS ==========
  colorLog('yellow', '\n👁️  Testing Vision Module...');

  await runTest('Vision - Zone Classification', async () => {
    const res = await makeRequest('GET', '/api/v1/vision/zone-classification');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.zones, 'Should have zones');
    assert(res.data.summary, 'Should have summary');

    const zone = res.data.zones[0];
    assert(
      ['green', 'yellow', 'red'].includes(zone.classification),
      'Should have valid classification',
    );
    assert(zone.safetyScore !== undefined, 'Should have safety score');
    assert(zone.requiredPPE, 'Should specify required PPE');
  });

  await runTest('Vision - Posture Analysis', async () => {
    const res = await makeRequest('POST', '/api/v1/vision/posture-analysis', {
      imageData: 'base64encodedimage',
      zoneId: 'A1',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.analysis, 'Should have analysis');
    assert(res.data.analysis.postureScore !== undefined, 'Should have posture score');
    assert(res.data.analysis.riskFactors, 'Should identify risk factors');
  });

  // ========== ANALYTICS MODULE TESTS ==========
  colorLog('yellow', '\n📊 Testing Analytics Module...');

  await runTest('Analytics - Dashboard', async () => {
    const res = await makeRequest('GET', '/api/v1/analytics/dashboard');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.kpis, 'Should have KPIs');
    assert(res.data.predictions, 'Should have predictions');
    assert(res.data.kpis.pickRate, 'Should track pick rate');
    assert(res.data.kpis.ergonomicRisk, 'Should track ergonomic risk');
    assert(res.data.predictions.congestion, 'Should predict congestion');
    assert(res.data.predictions.injuryRisk, 'Should predict injury risk');
  });

  await runTest('Analytics - Bottlenecks', async () => {
    const res = await makeRequest('GET', '/api/v1/analytics/bottlenecks');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.bottlenecks, 'Should have bottlenecks');
    assert(Array.isArray(res.data.bottlenecks), 'Bottlenecks should be array');

    if (res.data.bottlenecks.length > 0) {
      const bottleneck = res.data.bottlenecks[0];
      assert(bottleneck.location, 'Should have location');
      assert(bottleneck.solution, 'Should have solution');
    }
  });

  // ========== ALERTS MODULE TESTS ==========
  colorLog('yellow', '\n🚨 Testing Alerts Module...');

  await runTest('Alerts - Active Alerts', async () => {
    const res = await makeRequest('GET', '/api/v1/alerts/active');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.alerts, 'Should have alerts');
    assert(res.data.summary, 'Should have summary');
    assert(Array.isArray(res.data.alerts), 'Alerts should be array');

    if (res.data.alerts.length > 0) {
      const alert = res.data.alerts[0];
      assert(alert.id, 'Alert should have ID');
      assert(alert.type, 'Alert should have type');
      assert(alert.severity, 'Alert should have severity');
      assert(alert.action, 'Alert should have action');
    }
  });

  await runTest('Alerts - Acknowledge', async () => {
    const res = await makeRequest('POST', '/api/v1/alerts/acknowledge/ALT-8842');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.alertId === 'ALT-8842', 'Should return correct alert ID');
    assert(res.data.status === 'acknowledged', 'Should be acknowledged');
  });

  // ========== REPORTS MODULE TESTS ==========
  colorLog('yellow', '\n📑 Testing Reports Module...');

  await runTest('Reports - Daily Summary', async () => {
    const res = await makeRequest('GET', '/api/v1/reports/daily-summary');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.date, 'Should have date');
    assert(res.data.operations, 'Should have operations data');
    assert(res.data.safety, 'Should have safety data');
    assert(res.data.efficiency, 'Should have efficiency data');
    assert(res.data.recommendations, 'Should have recommendations');
  });

  // ========== WAREHOUSE DATA TESTS ==========
  colorLog('yellow', '\n🏭 Testing Warehouse Data Endpoints...');

  await runTest('Warehouses - List', async () => {
    const res = await makeRequest('GET', '/api/v1/warehouses');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.warehouses, 'Should have warehouses');
    assert(res.data.warehouses.length > 0, 'Should have at least one warehouse');
  });

  await runTest('Zones - List', async () => {
    const res = await makeRequest('GET', '/api/v1/zones');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.zones, 'Should have zones');
    assert(res.data.zones.length > 0, 'Should have at least one zone');
  });

  // ========== FINAL REPORT ==========
  console.log('\n' + '='.repeat(60));
  colorLog('blue', '📊 Test Results Summary');
  console.log('='.repeat(60));

  const total = testsPassed + testsFailed;
  const passRate = ((testsPassed / total) * 100).toFixed(1);

  console.log(`\nTotal Tests:   ${total}`);
  colorLog('green', `Passed:        ${testsPassed}`);
  if (testsFailed > 0) {
    colorLog('red', `Failed:        ${testsFailed}`);
  }
  colorLog(testsFailed === 0 ? 'green' : 'yellow', `Pass Rate:     ${passRate}%`);

  console.log('\n' + '='.repeat(60));

  if (testsFailed === 0) {
    colorLog('green', '✅ ALL TESTS PASSED - Platform Ready for Production!');
  } else {
    colorLog('yellow', '⚠️  Some tests failed - Review errors above');
  }

  console.log('='.repeat(60) + '\n');

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Wait a bit for server to be ready, then run tests
setTimeout(() => {
  runAllTests().catch((err) => {
    colorLog('red', `\n❌ Test suite error: ${err.message}`);
    process.exit(1);
  });
}, 1000);
