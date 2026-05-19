// Anthropic client. All calls go through this file.
// Two helpers: haiku() for cheap bulk classification, sonnet() for deep evaluation.

import Anthropic from '@anthropic-ai/sdk';
import { log } from './log.js';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-6';

let _client = null;

function client() {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'Missing ANTHROPIC_API_KEY. Copy .env.example to .env.local and fill it in, ' +
      'or pass it via --env-file=.env.local.'
    );
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

function extractText(message) {
  if (!message?.content) return '';
  return message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')
    .trim();
}

function tryParseJson(text) {
  // Strip any markdown fences then parse. Models occasionally wrap JSON, and
  // sometimes the response is truncated before the closing fence.
  let body = text.trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) {
    body = fenced[1];
  } else if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '');
  }
  return JSON.parse(body);
}

async function call({ model, system, user, maxTokens, jsonOutput, temperature }) {
  const c = client();
  const res = await c.messages.create({
    model,
    max_tokens: maxTokens ?? 1024,
    temperature: temperature ?? 0,
    system,
    messages: [{ role: 'user', content: user }]
  });

  const text = extractText(res);
  if (!jsonOutput) return text;

  try {
    return tryParseJson(text);
  } catch (err) {
    log.error('claude JSON parse failed', { model, text: text.slice(0, 500) });
    throw new Error(`claude JSON parse failed for model ${model}: ${err.message}`);
  }
}

export function haiku(opts) {
  return call({ model: HAIKU_MODEL, ...opts });
}

export function sonnet(opts) {
  return call({ model: SONNET_MODEL, ...opts });
}

// Run a function over items with bounded concurrency.
// Used by the discovery scoring pass to score 20 candidates at once.
export async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
