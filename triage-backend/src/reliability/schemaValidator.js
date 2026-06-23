import { z } from 'zod';

// Zod validation schema representing Layer 7 output contract.
export const triageOutputSchema = z.object({
  category: z.enum([
    'billing',
    'account_access',
    'technical_issue',
    'complaint',
    'feature_request',
    'general_question',
    'spam',
    'other'
  ]),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  summary: z.string(),
  suggested_action: z.string(),
  escalate: z.boolean(),
  confidence: z.number().min(0.0).max(1.0)
});

/**
 * Validates a structured triage response against the Zod schema.
 * 
 * @param {Object} data The parsed triage result from the LLM.
 * @returns {Object} Safe parse result containing { success, data, error }.
 */
export function validateSchema(data) {
  return triageOutputSchema.safeParse(data);
}

/**
 * Validates and coerces invalid output fields to safe defaults.
 * Maps:
 * - Invalid category -> coerced to 'other', sets coercionTriggered.
 * - Invalid priority -> coerced to 'P3', sets coercionTriggered.
 * - Invalid/non-numeric confidence -> coerced to 0.0, sets coercionTriggered.
 * - Missing required fields -> triggers failure directly.
 * 
 * @param {Object} rawObject The parsed triage object from the model.
 * @returns {{success: boolean, data: Object|null, error: string|null, coercionTriggered: boolean}} Coercion and validation outcome.
 */
export function coerceAndValidateTriageResult(rawObject) {
  if (!rawObject || typeof rawObject !== 'object') {
    return {
      success: false,
      error: 'Input payload is not an object.',
      data: null,
      coercionTriggered: false
    };
  }

  const coerced = { ...rawObject };
  let coercionTriggered = false;

  const validCategories = ['billing', 'account_access', 'technical_issue', 'complaint', 'feature_request', 'general_question', 'spam', 'other'];
  const validPriorities = ['P0', 'P1', 'P2', 'P3'];

  // 1. Check Category
  if (!coerced.category || !validCategories.includes(coerced.category)) {
    coerced.category = 'other';
    coercionTriggered = true;
  }

  // 2. Check Priority
  if (!coerced.priority || !validPriorities.includes(coerced.priority)) {
    coerced.priority = 'P3';
    coercionTriggered = true;
  }

  // 3. Check Confidence
  const confNum = Number(coerced.confidence);
  if (isNaN(confNum) || confNum < 0.0 || confNum > 1.0) {
    coerced.confidence = 0.0;
    coercionTriggered = true;
  } else {
    coerced.confidence = confNum;
  }

  // 4. Missing required fields check (e.g. summary, suggested_action, escalate)
  const requiredFields = ['summary', 'suggested_action', 'escalate'];
  const missingField = requiredFields.some(field => coerced[field] === undefined || coerced[field] === null);
  if (missingField) {
    return {
      success: false,
      error: `Missing required fields from output: ${requiredFields.filter(f => coerced[f] === undefined || coerced[f] === null).join(', ')}`,
      data: null,
      coercionTriggered
    };
  }

  // 5. Final Schema validation
  const zodResult = validateSchema(coerced);
  if (!zodResult.success) {
    return {
      success: false,
      error: `Schema validation failed: ${zodResult.error.message}`,
      data: null,
      coercionTriggered
    };
  }

  return {
    success: true,
    data: zodResult.data,
    error: null,
    coercionTriggered
  };
}
