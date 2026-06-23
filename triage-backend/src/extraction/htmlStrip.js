/**
 * Decodes common HTML entities (e.g. &amp;, &lt;, &gt;, &quot;, &#39;, &apos;) to their text characters.
 *
 * @param {string} str The string to decode.
 * @returns {string} The decoded string.
 */
export function decodeEntities(str) {
  if (typeof str !== 'string') return '';
  
  const entities = {
    'amp': '&',
    'lt': '<',
    'gt': '>',
    'quot': '"',
    'apos': "'",
    '#39': "'"
  };

  return str.replace(/&(#?[a-z0-9]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (entities[lower]) {
      return entities[lower];
    }
    if (lower.startsWith('#')) {
      const code = parseInt(lower.slice(1), 10);
      if (!isNaN(code)) {
        return String.fromCharCode(code);
      }
    }
    return match;
  });
}

/**
 * Strips HTML tags using standard regex and decodes standard entities.
 * Normalizes all whitespace blocks.
 *
 * @param {string} htmlStr The HTML string to process.
 * @returns {string} Clean plain text.
 */
export function stripHtml(htmlStr) {
  if (typeof htmlStr !== 'string') return '';

  // Replace HTML tags with space
  let text = htmlStr.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = decodeEntities(text);

  // Normalize multiple spaces/newlines to a single space
  return text.replace(/\s+/g, ' ').trim();
}
