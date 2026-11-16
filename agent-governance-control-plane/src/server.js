import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadPolicy, getPolicy } from './policy.js';
import { listAudit, verifyAudit } from './audit.js';
import { listApprovals, getApproval, decideApproval } from './approvals.js';
import { registerAgent, listAgents, db } from './db.js';
import { createGovernedAgent } from './sdk.js';
import { seedAgents } from './seed.js';
import { recordAudit } from './audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In-memory registry of governed agents for the demo; SDK-style callers get one per agentId.
const agentRegistry = new Map();
function getOrCreateAgent(agentId, agentName) {
  if (!agentRegistry.has(agentId)) {
    agentRegistry.set(agentId, createGovernedAgent({ agentId, agentName: agentName || agentId }));
  }
  return agentRegistry.get(agentId);
}

export function createServer() {
  const app = express();
  app.use(express.json());

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'agent-governance-control-plane' }));

  app.get('/api/policy', (_req, res) => res.json(getPolicy()));

  app.get('/api/agents', (_req, res) => res.json(listAgents()));

  app.get('/api/approvals', (req, res) => {
    const status = req.query.status || 'pending';
    res.json(listApprovals(status));
  });

  // Recent decisions = audit_log joined-ish view (alias for dashboard)
  app.get('/api/decisions', (req, res) => {
    const filters = {};
    if (req.query.agent_id) filters.agent_id = req.query.agent_id;
    if (req.query.decision) filters.decision = req.query.decision;
    if (req.query.limit) filters.limit = req.query.limit;
    const rows = listAudit(filters);
    const decisions = rows.map(r => ({
      id: r.id,
      agent_id: r.agent_id,
      tool: r.tool,
      args: r.args ? JSON.parse(r.args) : null,
      risk_class: r.risk_class,
      decision: r.decision,
      reason: r.reason,
      approval_id: r.approval_id,
      created_at: r.created_at,
      status_label: r.decision === 'pass' ? 'pass' : r.decision === 'block' ? 'block' : r.decision === 'approval' ? 'approval' : r.decision,
    }));
    res.json(decisions);
  });

  app.get('/api/audit', (req, res) => {
    const filters = {};
    if (req.query.agent_id) filters.agent_id = req.query.agent_id;
    if (req.query.decision) filters.decision = req.query.decision;
    if (req.query.limit) filters.limit = req.query.limit;
    res.json(listAudit(filters));
  });

  app.get('/api/audit/verify', (_req, res) => {
    res.json(verifyAudit());
  });

  // SDK-style entry point: submit a tool call for interception
  app.post('/api/agents/:agentId/call', async (req, res) => {
    try {
      const { agentId } = req.params;
      const { tool, args } = req.body || {};
      if (!tool) return res.status(400).json({ error: 'tool is required' });
      const agent = getOrCreateAgent(agentId, req.body?.agentName || agentId);
      const result = await agent.callTool(tool, args || {});
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Execute an approved tool call: applies side effect (write only after approval) and logs
  app.post('/api/approvals/:id/approve', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const appr = getApproval(id);
      if (!appr) return res.status(404).json({ error: 'Approval not found' });
      if (appr.status !== 'pending') return res.status(400).json({ error: 'Approval already decided' });
      const decided = decideApproval(id, 'approved', req.body?.approver || 'approver');
      const agent = getOrCreateAgent(appr.agent_id);
      const args = appr.args ? JSON.parse(appr.args) : {};
      const result = await agent.fixture.execute(appr.tool, args);
      const audit = recordAudit({
        agent_id: appr.agent_id,
        tool: appr.tool,
        args,
        risk_class: appr.risk_class,
        decision: 'approved',
        reason: 'Approved by human approver',
        approval_id: id,
      });
      res.json({ approval: decided, result, auditId: audit.id });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/approvals/:id/reject', (req, res) => {
    try {
      const id = Number(req.params.id);
      const appr = getApproval(id);
      if (!appr) return res.status(404).json({ error: 'Approval not found' });
      if (appr.status !== 'pending') return res.status(400).json({ error: 'Approval already decided' });
      const decided = decideApproval(id, 'rejected', req.body?.approver || 'approver');
      const args = appr.args ? JSON.parse(appr.args) : {};
      // IMPORTANT: no side effect applied. We only record the rejection/denial in audit.
      const audit = recordAudit({
        agent_id: appr.agent_id,
        tool: appr.tool,
        args,
        risk_class: appr.risk_class,
        decision: 'rejected',
        reason: 'Rejected by human approver — no side effect applied',
        approval_id: id,
      });
      res.json({ approval: decided, denied: true, auditId: audit.id });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // SPA/static fallback
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  return app;
}

export function startServer(port = process.env.PORT || 3000) {
  loadPolicy();
  seedAgents();
  // create default fixture governed agent for demo
  getOrCreateAgent('fixture-agent-1', 'Fixture Coding Agent 1');
  const app = createServer();
  return app.listen(port, () => console.log(`agent-governance-control-plane listening on ${port}`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startServer();
}
