import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  listItems, upsertItem, rescopeItem, logWebhook, listWebhookLog,
} from './db.js';
import {
  getThresholds, verifySignature, computeSprawl, fixtureDiff, rescopePr,
} from './github.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createServer() {
  const app = express();
  // Capture raw body for signature verification before JSON parsing
  app.use('/api/webhooks', express.raw({ type: '*/*', limit: '10mb' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // --- Webhook ---
  app.post('/api/webhooks/github', (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const secret = process.env.WEBHOOK_SECRET;
    const raw = req.body;

    const { valid, reason } = verifySignature(secret, raw, signature);
    if (!valid) {
      logWebhook({ signature_valid: false, error: reason });
      return res.status(401).json({ error: 'Invalid or missing webhook signature' });
    }

    let payload;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      logWebhook({ signature_valid: true, error: 'invalid JSON' });
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    const event = req.headers['x-github-event'];
    const pr = payload.pull_request || payload;
    if (!event || !pr || pr.number == null) {
      logWebhook({ event, signature_valid: true, error: 'unsupported event' });
      return res.json({ status: 'ignored', reason: 'no pull_request payload' });
    }

    if (!['opened', 'reopened', 'synchronize'].includes(payload.action)) {
      logWebhook({ event, signature_valid: true });
      return res.json({ status: 'ignored', reason: `action ${payload.action}` });
    }

    const repo = payload.repository?.full_name || 'unknown/unknown';
    const thresholds = getThresholds();
    const diff = fixtureDiff(pr);
    const result = computeSprawl(diff, thresholds);

    logWebhook({ repo, event, pr_number: pr.number, signature_valid: true });

    if (!result.isSprawl) {
      return res.json({ status: 'ok', sprawl: false, ...result });
    }

    const item = upsertItem({
      repo,
      pr_number: pr.number,
      title: pr.title || `PR #${pr.number}`,
      author: pr.user?.login || 'unknown',
      html_url: pr.html_url || `https://github.com/${repo}/pull/${pr.number}`,
      lines: result.lines,
      files: result.files,
      status: 'sprawl',
    });

    return res.json({ status: 'sprawl', sprawl: true, item, ...result });
  });

  // --- Dashboard API ---
  app.get('/api/sprawl', (_req, res) => {
    res.json(listItems());
  });

  app.get('/api/config', (_req, res) => {
    res.json({ ...getThresholds(), webhookSecretConfigured: !!process.env.WEBHOOK_SECRET, githubTokenConfigured: !!process.env.GITHUB_TOKEN });
  });

  app.post('/api/sprawl/:id/rescope', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const item = listItems().find(i => i.id === id);
      if (!item) return res.status(404).json({ error: 'Item not found' });
      if (item.status === 'rescope') {
        return res.status(409).json({ error: 'Item already sent back to rescope' });
      }
      const result = await rescopePr(item.repo, item.pr_number, item.title, process.env.GITHUB_TOKEN);
      const updated = rescopeItem(id, JSON.stringify({ comment: result.comment, label: result.label, mock: result.mock }));
      res.json({ status: 'rescoped', item: updated, action: result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/webhook-log', (_req, res) => {
    res.json(listWebhookLog());
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ai-pr-review-governance-workbench' });
  });

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  return app;
}

export function startServer(port = process.env.PORT || 3000) {
  const app = createServer();
  return app.listen(port, () => console.log(`ai-pr-review-governance-workbench listening on ${port}`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startServer();
}