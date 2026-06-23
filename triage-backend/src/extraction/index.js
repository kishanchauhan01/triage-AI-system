import { traverse } from './traverse.js';
import { scoreCandidate, looksLikeHtml } from './rank.js';
import { stripHtml } from './htmlStrip.js';

/**
 * Orchestrates the extraction of customer message text from an arbitrary payload.
 *
 * Steps:
 * 1. Traverses the schema-less payload (up to depth 8) to collect string candidates.
 * 2. Checks each candidate for HTML-like content and scores it using heuristics.
 * 3. Ranks the candidates.
 * 4. Extracts the top 1-2 candidates.
 * 5. Strips HTML and normalizes text for the selected candidates.
 * 6. Concatenates candidates if multiple are selected.
 * 7. Applies a strict length cap of 2000 characters.
 * 8. Returns a clean text block or a 'no_text_found' status signal.
 *
 * @param {*} payload The raw incoming event payload (expected to be already parsed).
 * @param {Object} options Configuration overrides.
 * @param {number} [options.maxDepth=8] Max depth to traverse.
 * @param {number} [options.lengthCap=2000] Maximum characters for final output.
 * @returns {{text: string|null, status: string, candidatesCount: number}} Result object.
 */
export function extractContent(payload, options = {}) {
  const maxDepth = options.maxDepth !== undefined ? options.maxDepth : 8;
  const lengthCap = options.lengthCap !== undefined ? options.lengthCap : 2000;

  if (payload === null || payload === undefined) {
    return { text: null, status: 'no_text_found', candidatesCount: 0 };
  }

  // 1. Traverse to find candidates
  const rawCandidates = traverse(payload, maxDepth);
  if (rawCandidates.length === 0) {
    return { text: null, status: 'no_text_found', candidatesCount: 0 };
  }

  // 2. Score candidates and identify HTML content
  const scoredCandidates = rawCandidates.map(cand => {
    const isHtml = looksLikeHtml(cand.value);
    const score = scoreCandidate(cand, maxDepth);
    return {
      ...cand,
      isHtml,
      score
    };
  });

  // 3. Sort candidates by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  // 4. Select top 1-2 candidates
  const topCandidates = scoredCandidates.slice(0, 2);

  // 5. Clean candidates (strip HTML if necessary) and compile
  const textParts = [];
  for (const cand of topCandidates) {
    let cleanText = cand.value;
    if (cand.isHtml) {
      cleanText = stripHtml(cleanText);
    } else {
      cleanText = cleanText.trim();
    }

    if (cleanText) {
      textParts.push(cleanText);
    }
  }

  // 6. Concatenate with a standard separator
  let concatenatedText = textParts.join('\n---\n').trim();

  // 7. Check if anything is left
  if (!concatenatedText) {
    return { text: null, status: 'no_text_found', candidatesCount: scoredCandidates.length };
  }

  // 8. Apply strict length cap
  if (concatenatedText.length > lengthCap) {
    const suffix = '... (truncated)';
    if (lengthCap > suffix.length) {
      concatenatedText = concatenatedText.slice(0, lengthCap - suffix.length) + suffix;
    } else {
      concatenatedText = concatenatedText.slice(0, lengthCap);
    }
  }

  const hasCompetingCandidates = scoredCandidates.length >= 2 && (scoredCandidates[0].score - scoredCandidates[1].score) < 2.0;

  return {
    text: concatenatedText,
    status: 'success',
    candidatesCount: scoredCandidates.length,
    hasCompetingCandidates
  };
}
