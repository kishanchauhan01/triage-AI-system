/**
 * Evaluates and adjusts classification confidence by triangulating LLM self-reported
 * confidence against independent deterministic indicators, applying threshold gating,
 * and checking hard escalation flags.
 *
 * @param {Object} triageResult The parsed classification object from the model.
 * @param {Object} context Metadata context from ingestion, parsing, extraction, and validation.
 * @param {string} [context.extractedText] The raw extracted customer text.
 * @param {boolean} [context.hasCompetingCandidates] True if extraction had close candidate scores.
 * @param {boolean} [context.injectionHeuristicFired] True if injection check flagged potential attack.
 * @param {boolean} [context.malformedInput] True if JSON parsing of raw input failed.
 * @param {boolean} [context.noExtractableText] True if extraction returned no usable text.
 * @param {boolean} [context.schemaValidationFailed] True if LLM output schema validation failed.
 * @param {boolean} [context.contradictionDetected] True if field contradiction check triggered.
 * @returns {Object} Final triage output containing category, priority, summary, suggested_action, needs_human, and confidence.
 */
export function processConfidenceGate(triageResult, context = {}) {
  // Safe default values
  let category = triageResult?.category || 'other';
  let priority = triageResult?.priority || 'P3';
  let summary = triageResult?.summary || '';
  let suggested_action = triageResult?.suggested_action || '';
  let escalate = triageResult?.escalate || false;
  let confidence = triageResult?.confidence !== undefined ? triageResult.confidence : 0.0;

  const text = context.extractedText || '';

  // --- 1. Triangulation and Confidence Adjustments ---

  // A. Competing candidates: lowers confidence ceiling to 0.70 (forces escalation)
  if (context.hasCompetingCandidates) {
    confidence = Math.min(confidence, 0.70);
  }

  // B. Injection heuristic fired: caps confidence ceiling to 0.30
  if (context.injectionHeuristicFired) {
    confidence = Math.min(confidence, 0.30);
  }

  // C. Non-English / mixed-language: lowers confidence moderately to 0.60
  const hasNonAscii = /[^\x00-\x7F]/.test(text);
  if (hasNonAscii) {
    confidence = Math.min(confidence, 0.60);
  }

  // D. Multi-issue message: nudge down confidence (to 0.70) unless very high (>= 0.90)
  const isMultiIssue = /(\b(and|but|also)\b|[\.\!\?].+[\.\!\?])/i.test(text);
  if (isMultiIssue && confidence < 0.90) {
    confidence = Math.min(confidence, 0.70);
  }

  // --- 2. Hard Escalation Flags ---
  let forceEscalate = false;

  if (context.malformedInput) forceEscalate = true;
  if (context.noExtractableText) forceEscalate = true;
  if (context.schemaValidationFailed) forceEscalate = true;
  if (context.contradictionDetected) forceEscalate = true;
  if (context.coercionTriggered) forceEscalate = true;

  // Extracted text below minimum length (e.g. < 10 characters)
  if (text.trim().length < 10) {
    forceEscalate = true;
  }

  // Suspicious confidence pattern: injection heuristic fired AND model reports confidence >= 0.85
  if (context.injectionHeuristicFired && (triageResult?.confidence >= 0.85)) {
    forceEscalate = true;
  }

  // --- 3. Threshold Policy ---
  let needs_human = false;

  if (forceEscalate) {
    needs_human = true;
  } else if (confidence < 0.75) {
    // 0.40 to 0.75 is needs_human = true (plausible but unsafe)
    // < 0.40 is needs_human = true (unclassifiable)
    needs_human = true;
  } else {
    // >= 0.75 is safe, unless the model itself requested escalation
    needs_human = escalate;
  }

  return {
    category,
    priority,
    summary,
    suggested_action,
    needs_human,
    confidence: parseFloat(confidence.toFixed(2))
  };
}
