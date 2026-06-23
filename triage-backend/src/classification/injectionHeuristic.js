/**
 * Analyzes input text for common prompt injection patterns.
 * Scans for directive bypass keywords and delimiter breakout attempts.
 * 
 * @param {string} text The sanitized text to scan.
 * @returns {boolean} True if a prompt injection pattern is matched.
 */
export function detectInjection(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return false;
  }

  const normalizedText = text.toLowerCase();

  const patterns = [
    // Ignore rules/instructions/directives
    /ignore\s+.*(rules|instructions|directives|guidelines)/i,
    // You are now / acting as / system override
    /you\s+are\s+now/i,
    /system\s+(override|bypass|reset)/i,
    /acting\s+as\s+a/i,
    /new\s+instruction/i,
    // Forget instructions
    /forget\s+.*(what|everything|instructions|about)/i,
    // Disregard instructions
    /disregard\s+.*(above|below|previous|instructions|rules)/i,
    // Reveal prompt/system rules
    /reveal\s+.*prompt/i,
    // Delimiter breakout attempts
    /<<<CUSTOMER_CONTENT_START>>>/i,
    /<<<CUSTOMER_CONTENT_END>>>/i
  ];

  return patterns.some(pattern => pattern.test(normalizedText));
}
