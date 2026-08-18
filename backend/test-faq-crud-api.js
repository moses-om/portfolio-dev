/**
 * Automated Verification for Phase 16 Canonical FAQ CRUD API
 */
const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const opts = { ...options };
    let bodyBuffer = null;
    if (postData) {
      bodyBuffer = Buffer.from(typeof postData === 'string' ? postData : JSON.stringify(postData));
      opts.headers = {
        ...(opts.headers || {}),
        'Content-Type': 'application/json',
        'Content-Length': bodyBuffer.length
      };
    }

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
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

async function runTests() {
  console.log('=== STARTING FAQ CRUD API TEST SUITE ===');
  const basePort = 3001;

  // Cleanup pre-existing test FAQ if present
  try {
    await makeRequest({
      hostname: 'localhost',
      port: basePort,
      path: '/api/admin/faqs/test_temporary_crud_faq',
      method: 'DELETE'
    });
  } catch (e) {}

  // 1. GET /api/admin/faqs
  console.log('\n[Test 1] GET /api/admin/faqs');
  const res1 = await makeRequest({
    hostname: 'localhost',
    port: basePort,
    path: '/api/admin/faqs',
    method: 'GET'
  });
  console.log(`Status: ${res1.status}, FAQs Count: ${res1.data.faqs ? res1.data.faqs.length : 'N/A'}`);
  if (res1.status !== 200 || !Array.isArray(res1.data.faqs)) {
    throw new Error('Test 1 Failed: Could not fetch FAQs.');
  }

  // 2. POST /api/admin/faqs (Create test FAQ)
  console.log('\n[Test 2] POST /api/admin/faqs (Create Test Entry)');
  const testFaqPayload = {
    id: 'test_temporary_crud_faq',
    category: 'Testing & Verification',
    anchor: 'Testing',
    answer: 'This is an automated test FAQ entry created to verify full CRUD capabilities.',
    questions: [
      'how does the crud test work',
      'what is test temporary crud faq',
      'verify crud api'
    ]
  };
  const res2 = await makeRequest({
    hostname: 'localhost',
    port: basePort,
    path: '/api/admin/faqs',
    method: 'POST'
  }, testFaqPayload);
  console.log(`Status: ${res2.status}, Created ID: ${res2.data.faq ? res2.data.faq.id : 'N/A'}`);
  if (res2.status !== 201 || !res2.data.success) {
    throw new Error(`Test 2 Failed: ${JSON.stringify(res2.data)}`);
  }

  // 3. PUT /api/admin/faqs/:id (Update test FAQ)
  console.log('\n[Test 3] PUT /api/admin/faqs/:id (Update Test Entry)');
  const updatePayload = {
    answer: 'Updated answer for the automated test entry.',
    category: 'Updated Category'
  };
  const res3 = await makeRequest({
    hostname: 'localhost',
    port: basePort,
    path: '/api/admin/faqs/test_temporary_crud_faq',
    method: 'PUT'
  }, updatePayload);
  console.log(`Status: ${res3.status}, Updated Answer: "${res3.data.faq ? res3.data.faq.answer : 'N/A'}"`);
  if (res3.status !== 200 || res3.data.faq.answer !== updatePayload.answer) {
    throw new Error(`Test 3 Failed: ${JSON.stringify(res3.data)}`);
  }

  // 4. DELETE /api/admin/faqs/:id/variants (Delete single variant)
  console.log('\n[Test 4] DELETE /api/admin/faqs/:id/variants (Delete Single Variant)');
  const res4 = await makeRequest({
    hostname: 'localhost',
    port: basePort,
    path: '/api/admin/faqs/test_temporary_crud_faq/variants?variantText=verify%20crud%20api',
    method: 'DELETE'
  });
  console.log(`Status: ${res4.status}, Remaining Variants: ${res4.data.remainingVariantsCount}`);
  if (res4.status !== 200 || res4.data.remainingVariantsCount !== 2) {
    throw new Error(`Test 4 Failed: ${JSON.stringify(res4.data)}`);
  }

  // 5. DELETE /api/admin/faqs/:id (Delete the entire test FAQ)
  console.log('\n[Test 5] DELETE /api/admin/faqs/:id (Delete Entire Entry)');
  const res5 = await makeRequest({
    hostname: 'localhost',
    port: basePort,
    path: '/api/admin/faqs/test_temporary_crud_faq',
    method: 'DELETE'
  });
  console.log(`Status: ${res5.status}, Deleted: ${res5.data.deletedFaqId}`);
  if (res5.status !== 200 || res5.data.deletedFaqId !== 'test_temporary_crud_faq') {
    throw new Error(`Test 5 Failed: ${JSON.stringify(res5.data)}`);
  }

  // 6. Verify it's gone
  console.log('\n[Test 6] Verify Deletion');
  const res6 = await makeRequest({
    hostname: 'localhost',
    port: basePort,
    path: '/api/admin/faqs',
    method: 'GET'
  });
  const exists = res6.data.faqs.some(f => f.id === 'test_temporary_crud_faq');
  console.log(`Exists in final list? ${exists}`);
  if (exists) {
    throw new Error('Test 6 Failed: Test entry still exists.');
  }

  console.log('\n>>> ALL 6 FAQ CRUD API TESTS PASSED PERFECTLY! <<<\n');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
