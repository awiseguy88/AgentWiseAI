'use strict';

const readline = require('node:readline');
const { BrowserProfile } = require('./browser');
const { ProfileStore } = require('./profile');

const TOOLS = [
  {
    name: 'navigate',
    description: 'Navigate the isolated profile to a URL.',
    inputSchema: {
      type: 'object',
      properties: { profile: { type: 'string' }, url: { type: 'string' } },
      required: ['profile', 'url'],
    },
  },
  {
    name: 'click',
    description: 'Click an element by CSS selector using real input events.',
    inputSchema: {
      type: 'object',
      properties: { profile: { type: 'string' }, selector: { type: 'string' }, loginUrl: { type: 'string' } },
      required: ['profile', 'selector'],
    },
  },
  {
    name: 'type',
    description: 'Type text into an element by CSS selector using real input events.',
    inputSchema: {
      type: 'object',
      properties: { profile: { type: 'string' }, selector: { type: 'string' }, text: { type: 'string' } },
      required: ['profile', 'selector', 'text'],
    },
  },
  {
    name: 'screenshot',
    description: 'Capture a screenshot of the isolated profile page.',
    inputSchema: { type: 'object', properties: { profile: { type: 'string' } }, required: ['profile'] },
  },
  {
    name: 'extract',
    description: 'Extract the text of an element by CSS selector.',
    inputSchema: {
      type: 'object',
      properties: { profile: { type: 'string' }, selector: { type: 'string' } },
      required: ['profile', 'selector'],
    },
  },
];

class McpServer {
  constructor({ store, driver = 'fixture' }) {
    this.store = store;
    this.driver = driver;
    this.profiles = new Map();
  }

  _profile(name) {
    if (!this.profiles.has(name)) {
      this.profiles.set(name, new BrowserProfile({ store: this.store, name, driver: this.driver }));
    }
    return this.profiles.get(name);
  }

  async handle(request) {
    const { id, method, params } = request;
    if (method === 'initialize') {
      return { id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'agent-browser-isolation-runtime', version: '1.0.0' } } };
    }
    if (method === 'tools/list') return { id, result: { tools: TOOLS } };
    if (method === 'tools/call') {
      const { name, arguments: args = {} } = params || {};
      try {
        const profile = this._profile(args.profile || 'default');
        let result;
        if (name === 'navigate') result = await profile.navigate(args.url);
        else if (name === 'click') result = await profile.click(args.selector, args.loginUrl);
        else if (name === 'type') result = await profile.type(args.selector, args.text);
        else if (name === 'screenshot') result = await profile.screenshot();
        else if (name === 'extract') result = await profile.extract(args.selector);
        else throw new Error(`unknown tool: ${name}`);
        return { id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } };
      } catch (err) {
        return { id, result: { isError: true, content: [{ type: 'text', text: err.message }] } };
      }
    }
    return { id, error: { code: -32601, message: `method not found: ${method}` } };
  }

  serve(stream = process.stdin, out = process.stdout) {
    const rl = readline.createInterface({ input: stream });
    rl.on('line', async (line) => {
      if (!line.trim()) return;
      let request;
      try {
        request = JSON.parse(line);
      } catch {
        out.write(JSON.stringify({ error: { code: -32700, message: 'parse error' } }) + '\n');
        return;
      }
      const response = await this.handle(request);
      out.write(JSON.stringify(response) + '\n');
    });
  }
}

module.exports = { McpServer, TOOLS };