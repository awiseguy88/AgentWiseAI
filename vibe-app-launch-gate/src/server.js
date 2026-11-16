import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { db, getUserByUsername, getUserById, createUser, listUsers } from './db.js';
import * as auth from './auth.js';
import * as policy from './policy.js';
import { seedUsers, seedFixtureApp } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // attach session
  app.use((req, _res, next) => {
    req.user = auth.currentSession(req);
    next();
  });

  function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    next();
  }

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Auth
  app.post('/api/register', (req, res) => {
    try {
      const { username, password, role } = req.body || {};
      if (!username || !password) return res.status(400).json({ error: 'username and password required' });
      if (getUserByUsername(username)) return res.status(409).json({ error: 'username exists' });
      const user = createUser(username, auth.hashPassword(password), role || 'developer');
      res.status(201).json({ id: user.id, username: user.username, role: user.role });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    const user = getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    try {
      if (!auth.verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
    } catch { return res.status(401).json({ error: 'Invalid credentials' }); }
    const token = auth.createSessionForUser(user.id);
    auth.setSessionCookie(res, token);
    res.json({ id: user.id, username: user.username, role: user.role });
  });

  app.post('/api/logout', (req, res) => {
    const cookies = auth.parseCookies(req.headers.cookie);
    auth.destroySession(cookies.session);
    auth.clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/me', requireAuth, (req, res) => res.json(req.user));
  app.get('/api/users', requireAuth, (_req, res) => res.json(listUsers()));

  // Apps
  app.get('/api/apps', requireAuth, (_req, res) => res.json(policy.listApps()));
  app.get('/api/apps/:id', requireAuth, (req, res) => {
    const app = policy.getApp(Number(req.params.id));
    if (!app) return res.status(404).json({ error: 'Not found' });
    res.json(app);
  });
  app.post('/api/apps', requireAuth, (req, res) => {
    try {
      const { name, owner_id, reviewer_id, audience, data_scope } = req.body || {};
      const app = policy.createApp({ name, ownerId: owner_id || req.user.id, reviewerId: reviewer_id, audience, dataScope: data_scope }, req.user);
      res.status(201).json(app);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Releases
  app.get('/api/apps/:id/releases', requireAuth, (req, res) => {
    res.json(policy.listReleases(Number(req.params.id)));
  });
  app.post('/api/apps/:id/releases', requireAuth, (req, res) => {
    try {
      const version = req.body?.version;
      const data_scope = req.body?.data_scope || req.body?.dataScope;
      if (!version || !data_scope) return res.status(400).json({ error: 'version and data_scope required' });
      const release = policy.submitRelease(Number(req.params.id), version, data_scope, req.user);
      res.status(201).json(release);
    } catch (e) { res.status(403).json({ error: e.message }); }
  });
  app.post('/api/releases/:id/approve', requireAuth, (req, res) => {
    try { res.json(policy.decideRelease(Number(req.params.id), 'approve', req.body?.note, req.user)); }
    catch (e) { res.status(403).json({ error: e.message }); }
  });
  app.post('/api/releases/:id/reject', requireAuth, (req, res) => {
    try { res.json(policy.decideRelease(Number(req.params.id), 'reject', req.body?.note, req.user)); }
    catch (e) { res.status(403).json({ error: e.message }); }
  });

  // Ownership
  app.post('/api/apps/:id/owner', requireAuth, (req, res) => {
    try {
      const { owner_id } = req.body || {};
      res.json(policy.changeOwnership(Number(req.params.id), Number(owner_id), req.user));
    } catch (e) { res.status(403).json({ error: e.message }); }
  });

  // Checklist
  app.get('/api/apps/:id/checklist', requireAuth, (req, res) => {
    const app = policy.getApp(Number(req.params.id));
    if (!app) return res.status(404).json({ error: 'Not found' });
    res.json({ checklist: app.checklist, launchGate: app.launchGate });
  });
  app.post('/api/apps/:id/checklist/confirm', requireAuth, (req, res) => {
    try { res.json(policy.confirmOwnerChecklist(Number(req.params.id), req.user)); }
    catch (e) { res.status(403).json({ error: e.message }); }
  });
  app.post('/api/apps/:id/checklist/signoff', requireAuth, (req, res) => {
    try { res.json(policy.signOffReviewerChecklist(Number(req.params.id), req.user)); }
    catch (e) { res.status(403).json({ error: e.message }); }
  });

  // CI webhook / shadow IT
  app.post('/api/ci/report', (req, res) => {
    // CI may authenticate with a token; for MVP accept optional user session or allow anonymous CI
    try {
      const result = policy.receiveCIReport(req.body || {}, 'ci-webhook', req.user || null);
      const status = result.shadowIt ? 202 : 200;
      res.status(status).json({ ...result, deploymentBlocked: result.shadowIt });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.get('/api/shadow-it', requireAuth, (_req, res) => res.json(policy.listShadowIt()));
  app.post('/api/shadow-it/:id/resolve', requireAuth, (req, res) => {
    try {
      const { action, app_id } = req.body || {};
      res.json(policy.resolveShadowIt(Number(req.params.id), action, app_id ? Number(app_id) : undefined, req.user));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Audit
  app.get('/api/audit', requireAuth, (req, res) => res.json(policy.listAudit(req.query || {})));
  app.get('/api/stats', requireAuth, (_req, res) => res.json(policy.stats()));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'vibe-app-launch-gate' }));

  // SPA fallback
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  return app;
}

export function startServer(port = process.env.PORT || 3000) {
  seedUsers();
  if (process.env.SEED_DEMO === '1' || process.env.SEED_FIXTURE === '1') {
    try { seedFixtureApp(); } catch (e) { console.error('seed fixture failed', e); }
  }
  const app = createServer();
  return app.listen(port, () => console.log(`vibe-app-launch-gate listening on ${port}`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startServer();
}