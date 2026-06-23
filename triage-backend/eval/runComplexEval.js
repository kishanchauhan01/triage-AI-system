import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_PATH = path.join(__dirname, '../data/dataset_complex.json');
const BACKEND_URL = 'http://127.0.0.1:3000/triage';

async function runComplexEvaluation() {
  console.log('====================================================');
  console.log('      TRIAGE SYSTEM COMPLEX DATASET EVALUATOR       ');
  console.log('====================================================');

  if (!fs.existsSync(DATASET_PATH)) {
    console.error(`Error: Dataset file not found at ${DATASET_PATH}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(DATASET_PATH, 'utf-8');
  let testCases;
  try {
    testCases = JSON.parse(rawData);
  } catch (err) {
    console.error('Error: Failed to parse dataset JSON.', err.message);
    process.exit(1);
  }

  console.log(`Loaded ${testCases.length} complex test cases. Starting execution...\n`);

  let successCount = 0;
  let failCount = 0;
  let totalLatency = 0;
  const timings = [];

  const categoryDistribution = {};
  const priorityDistribution = {};
  const humanEscalationCount = { true: 0, false: 0 };

  for (const testCase of testCases) {
    const { id, description, payload } = testCase;
    console.log(`[Test Case ${id}/${testCases.length}] - "${description}"`);

    const tStart = performance.now();
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const tEnd = performance.now();
      const latency = tEnd - tStart;
      totalLatency += latency;

      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }

      const result = await response.json();
      successCount++;
      timings.push(latency);

      // Record distribution metrics
      const cat = result.category || 'unknown';
      const pri = result.priority || 'unknown';
      const esc = result.needs_human === true;

      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
      priorityDistribution[pri] = (priorityDistribution[pri] || 0) + 1;
      humanEscalationCount[esc] = (humanEscalationCount[esc] || 0) + 1;

      console.log(`  ✓ SUCCESS | Category: ${cat.padEnd(16, ' ')} | Priority: ${pri.padEnd(4, ' ')} | Escalate: ${esc ? 'YES' : 'NO '} | Latency: ${latency.toFixed(0)}ms`);
      console.log(`  Summary: "${result.summary || 'None'}"\n`);

    } catch (error) {
      failCount++;
      console.error(`  ✗ FAILED  | Connection/HTTP error: ${error.message}\n`);
    }

    // Small delay between requests to be gentle on rate limits
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const avgLatency = successCount > 0 ? (totalLatency / successCount) : 0;

  console.log('====================================================');
  console.log('               EVALUATION SUMMARY                   ');
  console.log('====================================================');
  console.log(`Total Cases Evaluated: ${testCases.length}`);
  console.log(`Successful Calls:     ${successCount}`);
  console.log(`Failed Calls:         ${failCount}`);
  console.log(`Average API Latency:  ${avgLatency.toFixed(0)} ms`);
  console.log('----------------------------------------------------');
  console.log('Category Classification Distribution:');
  Object.entries(categoryDistribution).forEach(([cat, count]) => {
    console.log(`  - ${cat.padEnd(18, ' ')}: ${count}`);
  });
  console.log('Priority Distribution:');
  Object.entries(priorityDistribution).forEach(([pri, count]) => {
    console.log(`  - ${pri.padEnd(18, ' ')}: ${count}`);
  });
  console.log('Human Escalation Gate Logs:');
  console.log(`  - Routed to Human   : ${humanEscalationCount.true}`);
  console.log(`  - Direct Automated  : ${humanEscalationCount.false}`);
  console.log('====================================================\n');
}

runComplexEvaluation();
