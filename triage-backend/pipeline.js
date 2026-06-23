import { safeParseJson } from './src/parsing/jsonParser.js';
import { extractContent } from './src/extraction/index.js';
import { validateExtractedText } from './src/validation/textValidator.js';
import { detectInjection } from './src/classification/injectionHeuristic.js';
import { classifyText } from './src/classification/llmClient.js';
import { coerceAndValidateTriageResult } from './src/reliability/schemaValidator.js';
import { checkContradictions } from './src/reliability/contradictionChecks.js';
import { processConfidenceGate } from './src/reliability/confidenceGate.js';
import { getFallbackResult } from './src/reliability/fallback.js';
import { buildResponse } from './src/output/responseBuilder.js';

/**
 * Utility to print the consolidated execution breakdown.
 *
 * @param {Array<{name: string, duration: number}>} timings Timings list for each phase.
 * @param {number} totalDuration Total duration of the pipeline execution in milliseconds.
 */
function printFinalSummary(timings, totalDuration) {
  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log('│         TRIAGE PIPELINE EXECUTION SUMMARY              │');
  console.log('├────────────────────────────────────────────────────────┤');
  for (const { name, duration } of timings) {
    const paddedName = name.padEnd(30, ' ');
    const paddedDuration = `${duration.toFixed(2)} ms`.padStart(18, ' ');
    console.log(`│ ${paddedName} │ ${paddedDuration} │`);
  }
  console.log('├────────────────────────────────────────────────────────┤');
  const paddedTotal = `${totalDuration.toFixed(2)} ms`.padStart(18, ' ');
  console.log(`│ ${'Total Pipeline Time'.padEnd(30, ' ')} │ ${paddedTotal} │`);
  console.log('└────────────────────────────────────────────────────────┘\n');
}

/**
 * Wires together the 7 layers of the Customer Triage pipeline.
 * Guarantees exception safety by catching all errors and returning
 * a structured failure-specific fallback response.
 * Includes detailed performance profiling telemetry.
 *
 * @param {string} rawBody The raw, truncated request body from the client.
 * @returns {Promise<Object>} The final schema-conformant triage result.
 */
export async function runTriagePipeline(rawBody) {
  const context = {
    extractedText: '',
    hasCompetingCandidates: false,
    injectionHeuristicFired: false,
    malformedInput: false,
    noExtractableText: false,
    schemaValidationFailed: false,
    contradictionDetected: false,
    coercionTriggered: false
  };

  const timings = [];
  const pipelineStart = performance.now();

  const startPhase = (name) => {
    const t0 = performance.now();
    console.log(`[PIPELINE] Starting Phase: ${name}...`);
    return {
      end: () => {
        const duration = performance.now() - t0;
        timings.push({ name, duration });
        console.log(`[PIPELINE] ✓ Phase completed: ${name} in ${duration.toFixed(2)}ms`);
        return duration;
      }
    };
  };

  const attachMeta = (res) => {
    const totalDuration = performance.now() - pipelineStart;
    printFinalSummary(timings, totalDuration);
    res._meta = {
      timings,
      totalDuration
    };
    return res;
  };

  try {
    const trimmed = (rawBody || '').trim();
    const isJsonLike = trimmed.startsWith('{') || trimmed.startsWith('[');

    if (isJsonLike) {
      // 1. Parsing Layer (safely parses JSON, never throws)
      const parsingPhase = startPhase('JSON Parsing');
      const parseResult = safeParseJson(rawBody);
      parsingPhase.end();
      
      if (!parseResult.success) {
        context.malformedInput = true;
        return attachMeta(getFallbackResult(`Malformed JSON input: ${parseResult.error}`));
      }

      // 2. Extraction Layer (recursively searches for string leaves)
      const extractionPhase = startPhase('Content Extraction');
      const extractionResult = extractContent(parseResult.data);
      context.noExtractableText = extractionResult.status === 'no_text_found';
      context.extractedText = extractionResult.text || '';
      context.hasCompetingCandidates = extractionResult.hasCompetingCandidates || false;
      extractionPhase.end();
    } else {
      // Direct Plain Text Processing
      const parsingPhase = startPhase('JSON Parsing');
      parsingPhase.end();

      const extractionPhase = startPhase('Content Extraction');
      context.extractedText = rawBody || '';
      context.noExtractableText = !context.extractedText.trim();
      context.hasCompetingCandidates = false;
      extractionPhase.end();
    }

    if (context.noExtractableText) {
      return attachMeta(getFallbackResult('No extractable text found.'));
    }

    // 3. Text Validation Layer (sanity limits, encoding, emptiness)
    const validationPhase = startPhase('Text Validation');
    const validationResult = validateExtractedText(context.extractedText);
    validationPhase.end();
    
    if (!validationResult.success) {
      context.noExtractableText = true;
      return attachMeta(getFallbackResult(validationResult.reason));
    }

    // 4. Pre-LLM Security Scan
    const securityPhase = startPhase('Pre-LLM Security Scan');
    context.injectionHeuristicFired = detectInjection(validationResult.text);
    securityPhase.end();

    // 5. AI Classification Layer (LLM call with corrective retries)
    const classificationPhase = startPhase('AI Classification (LLM)');
    let classificationResult;
    try {
      classificationResult = await classifyText(validationResult.text);
      classificationPhase.end();
    } catch (err) {
      classificationPhase.end();
      context.schemaValidationFailed = true;
      return attachMeta(getFallbackResult(err.message));
    }

    // 6. Reliability Checks (coercion, schema matching, contradiction evaluation)
    const reliabilityPhase = startPhase('Reliability & Contradictions');
    const validationCheck = coerceAndValidateTriageResult(classificationResult);
    context.schemaValidationFailed = !validationCheck.success;
    context.coercionTriggered = validationCheck.coercionTriggered;

    if (!validationCheck.success) {
      reliabilityPhase.end();
      return attachMeta(getFallbackResult(validationCheck.error));
    }

    const contradictionCheck = checkContradictions(validationCheck.data);
    context.contradictionDetected = contradictionCheck.contradicted;
    reliabilityPhase.end();

    // 7. Confidence & Human Escalation Gate
    const gatingPhase = startPhase('Confidence Gating');
    const gatedResult = processConfidenceGate(validationCheck.data, context);
    gatingPhase.end();

    // 8. Output Response Builder
    const builderPhase = startPhase('Response Builder');
    const response = buildResponse(gatedResult);
    builderPhase.end();

    return attachMeta(response);
  } catch (pipelineErr) {
    // Top-level pipeline crash guard
    return attachMeta(getFallbackResult(`Internal pipeline exception: ${pipelineErr.message}`));
  }
}

