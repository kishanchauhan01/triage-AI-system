import { runTriagePipeline } from '../../pipeline.js';

/**
 * Controller to handle webhook events ingestion.
 * 
 * @param {import('express').Request} req Express request.
 * @param {import('express').Response} res Express response.
 */
export async function triageIngestController(req, res) {
  try {
    const rawBody = req.rawBody || '';
    const result = await runTriagePipeline(rawBody);
    
    // Always succeed with 200 and return the formatted JSON contract.
    // Downstream applications must never receive a crash, always a valid JSON.
    return res.status(200).json(result);
  } catch (error) {
    // Ultimate safety fallback in case of unexpected controller failure
    return res.status(200).json({
      category: 'other',
      priority: 'P3',
      summary: `System fallback: Ingestion controller exception: ${error.message}`,
      suggested_action: 'Route to human reviewer.',
      needs_human: true,
      confidence: 0.0
    });
  }
}
