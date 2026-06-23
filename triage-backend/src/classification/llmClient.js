import dotenv from 'dotenv';
dotenv.config();
import { Ollama } from 'ollama';
import { z } from 'zod';
import { buildTriagePrompt } from './promptTemplate.js';
import { detectInjection } from './injectionHeuristic.js';

import { triageOutputSchema as triageSchema } from '../reliability/schemaValidator.js';

let llmClientInstance = null;

class LLMClientWrapper {
  constructor(ollamaClient) {
    this.ollama = ollamaClient;
    this.chat = {
      completions: {
        create: async ({ model, messages, response_format }) => {
          const format = response_format && response_format.type === 'json_object' ? 'json' : undefined;
          const response = await this.ollama.chat({
            model,
            messages,
            format,
          });
          return {
            choices: [
              {
                message: {
                  content: response.message.content,
                  role: response.message.role,
                }
              }
            ]
          };
        }
      }
    };
  }
}

/**
 * Initializes and returns the unified LLM client wrapped in an OpenAI-compatible interface.
 * Throws if the OLLAMA_API_KEY environment variable is missing.
 * 
 * @returns {LLMClientWrapper} The wrapped client instance.
 */
export function getLLMClient() {
  if (llmClientInstance) {
    return llmClientInstance;
  }

  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    throw new Error('OLLAMA_API_KEY is not defined in the environment variables.');
  }

  const ollama = new Ollama({
    host: 'https://ollama.com',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    }
  });

  llmClientInstance = new LLMClientWrapper(ollama);
  return llmClientInstance;
}

// Alias for backward compatibility (e.g. with existing unit tests)
export const getGroqClient = getLLMClient;

/**
 * Validates the raw JSON output string against the triage schema.
 * 
 * @param {string} rawJson The JSON string returned by the LLM.
 * @returns {{success: boolean, data?: Object, error?: string}} Validation result.
 */
export function validateResponse(rawJson) {
  try {
    const parsed = JSON.parse(rawJson);
    const result = triageSchema.safeParse(parsed);
    if (!result.success) {
      return {
        success: false,
        error: `Schema validation failed: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`
      };
    }
    return { success: true, data: result.data };
  } catch (err) {
    return {
      success: false,
      error: `Invalid JSON string: ${err.message}`
    };
  }
}

/**
 * Classifies customer text using Ollama with structured outputs and a single corrective retry loop.
 * 
 * @param {string} text The sanitized customer feedback text.
 * @param {Object} [options] Call configuration overrides.
 * @param {string} [options.model='gpt-oss:120b'] The model to use.
 * @returns {Promise<Object>} The parsed, schema-conformant triage result.
 */
export async function classifyText(text, options = {}) {
  const client = getLLMClient();
  const model = options.model || 'gpt-oss:120b';
  
  // 1. Run prompt injection heuristic check before calling the LLM
  const isInjectionSuspected = detectInjection(text);
  
  // 2. Build the triage prompt, passing isInjectionSuspected to include security warning context
  const prompt = buildTriagePrompt(text, isInjectionSuspected);

  const messages = [
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    let finalData = null;

    // 3. Initial Attempt
    const completion = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: 'json_object' }
    });

    const rawOutput = completion.choices[0]?.message?.content;
    console.log('\n--- LLM RAW RESPONSE ---');
    console.log(rawOutput);
    console.log('------------------------\n');
    const checkResult = validateResponse(rawOutput);

    if (checkResult.success) {
      finalData = checkResult.data;
    } else {
      // 4. Corrective Retry Attempt
      console.warn(`Initial triage output validation failed. Error: ${checkResult.error}. Retrying...`);

      const retryMessages = [
        ...messages,
        {
          role: 'assistant',
          content: rawOutput || ''
        },
        {
          role: 'user',
          content: `Your previous response was invalid. Error details: ${checkResult.error}. Please correct the response and return a valid JSON object matching the requested schema strictly.`
        }
      ];

      const retryCompletion = await client.chat.completions.create({
        model,
        messages: retryMessages,
        response_format: { type: 'json_object' }
      });

      const rawRetryOutput = retryCompletion.choices[0]?.message?.content;
      console.log('\n--- LLM RETRY RAW RESPONSE ---');
      console.log(rawRetryOutput);
      console.log('------------------------------\n');
      const finalCheck = validateResponse(rawRetryOutput);

      if (finalCheck.success) {
        finalData = finalCheck.data;
      } else {
        throw new Error(`AI classification failed after retry. Final validation error: ${finalCheck.error}`);
      }
    }

    // 5. Post-processing safeguard: If the pre-LLM scan hit an injection, lower confidence and force escalation
    if (isInjectionSuspected && finalData) {
      finalData.escalate = true;
      finalData.confidence = Math.min(finalData.confidence, 0.4);
    }

    return finalData;
  } catch (error) {
    // Standardize error propagation
    throw new Error(`LLM classification request failed: ${error.message}`);
  }
}

