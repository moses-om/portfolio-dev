/**
 * MIRA Knowledge Governance Admin API Test Suite (Phase 16)
 * Validates all administrative endpoints, error handlers, and persistence safety.
 */

const assert = require('assert');
const http = require('http');

const BASE_URL = 'http://localhost:3001';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
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
  console.log(' MIRA Knowledge Governance Admin API Verification Suite');
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

  // 1. Health Check
  await test('GET /api/health returns status ok', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  // 2. Governance Stats
  await test('GET /api/admin/stats returns valid breakdown', async () => {
    const res = await request('GET', '/api/admin/stats');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(typeof res.body.totalCandidates, 'number');
    assert.strictEqual(typeof res.body.totalVerifiedFaqs, 'number');
    assert.strictEqual(typeof res.body.totalQuestionVariants, 'number');
    assert.ok(res.body.totalVerifiedFaqs >= 13);
    assert.ok(res.body.classificationBreakdown != null);
  });

  // 3. Canonical FAQs List
  await test('GET /api/admin/faqs returns 13 canonical FAQs', async () => {
    const res = await request('GET', '/api/admin/faqs');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.faqs));
    assert.strictEqual(res.body.faqs.length, 13);
    const firstFaq = res.body.faqs[0];
    assert.ok(firstFaq.id != null);
    assert.ok(firstFaq.answer != null);
    assert.ok(Array.isArray(firstFaq.questions));
  });

  // 4. Candidate List with Pagination & Filtering
  await test('GET /api/admin/candidates returns paginated candidate list', async () => {
    const res = await request('GET', '/api/admin/candidates?page=1&limit=5');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.candidates));
    assert.strictEqual(res.body.candidates.length, 5);
    assert.strictEqual(res.body.pagination.page, 1);
    assert.strictEqual(res.body.pagination.limit, 5);
  });

  // 5. Candidate Detail by ID
  await test('GET /api/admin/candidates/:id returns enriched candidate metadata', async () => {
    const listRes = await request('GET', '/api/admin/candidates?limit=1');
    const candId = listRes.body.candidates[0].id;
    const res = await request('GET', `/api/admin/candidates/${candId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.candidate.id, candId);
    assert.ok(res.body.candidate.classification != null);
    assert.ok(res.body.candidate.recommendation != null);
    assert.ok(res.body.candidate.queryNature != null);
  });

  // 6. Candidate Detail 404 for invalid ID
  await test('GET /api/admin/candidates/invalid_id returns 404 error', async () => {
    const res = await request('GET', '/api/admin/candidates/invalid_nonexistent_id');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  // 7. Audit Log
  await test('GET /api/admin/log returns provenance history', async () => {
    const res = await request('GET', '/api/admin/log?limit=10');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.logs));
    assert.ok(res.body.logs.length > 0);
    const firstLog = res.body.logs[0];
    assert.ok(firstLog.decision != null);
    assert.ok(firstLog.reviewerDecisionTimestamp != null);
  });

  // 8. Error handling: Reject without candidateId returns 400
  await test('POST /api/admin/reject fails gracefully without candidateId', async () => {
    const res = await request('POST', '/api/admin/reject', {});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // 9. Error handling: Promote without destinationFaqId returns 400
  await test('POST /api/admin/promote fails gracefully without destinationFaqId', async () => {
    const res = await request('POST', '/api/admin/promote', { candidateId: 'some_cand' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // 10. Error handling: Promote invalid destination FAQ returns error
  await test('POST /api/admin/promote blocks invalid destination FAQ ID', async () => {
    const res = await request('POST', '/api/admin/promote', {
      candidateId: 'candidate_1786315861870_wam3',
      destinationFaqId: 'non_existent_fake_faq_category'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // 11. Error handling: Keep without candidateId returns 400
  await test('POST /api/admin/keep fails gracefully without candidateId', async () => {
    const res = await request('POST', '/api/admin/keep', {});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // 12. Admin GUI Static Asset Serving
  await test('GET /admin/ serves Admin GUI HTML', async () => {
    const res = await request('GET', '/admin/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('MIRA KNOWLEDGE GOVERNANCE CONSOLE'));
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
