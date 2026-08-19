/**
 * MIRA Knowledge Governance Admin API & Security Verification Suite (Phase 1 Hardened)
 * Validates administrative authentication, GUI access boundary, CORS enforcement,
 * static file isolation, and canonical governance actions.
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const BASE_URL = 'http://localhost:3001';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test_admin_key';

function request(method, reqPath, body = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runAdminApiTests() {
  console.log('\n===============================================================');
  console.log(' MIRA Knowledge Governance Security & Admin Verification Suite');
  console.log(' Target: http://localhost:3001');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  const authHeader = { 'x-admin-key': ADMIN_API_KEY };
  const basicAuthHeader = { 'Authorization': 'Basic ' + Buffer.from('admin:' + ADMIN_API_KEY).toString('base64') };

  // ─── 1. PUBLIC HEALTH & CORS CHECKS ───
  await test('GET /api/health returns status ok', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  await test('CORS allows official GitHub Pages origin (https://moses-om.github.io)', async () => {
    const res = await request('GET', '/api/health', null, { 'Origin': 'https://moses-om.github.io' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://moses-om.github.io');
  });

  await test('CORS allows legitimate localhost development origin (http://localhost:3000)', async () => {
    const res = await request('GET', '/api/health', null, { 'Origin': 'http://localhost:3000' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
  });

  await test('CORS blocks arbitrary unapproved origin (https://evil.example)', async () => {
    const res = await request('GET', '/api/health', null, { 'Origin': 'https://evil.example' });
    assert.notStrictEqual(res.headers['access-control-allow-origin'], 'https://evil.example');
  });

  // ─── 2. PUBLIC /api/chat ENDPOINT INTEGRITY ───
  await test('Public /api/chat remains functional without admin credentials', async () => {
    const res = await request('POST', '/api/chat', { message: 'What is Moses\'s background?' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.response != null);
  });

  // ─── 3. STATIC FILE EXPOSURE CHECKS ───
  await test('Static Exposure: GET /backend/server.js is blocked (404)', async () => {
    const res = await request('GET', '/backend/server.js');
    assert.strictEqual(res.status, 404);
  });

  await test('Static Exposure: GET /backend/data/candidate-cache.json is blocked (404)', async () => {
    const res = await request('GET', '/backend/data/candidate-cache.json');
    assert.strictEqual(res.status, 404);
  });

  await test('Static Exposure: GET /backend/data/candidate-promotion-log.json is blocked (404)', async () => {
    const res = await request('GET', '/backend/data/candidate-promotion-log.json');
    assert.strictEqual(res.status, 404);
  });

  await test('Static Exposure: GET /backend/prompts/system.js is blocked (404)', async () => {
    const res = await request('GET', '/backend/prompts/system.js');
    assert.strictEqual(res.status, 404);
  });

  // ─── 4. ADMIN GUI AUTHENTICATION ENFORCEMENT CHECKS ───
  await test('Admin GUI Auth: Unauthenticated GET /admin/ is rejected (401 + WWW-Authenticate)', async () => {
    const res = await request('GET', '/admin/');
    assert.strictEqual(res.status, 401);
    assert.ok(res.headers['www-authenticate'] != null);
    assert.ok(res.headers['www-authenticate'].includes('Basic realm='));
  });

  await test('Admin GUI Auth: GET /admin/ with invalid credentials is rejected (401)', async () => {
    const invalidBasic = { 'Authorization': 'Basic ' + Buffer.from('admin:wrong_password').toString('base64') };
    const res = await request('GET', '/admin/', null, invalidBasic);
    assert.strictEqual(res.status, 401);
  });

  await test('Admin GUI Auth: Authenticated GET /admin/ with valid Basic Auth succeeds (200 HTML)', async () => {
    const res = await request('GET', '/admin/', null, basicAuthHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('MIRA KNOWLEDGE GOVERNANCE CONSOLE'));
  });

  await test('Admin GUI Auth: Authenticated GET /admin/ with x-admin-key succeeds (200 HTML)', async () => {
    const res = await request('GET', '/admin/', null, authHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('MIRA KNOWLEDGE GOVERNANCE CONSOLE'));
  });

  // ─── 5. ADMIN API AUTHENTICATION ENFORCEMENT CHECKS ───
  await test('Admin Auth: GET /api/admin/stats without x-admin-key returns 401 Unauthorized', async () => {
    const res = await request('GET', '/api/admin/stats');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Unauthorized.');
  });

  await test('Admin Auth: GET /api/admin/stats with invalid x-admin-key returns 401 Unauthorized', async () => {
    const res = await request('GET', '/api/admin/stats', null, { 'x-admin-key': 'incorrect_dummy_key_123' });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Unauthorized.');
  });

  // ─── 6. AUTHENTICATED GOVERNANCE ACTIONS ───
  await test('Admin Auth: GET /api/admin/stats with valid x-admin-key returns 200 OK', async () => {
    const res = await request('GET', '/api/admin/stats', null, authHeader);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(typeof res.body.totalCandidates, 'number');
    assert.strictEqual(typeof res.body.totalVerifiedFaqs, 'number');
    assert.strictEqual(typeof res.body.totalQuestionVariants, 'number');
    assert.ok(res.body.totalVerifiedFaqs >= 13);
  });

  await test('Admin Auth: GET /api/admin/faqs with valid x-admin-key returns canonical FAQs', async () => {
    const res = await request('GET', '/api/admin/faqs', null, authHeader);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.faqs));
    assert.strictEqual(res.body.faqs.length, 13);
  });

  await test('Admin Auth: GET /api/admin/candidates with valid x-admin-key returns paginated list', async () => {
    const res = await request('GET', '/api/admin/candidates?page=1&limit=5', null, authHeader);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.candidates));
  });

  await test('Admin Auth: GET /api/admin/candidates/invalid_id returns 404 error', async () => {
    const res = await request('GET', '/api/admin/candidates/invalid_nonexistent_id', null, authHeader);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  await test('Admin Auth: GET /api/admin/log returns provenance history', async () => {
    const res = await request('GET', '/api/admin/log?limit=10', null, authHeader);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.logs));
  });

  await test('Admin Auth: POST /api/admin/reject fails gracefully without candidateId', async () => {
    const res = await request('POST', '/api/admin/reject', {}, authHeader);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  await test('Admin Auth: POST /api/admin/promote fails gracefully without destinationFaqId', async () => {
    const res = await request('POST', '/api/admin/promote', { candidateId: 'some_cand' }, authHeader);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  await test('Admin Auth: POST /api/admin/promote blocks invalid destination FAQ ID', async () => {
    const res = await request('POST', '/api/admin/promote', {
      candidateId: 'candidate_1786315861870_wam3',
      destinationFaqId: 'non_existent_fake_faq_category'
    }, authHeader);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  await test('Admin Auth: POST /api/admin/keep fails gracefully without candidateId', async () => {
    const res = await request('POST', '/api/admin/keep', {}, authHeader);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  console.log('\n===============================================================');
  console.log(` Results: ${passed}/${total} Passed (${((passed / total) * 100).toFixed(1)}%) | Failed: ${total - passed}`);
  console.log('===============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runAdminApiTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
