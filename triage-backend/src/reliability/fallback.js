/**
 * Returns a deterministic fallback triage object with a failure-specific summary.
 * Built entirely in code with zero LLM involvement to ensure exception safety.
 *
 * @param {string} failureReason Short description of the failure.
 * @returns {Object} Structured fallback triage object.
 */
export function getFallbackResult(failureReason) {
  const cleanReason = failureReason || 'Unknown error occurred.';
  return {
    category: 'other',
    priority: 'P3',
    summary: `System fallback: ${cleanReason.slice(0, 100)}`,
    suggested_action: 'Route to human reviewer.',
    needs_human: true,
    confidence: 0.0
  };
}

/**
 * Static legacy fallback triage result.
 */
export const fallbackTriageResult = getFallbackResult('General system fallback triggered.');
