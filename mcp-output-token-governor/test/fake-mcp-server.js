'use strict';

/**
 * A recorded, offline-only fake MCP server for smoke tests and the `verify`
 * workflow. It speaks JSON-RPC 2.0 over newline-delimited stdio, responds to
 * initialize, tools/list, and tools/call. Every tool returns a large JSON
 * payload that exceeds the default 2,000-token budget so the governor must
 * truncate it.
 */

const tools = {
  search: {
    description: 'Search the codebase and return matching hits.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
  },
  list_files: {
    description: 'List files in a directory.',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
  },
  read_logs: {
    description: 'Read recent application logs.',
    inputSchema: { type: 'object', properties: { lines: { type: 'number' } } },
  },
  fetch_api: {
    description: 'Fetch data from an internal API.',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
  },
  dump_meta: {
    description: 'Dump project metadata as JSON.',
    inputSchema: { type: 'object', properties: { include: { type: 'array' } } },
  },
};

function makePayload(toolName) {
  const hits = [];
  for (let i = 0; i < 80; i++) {
    hits.push({
      id: i,
      file: `src/module_${i}.js`,
      line: 10 + i,
      match: `search hit ${i} for query in module_${i}.js at line ${10 + i}`,
      snippet: `const result = await fetch('/api/data', { method: 'GET', params: { q: 'search-hit-${i}', page: ${i}, limit: 50, offset: ${i * 50}, sort: 'desc', filter: 'active' } });`,
      metadata: {
        tokens: 42,
        bytes: 312,
        context: { before: ['line a', 'line b'], after: ['line c'] },
      },
    });
  }
  const payload = {
    tool: toolName,
    query: 'example',
    total: hits.length,
    hits,
    pagination: { page: 1, perPage: 80, pages: 1, next: null, prev: null },
    server: 'fake-recorded-mcp-server',
    timestamp: new Date().toISOString(),
    note: 'This is a recorded fake response used only for offline smoke tests and the verify workflow. It intentionally exceeds the default 2,000-token budget.',
  };
  return JSON.stringify(payload);
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function handleRequest(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'fake-recorded-mcp-server', version: '1.0.0' },
      },
    });
    return;
  }
  if (method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        tools: Object.entries(tools).map(([name, t]) => ({ name, ...t })),
      },
    });
    return;
  }
  if (method === 'tools/call') {
    const tool = (params && params.name) || 'search';
    const text = makePayload(tool);
    send({
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text }],
        isError: false,
      },
    });
    return;
  }
  send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
}

process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.jsonrpc === '2.0') handleRequest(msg);
    } catch (e) {
      // ignore malformed lines
    }
  }
});
process.stdin.on('end', () => process.exit(0));