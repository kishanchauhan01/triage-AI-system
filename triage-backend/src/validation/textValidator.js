/**
 * Validates the extracted customer message string.
 * Ensures the text:
 * - Is not empty.
 * - Does not exceed the length limits (prevents DoS via huge messages to LLM).
 * - Has valid encoding (contains no replacement character sequences \uFFFD).
 *
 * @param {string} text The extracted customer text.
 * @param {number} [maxLength=10000] Maximum string length allowed.
 * @returns {{success: boolean, text?: string, reason?: string}} Validation result.
 */
export function validateExtractedText(text, maxLength = 10000) {
  if (text === null || text === undefined) {
    return { success: false, reason: 'Extracted text is null or undefined.' };
  }

  const cleanText = text.trim();

  if (cleanText.length === 0) {
    return { success: false, reason: 'Extracted text is empty.' };
  }

  if (cleanText.length > maxLength) {
    return { success: false, reason: `Extracted text length (${cleanText.length}) exceeds the safety ceiling (${maxLength}).` };
  }

  // Check for unicode replacement character \uFFFD (shows encoding conversion failures or binary junk)
  if (cleanText.includes('\uFFFD')) {
    return { success: false, reason: 'Extracted text contains invalid Unicode sequences.' };
  }

  return { success: true, text: cleanText };
}
