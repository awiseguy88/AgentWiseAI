import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadPricing } from './pricing.js';
import { recordUsage } from './usage.js';
import { verifySignature, handleWebhook } from './webhook.js';
import { initSchema } from './db.js';
import { mergedPrCosts, totalSpend, listRuns } from './dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const settingsPath = process.env.SETTINGS_PATH || path.join(process.cwd(), 'config', 'settings.json');
const pricingPath = process.env.PRICING_PATH || path.join(process.cwd(), 'config', 'pricing.json');

let settings, prices;

async function loadConfig() {
  settings = JSON.parse(await awaitFs(settingsPath));
  prices = loadPricing(pricingPath);
}

export { loadConfig, initSchema };

async function awaitFs(p) {
  return new Promise((resolve, reject) => {
    import('node:fs').then(({ readFile }) => readFile(p, 'utf8', (e, d) => e ? reject(e) : resolve(d)));
  });
}

export function createServer() {
  const app = express();

  // Raw body for webhook signature verification
  app.use((req, res, next) => {
    if (req.path === '/api/github-webhook') {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        req.rawBody = data;
        try { req.body = JSON.parse(data); } catch { req.body = {}; }
        next();
      });
    } else {
      express.json()(req, res, next);
    }
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'agent-outcome-meter' }));

  app.post('/api/usage', async (req, res) => {
    try {
      const events = req.body;
      const result = await recordUsage(events, prices, {
        repo: req.body.repo,
        engineer_id: req.body.engineer_id,
        team_id: req.body.team_id || settings?.default_team_id,
      });
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/github-webhook', async (req, res) => {
    try {
      const signature = req.headers['x-hub-signature-256'] || '';
      if (!verifySignature(req.rawBody, signature, settings?.webhook_secret)) {
        return res.status(401).json({ ok: false, error: 'Invalid signature' });
      }
      const event = req.headers['x-github-event'] || 'unknown';
      const result = await handleWebhook(event, req.body);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/merged-pr-costs', async (_req, res) => {
    try { res.json(await mergedPrCosts()); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/dashboard/total-spend', async (_req, res) => {
    try { res.json(await totalSpend()); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/dashboard/runs', async (req, res) => {
    try {
      const filters = { engineer_id: req.query.engineer_id, team_id: req.query.team_id };
      res.json(await listRuns(filters));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  return app;
}

function startApp() {
  const PORT = process.env.PORT || settings?.port || 3000;
  const app = createServer();
  return app.listen(PORT, () => console.log(`agent-outcome-meter listening on ${PORT}`));
}

const __main = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1] === __main) {
  loadConfig().then(() => initSchema().then(startApp)).catch(e => {
    console.error('Failed to start:', e);
    process.exit(1);
  });
}