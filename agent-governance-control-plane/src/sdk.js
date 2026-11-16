// Agent-side SDK: wraps a fixture agent with the governance middleware.
// Usage:
//   import { createGovernedAgent } from './sdk.js';
//   const agent = createGovernedAgent({ agentId: 'agent-1', agentName: 'fixture-1' });
//   const res = await agent.callTool('SELECT', { query: 'SELECT * FROM users' });
//   // res: { outcome: 'pass', result, auditId } | { outcome: 'block', reason, auditId }
//   //      | { outcome: 'approval', approvalId, reason, auditId }

import { createMiddleware } from './middleware.js';
import { createFixtureAgent } from './fixture-agent.js';

export function createGovernedAgent({ agentId, agentName, onDecision } = {}) {
  const fixture = createFixtureAgent(agentId || 'fixture-agent-1');
  const middleware = createMiddleware({ agentId: fixture.id, agentName: agentName || fixture.id, onDecision });

  async function callTool(tool, args) {
    return middleware.intercept(tool, args, (a) => fixture.execute(tool, a));
  }

  return { id: fixture.id, callTool, fixture };
}