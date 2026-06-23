/**
 * Recursively traverses objects and arrays to locate string leaves.
 * Bounded by maxDepth to prevent pathological structures from causing stack overflow.
 * Uses a Visited Set to prevent infinite loops from circular references.
 *
 * @param {*} payload The JSON payload or part of it.
 * @param {number} maxDepth Maximum depth to traverse (default: 8).
 * @returns {Array<{value: string, path: Array<string|number>, depth: number}>} Array of extracted candidate strings.
 */
export function traverse(payload, maxDepth = 8) {
  const candidates = [];
  const visited = new Set();

  function walk(value, path, depth) {
    // constrain
    if (depth > maxDepth) {
      return;
    }

    // Base case
    if (typeof value === 'string') {
      candidates.push({
        value,
        path: [...path],
        depth,
      });
      return;
    }

    // Recurse into arrays and objects
    if (value && typeof value === 'object') { // Checking for object type
      if (visited.has(value)) {
        return;
      }
      visited.add(value);

      if (Array.isArray(value)) { // Checking for array type
        for (let i = 0; i < value.length; i++) { 
          walk(value[i], [...path, i], depth + 1);
        }
      } else {
        const keys = Object.keys(value);
        for (const key of keys) {
          walk(value[key], [...path, key], depth + 1);
        }
      }
    }
  }

  walk(payload, [], 0);
  return candidates;
}
