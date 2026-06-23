/**
 * Inspects a triage output object to identify internal contradictions between
 * category, priority, and summary text.
 *
 * @param {Object} triageResult The parsed classification output.
 * @returns {{contradicted: boolean, reason?: string}} Contradiction check result.
 */
export function checkContradictions(triageResult) {
  if (!triageResult) {
    return { contradicted: true, reason: 'Empty triage result.' };
  }

  const { category, priority, summary } = triageResult;
  const lowerSummary = (summary || '').toLowerCase();

  // 1. Billing Contradiction Check
  // If the summary explicitly references transaction/billing keywords, but the category is not billing.
  const billingKeywords = ['charge', 'bill', 'refund', 'pricing', 'invoice', 'fee', 'payment', 'cost', 'subscription'];
  const hasBillingKeywords = billingKeywords.some(kw => lowerSummary.includes(kw));
  if (hasBillingKeywords && category !== 'billing') {
    return {
      contradicted: true,
      reason: `Summary mentions billing/charges but category is "${category}" instead of "billing".`
    };
  }

  // 2. Account Access Contradiction Check
  // If the summary references authentication or credentials, but the category is not account_access.
  const accessKeywords = ['password', 'login', 'mfa', 'sign-in', 'logout', 'lockout', 'credentials', 'authenticate'];
  const hasAccessKeywords = accessKeywords.some(kw => lowerSummary.includes(kw));
  if (hasAccessKeywords && category !== 'account_access') {
    return {
      contradicted: true,
      reason: `Summary mentions access/credentials but category is "${category}" instead of "account_access".`
    };
  }

  // 3. Priority Contradiction Check
  // If the summary references critical bugs, leaks or security breaches, but priority is mapped to P3 (low).
  const severeKeywords = ['vulnerability', 'hack', 'leak', 'compromise', 'exploit', 'breach', 'security flaw', 'blocking issue'];
  const hasSevereKeywords = severeKeywords.some(kw => lowerSummary.includes(kw));
  if (hasSevereKeywords && priority === 'P3') {
    return {
      contradicted: true,
      reason: `Summary mentions severe/security issues but priority is mapped to "P3".`
    };
  }

  // 4. High confidence (>= 0.85) + hedging language in summary ("unclear", "not sure", etc.)
  const hedgingKeywords = ['unclear', 'not sure', 'unsure', 'maybe', 'unknown', 'ambiguous'];
  const hasHedgingKeywords = hedgingKeywords.some(kw => lowerSummary.includes(kw));
  if (triageResult.confidence >= 0.85 && hasHedgingKeywords) {
    return {
      contradicted: true,
      reason: `High confidence (${triageResult.confidence}) contradicts hedging words in summary: "${summary}".`
    };
  }

  // 5. priority: P0 + category: general_question/feature_request (implausible combination)
  if (priority === 'P0' && (category === 'general_question' || category === 'feature_request')) {
    return {
      contradicted: true,
      reason: `Implausible combination: Priority is P0 but category is "${category}".`
    };
  }

  return { contradicted: false };
}
