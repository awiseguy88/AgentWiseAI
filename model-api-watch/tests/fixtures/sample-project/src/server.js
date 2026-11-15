const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

// Stable models that should NOT be flagged:
const STABLE_ANTHROPIC = 'claude-3-5-sonnet-20241022';
const STABLE_GOOGLE = 'gemini-2.5-flash';

// Affected: Claude Sonnet 4.5 retires Nov 30.
const anthropic = new Anthropic({ model: 'claude-sonnet-4-5' });

// Affected: whole gpt-5 family shuts down Dec 11.
const openai = new OpenAI({ model: 'gpt-5' });

async function summarize(text) {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 256,
    messages: [{ role: 'user', content: text }],
  });
  return res.content[0].text;
}

async function o3Reason(text) {
  // Affected: o3 family shuts down Dec 11.
  const res = await openai.chat.completions.create({
    model: 'o3-mini',
    messages: [{ role: 'user', content: text }],
  });
  return res.choices[0].message.content;
}

module.exports = { summarize, o3Reason, STABLE_ANTHROPIC, STABLE_GOOGLE };