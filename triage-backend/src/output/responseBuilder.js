/**
 * Assembles the final schema-conformant JSON output response.
 *
 * @param {Object} gateOutput Output from the confidence gate.
 * @returns {{category: string, priority: string, summary: string, suggested_action: string, needs_human: boolean, confidence: number}} Schema-conformant JSON contract.
 */
export function buildResponse(gateOutput) {
  return {
    category: gateOutput.category || 'other',
    priority: gateOutput.priority || 'P3',
    summary: gateOutput.summary || '',
    suggested_action: gateOutput.suggested_action || '',
    needs_human: !!gateOutput.needs_human,
    confidence: typeof gateOutput.confidence === 'number' ? gateOutput.confidence : 0.0
  };
}
