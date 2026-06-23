# JSON Content Extraction Layer - Code Explanation

This document explains the technical implementation of the JSON Content Extraction layer (Layer 3) located in `src/extraction`.

---

## Architecture Overview

The Content Extraction Layer extracts the most relevant human-written message text from a schema-less JSON object. This isolates the downstream LLM from parsing errors and prompt injection vectors.

```
       JSON Payload
            │
            ▼
    [ traverse.js ]   ◄─── Recurses arrays/objects (Max Depth: 8, Cycle Detection)
            │
            ▼
    [   rank.js   ]   ◄─── Heuristic scoring (Terms, UUIDs, URLs, Timestamps, Depth)
            │
            ▼
   [ htmlStrip.js ]   ◄─── Strips tags & decodes entities
            │
            ▼
    [   index.js  ]   ◄─── Orchestrates flow & applies length cap (2000 chars)
            │
            ▼
       Clean Text
```

---

## Component Deep Dive

### 1. Recursive Traversal `traverse.js`

The recursion algorithm walks through arbitrary JSON payload trees looking for string leaves.

#### Code Details
```javascript
export function traverse(payload, maxDepth = 8) {
  const candidates = [];
  const visited = new Set();
  // ...
}
```
* **Visited Cache (`visited`)**: A `Set` storing references to every object or array that has been visited. If the traversal encounters an already visited node, it returns early to prevent infinite loops (cycle detection).
* **Depth Safeguard (`maxDepth`)**: Restricts nesting level recursion to 8 to prevent stack overflows on malicious or pathological inputs.
* **Primitive Filtering**: Only collects values of type `'string'`. All other primitives (numbers, booleans, null, symbols, functions) are ignored.

---

### 2. Heuristic Scoring & HTML Detection ([rank.js](file:///home/kishan/kishan/AI_BUILDER_HACKATHON/triage-backend/src/extraction/rank.js))

Once all candidate strings are gathered, they are evaluated to separate metadata/identifying keys from prose.

#### Scoring Rules
1. **Key Name Matches**:
   * If the immediate key name (last segment of the JSON path) matches metadata terms (`id`, `type`, `timestamp`, `status`, `sender_id`), it receives a **-10 penalty**.
   * If it does not match metadata but matches content terms (`text`, `message`, `description`, `content`, `body`, `value`, `html`), it receives a **+10 boost**.
2. **Length Boost**:
   * A weak positive boost is applied: `Math.min(value.length * 0.05, 5)`. This caps the length reward to `+5` points, allowing short meaningful messages (e.g. "Help.") to compete with long structural strings.
3. **Identifier Penalty**:
   * Evaluates if the candidate value is an identifier using regexes for **UUIDs, URLs, ISO dates, or Unix timestamps**. If matched, it receives a **-15 penalty**.
4. **Depth Preference**:
   * A tie-breaker boost of up to `0.8` is added for shallower values: `(maxDepth - depth) * 0.1`.
5. **looksLikeHtml**:
   * Validates if HTML-like markup tags are present using `/<\/?[a-z][a-z0-9-]*[\s>/]/i`. This regex is optimized to ignore markdown/text bracketed URLs like `<https://example.com>`.

---

### 3. HTML Stripping & Entity Decoding ([htmlStrip.js](file:///home/kishan/kishan/AI_BUILDER_HACKATHON/triage-backend/src/extraction/htmlStrip.js))

Provides lightweight, dependency-free text cleaning to remove markup noise.

#### Code Details
```javascript
export function stripHtml(htmlStr) {
  let text = htmlStr.replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text);
  return text.replace(/\s+/g, ' ').trim();
}
```
* **Tag Strip**: Replaces any HTML tags matching `/<[^>]+>/` with spaces.
* **decodeEntities**: Translates common character reference tags (`&amp;` -> `&`, `&lt;` -> `<`, etc.) and numerical Unicode characters (`&#39;` -> `'`) using custom parsing maps.
* **Whitespace Normalization**: Collapses all multiple spaces or newlines into a single space and trims the output.

---

### 4. Orchestration Pipeline ([index.js](file:///home/kishan/kishan/AI_BUILDER_HACKATHON/triage-backend/src/extraction/index.js))

The entry function (`extractContent`) coordinates the components and enforces outputs.

#### Code Details
1. **Initial Boundary Checks**: Verifies if the payload is empty (null or undefined) and immediately flags `no_text_found`.
2. **Candidate Selection**: Sorts the list of candidates by score descending and extracts the **top 1–2 candidates**.
3. **HTML Post-processing**: Applies HTML tag stripping and character decoding if the chosen candidates were flagged.
4. **Concatenation**: Combines candidates using the `\n---\n` separator.
5. **Length Capping**: If the combined text exceeds the limit (default: 2000 chars), it trims it to size and appends `"... (truncated)"`.
6. **Graceful Fallbacks**: If no text remains, it returns an explicit fallback signal:
   ```json
   {
     "text": null,
     "status": "no_text_found",
     "candidatesCount": 0
   }
   ```
