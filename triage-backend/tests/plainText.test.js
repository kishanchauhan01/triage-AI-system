import test from 'node:test';
import assert from 'node:assert/strict';
import { runTriagePipeline } from '../pipeline.js';

test('Plain Text Support Tests', async (t) => {

  await t.test('Should ingest and classify raw flat string correctly', async () => {
    const rawPayload = "I was double charged on my subscription payment for this month.";

    const result = await runTriagePipeline(rawPayload);

    // Assert correct category
    assert.equal(result.category, 'billing');
    assert.ok(result.summary.toLowerCase().includes('charge') || result.summary.toLowerCase().includes('billing'));

    // Assert timing telemetry structure exists
    assert.ok(result._meta, 'Response should contain timing _meta');
    assert.ok(result._meta.timings, 'Response should contain timings array');
    
    // Check if JSON Parsing and Content Extraction phases are registered in the metrics
    const parsePhase = result._meta.timings.find(tim => tim.name === 'JSON Parsing');
    const extractionPhase = result._meta.timings.find(tim => tim.name === 'Content Extraction');
    
    assert.ok(parsePhase, 'Timings should have JSON Parsing metric');
    assert.ok(extractionPhase, 'Timings should have Content Extraction metric');
  });

  await t.test('Should classify a simple plain text account query', async () => {
    const rawPayload = "I am locked out of my login screen, password reset is not sending any code.";

    const result = await runTriagePipeline(rawPayload);

    // Assert correct category
    assert.equal(result.category, 'account_access');
    assert.ok(result.summary.toLowerCase().includes('lock') || result.summary.toLowerCase().includes('login') || result.summary.toLowerCase().includes('password'));
  });

});
