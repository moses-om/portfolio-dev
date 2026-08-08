/**
 * Local Test Suite for Moses AI Assistant Backend
 * Tests the 7 required queries against POST http://localhost:3001/api/chat
 */

const testQuestions = [
  { id: 1, prompt: "What does Moses do?" },
  { id: 2, prompt: "What are Moses's strongest technical skills?" },
  { id: 3, prompt: "Tell me about the institutional ranking system." },
  { id: 4, prompt: "What is Moses's educational background?" },
  { id: 5, prompt: "What research has Moses published?" },
  { id: 6, prompt: "Does Moses have experience with Power BI?" },
  { id: 7, prompt: "What is Moses's favorite ice cream flavor?" } // Out-of-bounds question
];

async function runTests() {
  console.log("\n=======================================================");
  console.log(" Running Moses AI Assistant Phase 2 Backend Test Suite ");
  console.log(" Target: http://localhost:3001/api/chat");
  console.log("=======================================================\n");

  for (const q of testQuestions) {
    console.log(`[TEST ${q.id}] Query: "${q.prompt}"`);
    try {
      const res = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: q.prompt }]
        })
      });
      const data = await res.json();
      if (data.success) {
        console.log(`[TEST ${q.id} RESULT]: SUCCESS`);
        console.log(`Response:\n${data.response}\n`);
      } else {
        console.log(`[TEST ${q.id} RESULT]: HANDLED ERROR / REQUIREMENT`);
        console.log(`Error Message: ${data.error}\n`);
      }
    } catch (err) {
      console.error(`[TEST ${q.id} FAILED]: Network / Server Error: ${err.message}\n`);
    }
    // 12s delay to safely stay under free-tier 5 RPM limit
    await new Promise(r => setTimeout(r, 12000));
  }
}

runTests();
