/**
 * Heuristically scores a candidate string to determine if it is the primary customer message.
 *
 * Scoring breakdown:
 * - Metadata keys match (e.g., id, type, timestamp, status, sender_id): -10 points.
 * - Content keys match (e.g., text, message, description, content, body, value, html) (if not metadata): +10 points.
 * - String length: Weak positive, capped at +5.
 * - Looks like URL, UUID, or timestamp: Strong negative penalty (-15 points).
 * - Depth (shallower is preferred): Mild positive tie-breaker (+0.1 per level shallower than maxDepth).
 *
 * @param {{value: string, path: Array<string|number>, depth: number}} candidate The candidate to score.
 * @param {number} maxDepth The maximum depth used in traversal (default: 8).
 * @returns {number} The heuristic score.
 */
export function scoreCandidate(candidate, maxDepth = 8) {
  const { value, path, depth } = candidate;
  let score = 0;

  // 1. Key name matches
  if (path && path.length > 0) {
    const immediateKey = String(path[path.length - 1]).toLowerCase();

    const metadataTerms = ['id', 'type', 'timestamp', 'status', 'sender_id'];
    const contentTerms = ['text', 'message', 'description', 'content', 'body', 'value', 'html'];

    const matchesMetadata = metadataTerms.some(term => immediateKey.includes(term));
    const matchesContent = contentTerms.some(term => immediateKey.includes(term));

    if (matchesMetadata) {
      score -= 10;
    } else if (matchesContent) {
      score += 10;
    }
  }

  // 2. String length: Weak positive capped boost (length * 0.05 up to a max of +5)
  score += Math.min(value.length * 0.05, 5);

  // 3. Exclude identifiers (URL, UUID, Timestamp)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const isURL = /^https?:\/\/[^\s]+$/i.test(value);
  const isISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(value);
  const isUnixTimestamp = /^\d{10,13}$/.test(value);

  if (isUUID || isURL || isISO || isUnixTimestamp) {
    score -= 15;
  }

  // 4. Shallower position tie-breaker
  const depthBoost = Math.max(0, (maxDepth - depth) * 0.1);
  score += depthBoost;

  return score;
}

/**
 * Checks if the string value contains HTML-like markup.
 *
 * @param {string} value The string to test.
 * @returns {boolean} True if the string looks like HTML.
 */
export function looksLikeHtml(value) {
  if (typeof value !== 'string') return false;
  return /<\/?[a-z][a-z0-9-]*[\s>/]/i.test(value);
}
