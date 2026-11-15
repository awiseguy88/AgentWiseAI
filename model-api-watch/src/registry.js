#!/usr/bin/env node
'use strict';

// Bundled, dated list of known LLM API price changes and deprecations.
// Updated offline by the tool author; the CLI never calls a network.
// Dates are ISO-8601 (YYYY-MM-DD) in UTC.

const REGISTRY = [
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    change: 'deprecation',
    effectiveDate: '2026-11-30',
    oldPrice: 'Active',
    newPrice: 'Retired (fails)',
    replacement: 'claude-sonnet-4-5-20261101',
    costImpact: 'Migration required; no extra cost if replaced before Nov 30.',
    note: 'Retires Nov 30. Hard-coded calls begin failing after that date.',
  },
  {
    id: 'gemini-4-carbon',
    name: 'Gemini 4 Carbon',
    change: 'price_increase',
    effectiveDate: '2026-12-01',
    oldPrice: '$1.50 / 1M input',
    newPrice: '$3.00 / 1M input',
    replacement: 'gemini-4-carbon-20261201',
    costImpact: 'Input cost doubles (+$1.50/1M) on Dec 1.',
    note: 'Price doubles Dec 1.',
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    change: 'price_increase',
    effectiveDate: '2026-12-01',
    oldPrice: '$2.00 / 1M input',
    newPrice: '$4.00 / 1M input',
    replacement: 'gemini-4-argon-20261201',
    costImpact: 'Input cost doubles (+$2.00/1M) on Dec 1.',
    note: 'Price doubles Dec 1.',
  },
  {
    id: 'gpt-5',
    name: 'OpenAI gpt-5 family',
    change: 'shutdown',
    effectiveDate: '2026-12-11',
    oldPrice: 'Active',
    newPrice: 'Endpoint shut down (fails)',
    replacement: 'gpt-5.6-sol',
    costImpact: 'All gpt-5/* calls break Dec 11; replace with gpt-5.6-sol.',
    note: 'OpenAI shuts down the whole gpt-5/o3 family on Dec 11.',
  },
  {
    id: 'o3',
    name: 'OpenAI o3 family',
    change: 'shutdown',
    effectiveDate: '2026-12-11',
    oldPrice: 'Active',
    newPrice: 'Endpoint shut down (fails)',
    replacement: 'o4-mini',
    costImpact: 'All o3/* calls break Dec 11; replace with o4-mini.',
    note: 'OpenAI shuts down the whole gpt-5/o3 family on Dec 11.',
  },
  {
    id: 'gpt-5.6-sol',
    name: 'OpenAI gpt-5.6-sol',
    change: 'price_increase',
    effectiveDate: '2027-01-01',
    oldPrice: '$1.25 / 1M input',
    newPrice: '$2.50 / 1M input',
    replacement: 'gpt-5.6-sol-20270101',
    costImpact: 'Input cost doubles (+$1.25/1M) on Jan 1.',
    note: 'Price doubles Jan 1.',
  },
];

// Lookup helpers. `id` is matched exactly, or as a prefix so that
// provider-family entries (e.g. gpt-5, o3) catch every member.

function findEntry(modelId) {
  if (!modelId) return null;
  const lower = modelId.toLowerCase();
  return REGISTRY.find(entry => lower === entry.id || lower.startsWith(entry.id + '-')) || null;
}

function allEntries() {
  return REGISTRY.slice();
}

module.exports = { REGISTRY, findEntry, allEntries };