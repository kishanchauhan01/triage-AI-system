/**
 * Safely parses a JSON string, guaranteeing that it will never throw an exception.
 *
 * @param {string} rawBody The raw request body string.
 * @returns {{success: boolean, data?: Object, error?: string}} Parse outcome.
 */
export function safeParseJson(rawBody) {
  if (typeof rawBody !== 'string') {
    return {
      success: false,
      error: `Input is not a string (type: ${typeof rawBody}).`
    };
  }

  try {
    const data = JSON.parse(rawBody);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
