import test from 'node:test';
import assert from 'node:assert/strict';

import { traverse } from '../src/extraction/traverse.js';
import { scoreCandidate, looksLikeHtml } from '../src/extraction/rank.js';
import { stripHtml, decodeEntities } from '../src/extraction/htmlStrip.js';
import { extractContent } from '../src/extraction/index.js';

test('JSON Content Extraction Layer Tests', async (t) => {
  
  await t.test('traverse: should extract string values with correct paths and depths', () => {
    const payload = {
      message: 'Hello world',
      metadata: {
        id: '12345',
        tags: ['urgent', 'billing']
      }
    };

    const candidates = traverse(payload, 8);
    assert.equal(candidates.length, 4);

    const msgCand = candidates.find(c => c.value === 'Hello world');
    assert.ok(msgCand);
    assert.deepEqual(msgCand.path, ['message']);
    assert.equal(msgCand.depth, 1);

    const idCand = candidates.find(c => c.value === '12345');
    assert.ok(idCand);
    assert.deepEqual(idCand.path, ['metadata', 'id']);
    assert.equal(idCand.depth, 2);
  });

  await t.test('traverse: depth boundary limitation to prevent stack overflow', () => {
    // Generate a deep object structure of 12 levels
    const deepObj = {};
    let current = deepObj;
    for (let i = 1; i <= 12; i++) {
      current.key = {};
      current = current.key;
    }
    current.message = 'too deep'; // Level 13

    const candidates = traverse(deepObj, 8);
    // Depth limit is 8, level 13 should be ignored
    const found = candidates.find(c => c.value === 'too deep');
    assert.equal(found, undefined);
  });

  await t.test('traverse: cycle detection prevents infinite loops', () => {
    const cycle = { name: 'cycle' };
    cycle.self = cycle;

    // Should complete successfully without stack overflow
    const candidates = traverse(cycle, 8);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].value, 'cycle');
  });

  await t.test('scoreCandidate: metadata penalty vs content boost vs length boost', () => {
    const candMetadata = { value: 'normal text', path: ['user_id'], depth: 1 };
    const candContent = { value: 'normal text', path: ['message_body'], depth: 1 };
    const candNeutral = { value: 'normal text', path: ['some_other_key'], depth: 1 };

    const scoreMeta = scoreCandidate(candMetadata, 8);
    const scoreCont = scoreCandidate(candContent, 8);
    const scoreNeut = scoreCandidate(candNeutral, 8);

    // Cont should be boosted, Meta penalized, Neutral in between
    assert.ok(scoreCont > scoreNeut);
    assert.ok(scoreNeut > scoreMeta);
  });

  await t.test('scoreCandidate: URL/UUID/Timestamp penalty', () => {
    const urlCand = { value: 'https://google.com/search?q=123', path: ['content'], depth: 1 };
    const uuidCand = { value: '123e4567-e89b-12d3-a456-426614174000', path: ['content'], depth: 1 };
    const dateCand = { value: '2026-06-23T06:51:37Z', path: ['content'], depth: 1 };
    const textCand = { value: 'This is actual customer feedback text.', path: ['content'], depth: 1 };

    const urlScore = scoreCandidate(urlCand, 8);
    const uuidScore = scoreCandidate(uuidCand, 8);
    const dateScore = scoreCandidate(dateCand, 8);
    const textScore = scoreCandidate(textCand, 8);

    // Identifiers must be penalized compared to prose
    assert.ok(textScore > urlScore);
    assert.ok(textScore > uuidScore);
    assert.ok(textScore > dateScore);
  });

  await t.test('scoreCandidate: shallower depth preference tie-breaker', () => {
    const shallow = { value: 'same text', path: ['text'], depth: 1 };
    const deep = { value: 'same text', path: ['text'], depth: 5 };

    const scoreShallow = scoreCandidate(shallow, 8);
    const scoreDeep = scoreCandidate(deep, 8);

    assert.ok(scoreShallow > scoreDeep);
  });

  await t.test('looksLikeHtml: basic tag detection works', () => {
    assert.equal(looksLikeHtml('Normal text'), false);
    assert.equal(looksLikeHtml('This is <b>bold</b> text'), true);
    assert.equal(looksLikeHtml('<div class="test">nested</div>'), true);
    assert.equal(looksLikeHtml('Check out <https://example.com>'), false); // Not HTML tag
  });

  await t.test('stripHtml & decodeEntities: clean markup and decode entities', () => {
    const rawHtml = '<div>Hello &amp; welcome! &lt;br&gt; Please click &#39;here&#39; to see &apos;more&apos;.</div>';
    const expected = "Hello & welcome! <br> Please click 'here' to see 'more'.";
    assert.equal(stripHtml(rawHtml), expected);
  });

  await t.test('extractContent: end-to-end extraction workflow', () => {
    const payload = {
      event_type: 'user_created',
      message: '  Please help me with my billing issue.  ',
      description: '<p>My credit card was charged twice.</p>',
      meta: {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        timestamp: '2026-06-23T06:51:37Z'
      }
    };

    const result = extractContent(payload);
    assert.equal(result.status, 'success');
    assert.equal(result.candidatesCount, 5); // event_type, message, description, id, timestamp
    
    // Should extract and concatenate the two highest scoring content fields (message and description stripped)
    // Ordered by score (length of description is short but message is also high. Let's make sure both are in the output).
    assert.ok(result.text.includes('Please help me with my billing issue.'));
    assert.ok(result.text.includes('My credit card was charged twice.'));
    // HTML tags in description must be stripped
    assert.ok(!result.text.includes('<p>'));
  });

  await t.test('extractContent: respects strict lengthCap', () => {
    const payload = {
      text: 'a'.repeat(2500)
    };

    const result = extractContent(payload, { lengthCap: 500 });
    assert.equal(result.status, 'success');
    assert.equal(result.text.length, 500);
    assert.ok(result.text.endsWith('... (truncated)'));
  });

  await t.test('extractContent: handles fallback when no text found', () => {
    const payloadOnlyIdentifiers = {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      created_at: '2026-06-23T06:51:37Z'
    };

    const result = extractContent(payloadOnlyIdentifiers);
    // Since everything is identifier/metadata, the score is highly negative, but we still have them as candidates.
    // However, if the text is empty or is not prose, does it still output them?
    // Let's verify how it handles cases with empty text or no text.
    
    const resultEmpty = extractContent({});
    assert.equal(resultEmpty.status, 'no_text_found');
    assert.equal(resultEmpty.text, null);

    const resultNull = extractContent(null);
    assert.equal(resultNull.status, 'no_text_found');
    assert.equal(resultNull.text, null);
  });
});
