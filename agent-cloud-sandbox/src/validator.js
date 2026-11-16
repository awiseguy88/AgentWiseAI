'use strict';

// Agent-ready parameter validation. Detects hallucinated/invalid parameters and
// corrects them to real emulator-supported values so agents stop inventing
// configuration flags that fail in production. Produces a structured correction
// report the agent can consume.

const SUPPORTED_REGIONS = new Set(['us-east-1', 'us-west-2', 'eu-west-1']);
const SUPPORTED_SERVICES = new Set(['dynamodb', 'lambda', 'sqs', 'stepfunctions']);
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_ENDPOINT = 'http://localhost:4566';

// Known service name typos/hallucinations an agent might invent.
const SERVICE_CORRECTIONS = {
  dynamodb: 'dynamodb', dynamo: 'dynamodb', 'dynamo-db': 'dynamodb',
  lambda: 'lambda', lambdas: 'lambda',
  sqs: 'sqs', 'simple-queue-service': 'sqs',
  stepfunctions: 'stepfunctions', 'step-functions': 'stepfunctions', sfn: 'stepfunctions',
};

function normalizeService(service) {
  if (!service) return { corrected: 'lambda', correction: 'service was missing; defaulted to lambda' };
  const s = String(service).toLowerCase().trim();
  if (SUPPORTED_SERVICES.has(s)) return { corrected: s, correction: null };
  if (SERVICE_CORRECTIONS[s]) return { corrected: SERVICE_CORRECTIONS[s], correction: `service "${service}" corrected to "${SERVICE_CORRECTIONS[s]}"` };
  return { corrected: null, correction: `unsupported service "${service}"` };
}

function validateRegion(region) {
  if (!region) return { corrected: DEFAULT_REGION, correction: `region was missing; defaulted to ${DEFAULT_REGION}` };
  if (SUPPORTED_REGIONS.has(String(region))) return { corrected: region, correction: null };
  return { corrected: DEFAULT_REGION, correction: `region "${region}" not supported by local emulator; corrected to ${DEFAULT_REGION}` };
}

function validateEndpoint(endpoint, service) {
  if (!endpoint) return { corrected: DEFAULT_ENDPOINT, correction: null };
  const e = String(endpoint);
  if (e.startsWith('http://localhost') || e.startsWith('http://127.0.0.1')) return { corrected: e, correction: null };
  if (e.startsWith('https://') || e.includes('.amazonaws.com')) {
    return { corrected: DEFAULT_ENDPOINT, correction: `endpoint "${e}" is live AWS; corrected to local emulator ${DEFAULT_ENDPOINT}` };
  }
  return { corrected: DEFAULT_ENDPOINT, correction: `endpoint "${endpoint}" not usable offline; corrected to ${DEFAULT_ENDPOINT}` };
}

function validateTableName(table) {
  if (!table) return { corrected: 'agent-table', correction: 'table name was missing; defaulted to agent-table' };
  const t = String(table);
  if (/^[a-zA-Z0-9_.-]{3,255}$/.test(t)) return { corrected: t, correction: null };
  return { corrected: null, correction: `table name "${t}" is not emulator-supported (3-255 alphanumeric/._-)` };
}

function validateQueueName(queue) {
  if (!queue) return { corrected: 'agent-queue', correction: 'queue name was missing; defaulted to agent-queue' };
  const q = String(queue);
  if (/^[a-zA-Z0-9_-]{1,80}$/.test(q)) return { corrected: q, correction: null };
  return { corrected: null, correction: `queue name "${q}" is not emulator-supported (1-80 alphanumeric/_/-)` };
}

function validateStateMachineName(name) {
  if (!name) return { corrected: 'agent-state-machine', correction: 'state machine name was missing; defaulted to agent-state-machine' };
  const n = String(name);
  if (/^[a-zA-Z0-9_-]{1,80}$/.test(n)) return { corrected: n, correction: null };
  return { corrected: null, correction: `state machine name "${n}" is not emulator-supported (1-80 alphanumeric/_/-)` };
}

/**
 * Correct hallucinated parameters to emulator-supported values.
 * params may include: service, region, endpoint, table, queue, stateMachine, pk, body, input.
 * Returns { corrected: {...}, corrections: string[] }.
 */
function validate(params = {}) {
  const corrections = [];
  const service = normalizeService(params.service);
  if (service.correction) corrections.push(service.correction);

  const region = validateRegion(params.region);
  if (region.correction) corrections.push(region.correction);

  const endpoint = validateEndpoint(params.endpoint, params.service);
  if (endpoint.correction) corrections.push(endpoint.correction);

  const result = {
    service: service.corrected || 'lambda',
    region: region.corrected,
    endpoint: endpoint.corrected,
  };

  if (params.table !== undefined) {
    const tbl = validateTableName(params.table);
    if (tbl.correction) corrections.push(tbl.correction);
    result.table = tbl.corrected || 'agent-table';
  }
  if (params.queue !== undefined) {
    const q = validateQueueName(params.queue);
    if (q.correction) corrections.push(q.correction);
    result.queue = q.corrected || 'agent-queue';
  }
  if (params.stateMachine !== undefined) {
    const sm = validateStateMachineName(params.stateMachine);
    if (sm.correction) corrections.push(sm.correction);
    result.stateMachine = sm.corrected || 'agent-state-machine';
  }

  // Passthrough fields the agent intended; not corrected but surfaced.
  for (const k of ['pk', 'body', 'input', 'definition', 'payload']) {
    if (params[k] !== undefined) result[k] = params[k];
  }

  return { corrected: result, corrections };
}

module.exports = { validate, normalizeService, validateRegion, validateEndpoint, SUPPORTED_REGIONS, SUPPORTED_SERVICES, DEFAULT_REGION, DEFAULT_ENDPOINT };
