'use strict';

/**
 * Deterministic, dependency-free approximate tokenizer.
 *
 * This is intentionally simple and stable: it splits text into tokens using
 * word boundaries and punctuation, then counts them. It is not a byte-pair
 * encoder, so absolute token counts differ from model-specific tokenizers;
 * it is used only for *relative* budgeting and reporting (bytes saved, tokens
 * reclaimed, whether a result is over budget). Consistency across runs is what
 * matters, not exact equivalence to a model tokenizer.
 *
 * Tokenization rules (applied in order):
 *   1. Split on whitespace.
 *   2. Split each whitespace token on the boundary between a letter/digit
 *      run and any punctuation run (e.g. "foo,bar" -> "foo", ",", "bar").
 *   3. Count each resulting piece as one token. Empty pieces are dropped.
 */

const PUNCTUATION = /[.,;:!?(){}\[\]"'`~@#$%^&*+=|\\/<>\-]/g;

function tokenize(text) {
  if (text == null) return [];
  const str = String(text);
  const tokens = [];
  const words = str.split(/\s+/);
  for (const word of words) {
    if (word.length === 0) continue;
    // Split on the boundary between a run of word characters and a run of
    // punctuation characters, keeping the punctuation as its own token.
    const pieces = word.replace(PUNCTUATION, (p) => ' ' + p + ' ').split(/\s+/);
    for (const piece of pieces) {
      if (piece.length > 0) tokens.push(piece);
    }
  }
  return tokens;
}

function countTokens(text) {
  return tokenize(text).length;
}

module.exports = { tokenize, countTokens };