import test from 'node:test';
import assert from 'node:assert/strict';
import { runTriagePipeline } from '../pipeline.js';

test('Multilingual Support (Option B) Tests', async (t) => {

  await t.test('French input: billing dispute should resolve to billing category in English', async () => {
    const rawPayload = JSON.stringify({
      subject: 'Facture',
      message: "J'ai été facturé deux fois pour mon abonnement mensuel de 15€. Veuillez me rembourser s'il vous plaît."
    });

    const result = await runTriagePipeline(rawPayload);

    // Verify category is billing
    assert.equal(result.category, 'billing');
    
    // Summary must be translated to English
    const summary = result.summary.toLowerCase();
    assert.ok(/[a-zA-Z]/.test(result.summary), 'Summary must contain English characters');
    assert.ok(
      summary.includes('charge') || 
      summary.includes('billing') || 
      summary.includes('refund') || 
      summary.includes('double') || 
      summary.includes('twice'),
      `Summary "${result.summary}" should contain English terms relating to the issue`
    );

    // Needs human because non-ASCII is flagged in the confidence gate
    assert.equal(result.needs_human, true);
  });

  await t.test('Gujarati input: login lockout should resolve to account_access in English', async () => {
    const rawPayload = JSON.stringify({
      title: 'મદદ',
      issue: "હું મારા એકાઉન્ટમાં લોગઇન નથી કરી શકતો, કૃપા કરીને પાસવર્ડ રીસેટ કરો."
    });

    const result = await runTriagePipeline(rawPayload);

    // Verify category is account_access
    assert.equal(result.category, 'account_access');
    
    // Summary must be translated to English
    const summary = result.summary.toLowerCase();
    assert.ok(/[a-zA-Z]/.test(result.summary), 'Summary must contain English characters');
    assert.ok(
      summary.includes('login') || 
      summary.includes('password') || 
      summary.includes('access') || 
      summary.includes('reset') || 
      summary.includes('account'),
      `Summary "${result.summary}" should contain English terms relating to the issue`
    );

    // Needs human because non-ASCII is flagged in the confidence gate
    assert.equal(result.needs_human, true);
  });

  await t.test('Japanese input: app crash should resolve to technical_issue in English', async () => {
    const rawPayload = JSON.stringify({
      details: "アプリが起動時にクラッシュします。画面が真っ暗になります。"
    });

    const result = await runTriagePipeline(rawPayload);

    // Verify category is technical_issue
    assert.equal(result.category, 'technical_issue');
    
    // Summary must be translated to English
    const summary = result.summary.toLowerCase();
    assert.ok(/[a-zA-Z]/.test(result.summary), 'Summary must contain English characters');
    assert.ok(
      summary.includes('crash') || 
      summary.includes('app') || 
      summary.includes('launch') || 
      summary.includes('startup') || 
      summary.includes('black') || 
      summary.includes('screen') || 
      summary.includes('error'),
      `Summary "${result.summary}" should contain English terms relating to the issue`
    );

    // Needs human because non-ASCII is flagged in the confidence gate
    assert.equal(result.needs_human, true);
  });
});
