'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const { createProvider } = require('./providers');
const { openStore, ensureInbox, getInbox, listMessages, listSweeps, getLatestSweep, listAuditLog, logEvent, markProcessed } = require('./storage');
const { runSweep } = require('./reconcile');
const { enqueueFailure, retryEntry, resolveEntry } = require('./deadletter');

const APP_ROOT = path.resolve(__dirname, '..');
const WEB_ROOT = path.join(APP_ROOT, 'web');

function buildServer(config) {
  const db = openStore(config.dataDir);

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://localhost:${config.port}`);
    const pathname = u.pathname;
    const send = (code, body, type = 'application/json') => {
      res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
      res.end(body);
    };

    try {
      if (pathname === '/api/config') {
        send(200, JSON.stringify({
          provider: config.provider,
          inbox: config.inbox,
          processed_label: config.processedLabel,
          webhook_token_configured: !!config.webhookToken,
          gmail_client_configured: !!config.gmailClientId,
          outlook_client_configured: !!config.outlookClientId,
        }));
      } else if (pathname === '/api/dashboard') {
        const inboxId = u.searchParams.get('inbox') || config.inbox;
        const latest = getLatestSweep(db, inboxId);
        const allMessages = listMessages(db, inboxId);
        const processed = allMessages.filter(m => m.touched).length;
        const untouched = allMessages.filter(m => !m.touched).length;
        const failed = (require('./storage').listDeadLetter(db) || []).filter(d => d.inbox_id === inboxId && (d.status === 'pending' || d.status === 'retrying' || d.status === 'dead')).length;
        const sweeps = listSweeps(db, inboxId).slice(0, 30);
        send(200, JSON.stringify({
          inbox: inboxId,
          latest_sweep: latest,
          processed, untouched, failed, total: allMessages.length,
          sweeps,
          messages: allMessages,
        }));
      } else if (pathname === '/api/review') {
        const inboxId = u.searchParams.get('inbox') || config.inbox;
        const all = listMessages(db, inboxId).filter(m => !m.touched);
        send(200, JSON.stringify({ inbox: inboxId, untouched: all, count: all.length }));
      } else if (pathname === '/api/sweep' && req.method === 'POST') {
        const body = await readBody(req);
        const inboxId = body.inbox || config.inbox;
        const providerSpec = body.provider || config.provider;
        let inbox = getInbox(db, inboxId);
        if (!inbox) inbox = ensureInbox(db, inboxId, providerSpec.split(':')[0]);
        const provider = createProvider(providerSpec, inbox);
        const result = await runSweep(db, inbox, provider, config.processedLabel);
        send(200, JSON.stringify({ ok: true, result: { inbox: inboxId, total: result.stats.total, touched: result.stats.touched, untouched: result.stats.untouched, failed: result.stats.failed } }));
      } else if (pathname === '/api/dlq') {
        const inboxId = u.searchParams.get('inbox') || config.inbox;
        const entries = require('./storage').listDeadLetter(db).filter(d => !d.inbox_id || d.inbox_id === inboxId);
        send(200, JSON.stringify({ dead_letter: entries, count: entries.length }));
      } else if (pathname === '/api/dlq/enqueue' && req.method === 'POST') {
        const body = await readBody(req);
        const id = enqueueFailure(db, {
          message_id: body.message_id, inbox_id: body.inbox_id || config.inbox,
          agent_id: body.agent_id, action: body.action, payload: body.payload,
          error: body.error || { status: 503, message: 'Service Unavailable' },
        });
        send(200, JSON.stringify({ ok: true, id }));
      } else if (pathname === '/api/dlq/retry' && req.method === 'POST') {
        const body = await readBody(req);
        const id = Number(body.id);
        const dispatcher = async (entry) => {
          // In real use, dispatch to agent webhook. For test/demo, always succeed.
          if (entry.payload && entry.payload.mock_dispatch) {
            if (entry.payload.mock_dispatch.fail) throw new Error(entry.payload.mock_dispatch.fail);
          }
          return true;
        };
        const result = await retryEntry(db, id, dispatcher);
        send(200, JSON.stringify(result));
      } else if (pathname === '/api/dlq/resolve' && req.method === 'POST') {
        const body = await readBody(req);
        const result = resolveEntry(db, Number(body.id));
        send(200, JSON.stringify(result));
      } else if (pathname === '/api/audit') {
        const inboxId = u.searchParams.get('inbox') || config.inbox;
        send(200, JSON.stringify({ audit: listAuditLog(db, 200) }));
      } else if (pathname === '/api/agents' && req.method === 'GET') {
        const rows = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
        send(200, JSON.stringify({ agents: rows }));
      } else if (pathname === '/api/agents' && req.method === 'POST') {
        const body = await readBody(req);
        db.prepare('INSERT OR REPLACE INTO agents (id, name, webhook_url, secret, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(body.id || body.name, body.name || null, body.webhook_url || null, body.secret || null, new Date().toISOString());
        logEvent(db, 'agent_registered', 'agent', body.id || body.name, { name: body.name });
        send(200, JSON.stringify({ ok: true }));
      } else if (pathname.startsWith('/api/webhook/') && req.method === 'POST') {
        const agentId = pathname.slice('/api/webhook/'.length);
        const token = req.headers['x-webhook-token'];
        if (config.webhookToken && token !== config.webhookToken) {
          send(401, JSON.stringify({ error: 'invalid webhook token' }));
          return;
        }
        const body = await readBody(req);
        // body: { processed: [ {message_id, action, payload} ], failed: [ {message_id, error, payload} ] }
        const inboxId = body.inbox || config.inbox;
        const processed = body.processed || [];
        const failed = body.failed || [];
        let touched = 0, failedCount = 0;
        for (const p of processed) {
          if (p.message_id) {
            markProcessed(db, inboxId, p.message_id, agentId, p.action || 'processed', p.at || new Date().toISOString(), p.payload);
            touched++;
          }
        }
        for (const f of failed) {
          if (f.message_id) {
            enqueueFailure(db, {
              message_id: f.message_id, inbox_id: inboxId, agent_id: agentId,
              action: f.action, payload: f.payload,
              error: f.error || { status: 503, message: 'Service Unavailable' },
            });
            failedCount++;
          }
        }
        logEvent(db, 'webhook_received', 'agent', agentId, { touched, failed: failedCount });
        send(200, JSON.stringify({ ok: true, touched, failed: failedCount }));
      } else if (pathname === '/api/messages') {
        const inboxId = u.searchParams.get('inbox') || config.inbox;
        send(200, JSON.stringify({ inbox: inboxId, messages: listMessages(db, inboxId) }));
      } else if (pathname === '/' || pathname === '/index.html') {
        const index = path.join(WEB_ROOT, 'index.html');
        send(200, fs.existsSync(index) ? fs.readFileSync(index, 'utf8') : '<h1>Inbox Coverage Guard</h1><p>Web UI not found.</p>', 'text/html');
      } else if (pathname.startsWith('/static/')) {
        const file = path.join(WEB_ROOT, pathname.slice('/static/'.length));
        if (fs.existsSync(file)) {
          const ext = path.extname(file);
          const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/plain';
          send(200, fs.readFileSync(file, 'utf8'), type);
        } else send(404, 'not found');
      } else if (pathname === '/styles.css' || pathname === '/app.js') {
        const file = path.join(WEB_ROOT, pathname.slice(1));
        if (fs.existsSync(file)) {
          const type = pathname.endsWith('.css') ? 'text/css' : 'application/javascript';
          send(200, fs.readFileSync(file, 'utf8'), type);
        } else send(404, 'not found');
      } else {
        send(404, JSON.stringify({ error: 'not found' }));
      }
    } catch (e) {
      send(500, JSON.stringify({ error: e && e.message }));
    }
  });

  server.listen(config.port, () => console.log(`Inbox Coverage Guard dashboard: http://localhost:${config.port}`));
  return server;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = { buildServer };