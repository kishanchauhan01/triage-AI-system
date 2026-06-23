import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runTriagePipeline } from '../pipeline.js';
import { calculateMetrics } from './metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper delay to avoid Groq rate limit errors (1000ms between requests)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('Starting Evaluation of AI-Powered Customer Triage System...');

  const datasetPath = path.join(__dirname, '../data/dataset.json');
  const groundTruthPath = path.join(__dirname, '../data/groundTruthl.json');

  if (!fs.existsSync(datasetPath) || !fs.existsSync(groundTruthPath)) {
    console.error('Dataset or Ground Truth files are missing. Please generate them first.');
    process.exit(1);
  }

  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8'));

  const categoryMatches = [];
  const priorityMatches = [];
  const latencies = [];
  const resultsTable = [];

  console.log(`Loaded ${dataset.length} test records. Processing sequentially...`);

  for (let i = 0; i < dataset.length; i++) {
    const record = dataset[i];
    const { ticket_id, payload } = record;
    const expected = groundTruth[ticket_id];

    if (!expected) {
      console.warn(`No ground truth found for ticket ${ticket_id}, skipping...`);
      continue;
    }

    const payloadString = JSON.stringify(payload);
    
    // Measure latency
    const startTime = process.hrtime();
    let result;
    try {
      result = await runTriagePipeline(payloadString);
    } catch (err) {
      result = {
        category: 'other',
        priority: 'P3',
        summary: `Pipeline crash: ${err.message}`,
        needs_human: true,
        confidence: 0.0
      };
    }
    const duration = process.hrtime(startTime);
    const latencyMs = duration[0] * 1000 + duration[1] / 1000000;
    latencies.push(latencyMs);

    categoryMatches.push({ expected: expected.category, actual: result.category });
    priorityMatches.push({ expected: expected.priority, actual: result.priority });

    resultsTable.push({
      id: ticket_id,
      categoryExp: expected.category,
      categoryAct: result.category,
      priorityExp: expected.priority,
      priorityAct: result.priority,
      escalate: result.needs_human,
      confidence: result.confidence,
      latency: latencyMs.toFixed(1)
    });

    console.log(`[${i+1}/${dataset.length}] Ticket: ${ticket_id} | Expected: ${expected.category}/${expected.priority} | Actual: ${result.category}/${result.priority} | Escalate: ${result.needs_human} | Latency: ${latencyMs.toFixed(0)}ms`);

    // Dynamic delay to respect Groq free limits (1.5 seconds)
    await delay(1500);
  }

  // Calculate overall metrics
  const categoryMetrics = calculateMetrics(categoryMatches);
  const priorityMetrics = calculateMetrics(priorityMatches);

  const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
  const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] || 0;

  // Print Markdown report
  console.log('\n======================================================');
  console.log('                EVALUATION REPORT SUMMARY              ');
  console.log('======================================================\n');
  
  console.log('### Latency Metrics');
  console.log(`- **Average Latency**: ${avgLatency.toFixed(0)} ms`);
  console.log(`- **p95 Latency**: ${p95Latency.toFixed(0)} ms\n`);

  console.log('### Category Metrics');
  console.log(`- **Overall Accuracy**: ${(categoryMetrics.accuracy * 100).toFixed(1)}%\n`);
  console.log('| Category | Precision | Recall | F1-Score | Support |');
  console.log('|---|---|---|---|---|');
  for (const [cls, met] of Object.entries(categoryMetrics.details)) {
    console.log(`| ${cls} | ${met.precision.toFixed(2)} | ${met.recall.toFixed(2)} | ${met.f1.toFixed(2)} | ${met.support} |`);
  }

  console.log('\n### Priority Metrics');
  console.log(`- **Overall Accuracy**: ${(priorityMetrics.accuracy * 100).toFixed(1)}%\n`);
  console.log('| Priority | Precision | Recall | F1-Score | Support |');
  console.log('|---|---|---|---|---|');
  for (const [cls, met] of Object.entries(priorityMetrics.details)) {
    console.log(`| ${cls} | ${met.precision.toFixed(2)} | ${met.recall.toFixed(2)} | ${met.f1.toFixed(2)} | ${met.support} |`);
  }

  console.log('\nEvaluation completed successfully.');
}

main().catch((err) => {
  console.error('Evaluation run crash:', err);
});
