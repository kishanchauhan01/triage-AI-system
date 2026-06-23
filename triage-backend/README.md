# AI-Powered Customer Triage System

## JSON Content Extraction Layer (Layer 3)

The Content Extraction Layer parses schema-less JSON payloads to locate, score, clean, and rank the primary customer message text block(s) for the downstream AI classifier.

### Features
1. **Recursive Traversal (`traverse.js`)**: Recursively walks objects and arrays up to 8 levels deep. Handles circular references using a cycle detection visited-set to prevent infinite recursion and stack overflows.
2. **Heuristic Ranking (`rank.js`)**: Evaluates candidate strings by scoring them based on key names (boosting terms like `message`/`text`, penalizing metadata/structural terms like `id`/`timestamp`), length, depth (preferring shallower paths), and patterns (penalizing UUIDs, URLs, and timestamps).
3. **HTML Stripping (`htmlStrip.js`)**: Lightweight, dependency-free regex replacement of HTML tags and entity decoding of standard symbols (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`).
4. **Orchestration (`index.js`)**: Integrates the pipeline to extract the top 1-2 scored candidates, clean HTML content, concatenate them with a `\n---\n` separator, apply a strict 2000 character limit, and return either a clean text payload or an explicit `no_text_found` signal.

### Testing
Unit tests are written using Node.js's native test runner. To execute tests:
```bash
node --test tests/extraction.test.js
```
