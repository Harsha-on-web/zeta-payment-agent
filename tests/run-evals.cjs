const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/payments/decide';
const API_KEY = process.env.API_KEY || 'your-secret-api-key';

async function runEvals() {
  const evalsFilePath = path.join(__dirname, 'evals.json');
  const testCases = JSON.parse(fs.readFileSync(evalsFilePath, 'utf-8'));

  let correct = 0;
  let total = 0;

  for (const testCase of testCases) {
    total++;
    console.log(`\nRunning test: "${testCase.description}"`);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify(testCase.payload),
      });

      const data = await response.json();

      if (response.status >= 400) {
        console.error(`  [FAIL] Received status ${response.status}: ${data.message}`);
        continue;
      }

      if (data.decision === testCase.expectedDecision) {
        correct++;
        console.log(`  [PASS] Expected: ${testCase.expectedDecision}, Got: ${data.decision}`);
      } else {
        console.log(`  [FAIL] Expected: ${testCase.expectedDecision}, Got: ${data.decision}`);
      }
    } catch (error) {
      console.error(`  [ERROR] Test failed with an exception: ${error.message}`);
    }
  }

  console.log(`\nEvaluation complete. Accuracy: ${correct}/${total} (${((correct / total) * 100).toFixed(2)}%)`);
}

runEvals();
