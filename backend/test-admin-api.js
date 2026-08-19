/**
 * MIRA Knowledge Governance Admin API & Production Security Verification Suite (Phase 3B Hardened)
 * Validates Login Portal (username/scrypt-password), HttpOnly session cookies, logout,
 * backward-compatible x-admin-key authentication, rate limiting, payload/prompt bounding,
 * security headers, cache-control, CORS, static file isolation, and canonical governance actions.
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const BASE_URL = 'http://localhost:3001';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test_admin_key';
const TEST_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'mira_admin';
const TEST_ADMIN_PASSWORD = 'test_password_2026';

function request(method, reqPath, body = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
    let bodyBuffer = null;

    const headers = {
      ...customHeaders
    };

    if (body !== null) {
      bodyBuffer = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      headers['Content-Length'] = bodyBuffer.length;
    }

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
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, text: data, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

function extractCookieValue(setCookieHeader, cookieName) {
  if (!setCookieHeader) return null;
  const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
  const match = cookieStr.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

async function runAdminApiTests() {
  console.log('\n===============================================================');
  console.log(' MIRA Knowledge Governance Security & Hardening Verification Suite (Phase 3B)');
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
  let validSessionCookie = null;

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

  await test('CORS allows official Render backend origin (https://moses-ai-backend.onrender.com)', async () => {
    const res = await request('GET', '/api/health', null, { 'Origin': 'https://moses-ai-backend.onrender.com' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://moses-ai-backend.onrender.com');
  });

  await test('CORS blocks arbitrary unapproved origin (https://evil.example)', async () => {
    const res = await request('GET', '/api/health', null, { 'Origin': 'https://evil.example' });
    assert.notStrictEqual(res.headers['access-control-allow-origin'], 'https://evil.example');
  });

  // ─── 2. HTTP SECURITY HEADERS & CACHE CONTROL (SEC-03, SEC-04) ───
  await test('Security Headers: X-Content-Type-Options is nosniff', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
  });

  await test('Security Headers: X-Frame-Options is DENY', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.headers['x-frame-options'], 'DENY');
  });

  await test('Security Headers: Referrer-Policy is strict-origin-when-cross-origin', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  });

  await test('Security Headers: Permissions-Policy is present', async () => {
    const res = await request('GET', '/api/health');
    assert.ok(res.headers['permissions-policy'] != null);
    assert.ok(res.headers['permissions-policy'].includes('camera=()'));
  });

  await test('Security Headers: Admin endpoints emit Cache-Control: no-store, private', async () => {
    const res = await request('GET', '/api/admin/stats', null, authHeader);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['cache-control'] != null);
    assert.ok(res.headers['cache-control'].includes('no-store'));
    assert.ok(res.headers['cache-control'].includes('private'));
    assert.strictEqual(res.headers['pragma'], 'no-cache');
    assert.strictEqual(res.headers['expires'], '0');
  });

  await test('Security Headers: /admin GUI emits targeted CSP', async () => {
    const res = await request('GET', '/admin/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-security-policy'] != null);
    assert.ok(res.headers['content-security-policy'].includes("default-src 'self'"));
    assert.ok(res.headers['content-security-policy'].includes("https://fonts.googleapis.com"));
  });

  // ─── 3. ADMIN GUI ROUTING & BASIC AUTH POPUP REMOVAL (PHASE 3B) ───
  await test('Admin GUI: GET /admin/ no longer triggers WWW-Authenticate Basic challenge', async () => {
    const res = await request('GET', '/admin/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['www-authenticate'], undefined);
    assert.ok(res.text.includes('MIRA INTELLIGENCE'));
    assert.ok(res.text.includes('Governance Console'));
    assert.ok(res.text.includes('loginOverlay'));
  });

  // ─── 4. LOGIN ENDPOINT (POST /api/admin/login) & SCRYPT VERIFICATION ───
  await test('Admin Login: POST /api/admin/login with missing username returns 400 Bad Request', async () => {
    const res = await request('POST', '/api/admin/login', { password: TEST_ADMIN_PASSWORD });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error.includes('Username and password are required'));
  });

  await test('Admin Login: POST /api/admin/login with missing password returns 400 Bad Request', async () => {
    const res = await request('POST', '/api/admin/login', { username: TEST_ADMIN_USERNAME });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error.includes('Username and password are required'));
  });

  await test('Admin Login: POST /api/admin/login with invalid credentials returns 401 Unauthorized', async () => {
    const res = await request('POST', '/api/admin/login', {
      username: TEST_ADMIN_USERNAME,
      password: 'wrong_incorrect_password'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Invalid username or password.');
  });

  await test('Admin Login: POST /api/admin/login with valid credentials sets secure HttpOnly session cookie', async () => {
    const res = await request('POST', '/api/admin/login', {
      username: TEST_ADMIN_USERNAME,
      password: TEST_ADMIN_PASSWORD
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.authenticated, true);

    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie != null, 'Expected Set-Cookie header');
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    assert.ok(cookieStr.includes('mira_session='), 'Expected mira_session cookie name');
    assert.ok(cookieStr.includes('HttpOnly'), 'Expected HttpOnly attribute');
    assert.ok(cookieStr.includes('SameSite=Strict'), 'Expected SameSite=Strict attribute');
    assert.ok(cookieStr.includes('Max-Age='), 'Expected Max-Age attribute');

    validSessionCookie = extractCookieValue(setCookie, 'mira_session');
    assert.ok(validSessionCookie && validSessionCookie.length >= 32, 'Expected 256-bit session token');
  });

  // ─── 5. SESSION COOKIE AUTHORIZATION (PATH A) ───
  await test('Session Auth: Authenticated GET /api/admin/stats using session cookie succeeds (200 OK)', async () => {
    assert.ok(validSessionCookie, 'Valid session cookie required from prior test');
    const res = await request('GET', '/api/admin/stats', null, {
      'Cookie': `mira_session=${validSessionCookie}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(typeof res.body.totalCandidates, 'number');
  });

  await test('Session Auth: GET /api/admin/stats with forged/invalid session cookie returns 401 Unauthorized', async () => {
    const res = await request('GET', '/api/admin/stats', null, {
      'Cookie': 'mira_session=fake_invalid_forged_session_token_1234567890'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Unauthorized.');
  });

  // ─── 6. LOGOUT ENDPOINT (POST /api/admin/logout) ───
  await test('Session Logout: POST /api/admin/logout invalidates session and clears cookie', async () => {
    assert.ok(validSessionCookie, 'Valid session cookie required');
    const res = await request('POST', '/api/admin/logout', {}, {
      'Cookie': `mira_session=${validSessionCookie}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie != null, 'Expected Set-Cookie header to clear cookie');
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    assert.ok(cookieStr.includes('Max-Age=0') || cookieStr.includes('Expires='), 'Expected cookie invalidation attribute');

    // Verify session is no longer authorized
    const checkRes = await request('GET', '/api/admin/stats', null, {
      'Cookie': `mira_session=${validSessionCookie}`
    });
    assert.strictEqual(checkRes.status, 401);
    assert.strictEqual(checkRes.body.success, false);
  });

  // ─── 7. BACKWARD-COMPATIBLE API KEY AUTHORIZATION (PATH B) ───
  await test('Admin Auth: GET /api/admin/stats without credentials returns 401 Unauthorized', async () => {
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

  // ─── 8. PAYLOAD & PROMPT BOUNDS (SEC-05) ───
  await test('Payload Limits: Normal message (100 chars) succeeds (200 OK)', async () => {
    const res = await request('POST', '/api/chat', { message: 'What is Moses\'s background?' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.response != null);
  });

  await test('Payload Limits: Oversized prompt (>2,000 chars) is rejected (400 Bad Request)', async () => {
    const giantPrompt = 'A'.repeat(2005);
    const res = await request('POST', '/api/chat', { message: giantPrompt });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error.includes('2,000 characters'));
  });

  await test('Payload Limits: Excessive conversation history (>10 messages) is rejected (400 Bad Request)', async () => {
    const history = [];
    for (let i = 0; i < 11; i++) {
      history.push({ role: 'user', content: `Message number ${i}` });
    }
    const res = await request('POST', '/api/chat', { messages: history });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error.includes('10 messages'));
  });

  await test('Payload Limits: Excessive total conversation characters (>8,000 chars) is rejected (400 Bad Request)', async () => {
    const history = [
      { role: 'user', content: 'B'.repeat(4500) },
      { role: 'assistant', content: 'C'.repeat(4000) }
    ];
    const res = await request('POST', '/api/chat', { messages: history });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error.includes('8,000 characters'));
  });

  await test('Payload Limits: Oversized JSON body (>64KB) returns 413 Payload Too Large', async () => {
    const giantPayload = JSON.stringify({ message: 'x', padding: '0'.repeat(70 * 1024) });
    const res = await request('POST', '/api/chat', giantPayload, { 'Content-Type': 'application/json' });
    assert.strictEqual(res.status, 413);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error.includes('64KB limit'));
  });

  // ─── 9. STATIC FILE EXPOSURE CHECKS ───
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

  // ─── 10. ROUTE HOUSEKEEPING (SEC-06) ───
  await test('Route Housekeeping: POST /api/test is removed (404 Not Found)', async () => {
    const res = await request('POST', '/api/test', { message: 'test' });
    assert.strictEqual(res.status, 404);
  });

  // ─── 11. RATE LIMITING STRESS ASSERTION (SEC-01) ───
  await test('Rate Limiting: /api/chat enforces per-minute ceiling and returns 429 + Retry-After', async () => {
    let triggered429 = false;
    let retryAfterFound = false;

    // Send rapid requests until 429 is received (limit is 30/min)
    for (let i = 0; i < 35; i++) {
      const res = await request('POST', '/api/chat', { message: 'Who is Moses?' });
      if (res.status === 429) {
        triggered429 = true;
        if (res.headers['retry-after']) {
          retryAfterFound = true;
        }
        break;
      }
    }

    assert.ok(triggered429, 'Expected chat rate limiter to trigger HTTP 429');
    assert.ok(retryAfterFound, 'Expected rate limited response to include Retry-After header');
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
