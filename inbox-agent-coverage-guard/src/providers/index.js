'use strict';

const { MockProvider } = require('./mock');
const { GmailProvider } = require('./gmail');
const { OutlookProvider } = require('./outlook');

function createProvider(spec, inbox) {
  // spec: 'mock:<file>' | 'gmail' | 'outlook'
  if (!spec) spec = 'mock';
  if (spec === 'mock' || spec.startsWith('mock:')) {
    let file = spec.startsWith('mock:') ? spec.slice(5) : (inbox && inbox.tokens && inbox.tokens.mock_file) || '';
    return new MockProvider(file);
  }
  if (spec === 'gmail') {
    if (!inbox || !inbox.tokens) throw new Error('Gmail provider requires a connected inbox with tokens');
    return new GmailProvider(inbox.tokens, inbox.account);
  }
  if (spec === 'outlook') {
    if (!inbox || !inbox.tokens) throw new Error('Outlook provider requires a connected inbox with tokens');
    return new OutlookProvider(inbox.tokens, inbox.account);
  }
  throw new Error(`Unknown provider spec: ${spec}`);
}

module.exports = { createProvider };