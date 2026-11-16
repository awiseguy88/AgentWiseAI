import { evaluateToolCall } from './policy.js';
import { createApproval } from './approvals.js';
import { recordAudit } from './audit.js';
import { getAgent, registerAgent } from './db.js';

// Decision outcomes returned to the agent SDK:
//   { outcome: 'pass', result }   — allowed; result is the tool's return value
//   { outcome: 'block', reason }  — blocked; no side effect
//   { outcome: 'approval', approvalId, reason } — queued for approval; agent must wait

export function createMiddleware({ agentId, agentName, onDecision }) {
  if (agentId) registerAgent(agentId, agentName || agentId);

  async function intercept(tool, args, execute) {
    const agent = getAgent(agentId) || { id: agentId, name: agentName };
    const evalResult = evaluateToolCall(tool, args);

    if (evalResult.decision === 'allow') {
      const result = await execute(args);
      const audit = recordAudit({
        agent_id: agent.id,
        tool: tool,
        args,
        risk_class: evalResult.riskClass,
        decision: 'pass',
        reason: evalResult.reason,
      });
      if (onDecision) onDecision({ outcome: 'pass', tool, riskClass: evalResult.riskClass, auditId: audit.id });
      return { outcome: 'pass', result, auditId: audit.id };
    }

    if (evalResult.decision === 'block') {
      const audit = recordAudit({
        agent_id: agent.id,
        tool: tool,
        args,
        risk_class: evalResult.riskClass,
        decision: 'block',
        reason: evalResult.reason,
      });
      if (onDecision) onDecision({ outcome: 'block', tool, riskClass: evalResult.riskClass, reason: evalResult.reason, auditId: audit.id });
      return { outcome: 'block', reason: evalResult.reason, auditId: audit.id };
    }

    if (evalResult.decision === 'require-approval') {
      const approval = createApproval({
        agent_id: agent.id,
        tool,
        args,
        risk_class: evalResult.riskClass,
      });
      const audit = recordAudit({
        agent_id: agent.id,
        tool: tool,
        args,
        risk_class: evalResult.riskClass,
        decision: 'approval',
        reason: evalResult.reason,
        approval_id: approval.id,
      });
      if (onDecision) onDecision({ outcome: 'approval', tool, riskClass: evalResult.riskClass, approvalId: approval.id, auditId: audit.id });
      return { outcome: 'approval', approvalId: approval.id, reason: evalResult.reason, auditId: audit.id };
    }

    const audit = recordAudit({
      agent_id: agent.id, tool, args,
      risk_class: evalResult.riskClass,
      decision: 'block',
      reason: `Unknown policy decision: ${evalResult.decision}`,
    });
    return { outcome: 'block', reason: `Unknown policy decision: ${evalResult.decision}`, auditId: audit.id };
  }

  return { intercept };
}