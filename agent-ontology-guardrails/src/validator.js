/**
 * Deterministic action validator.
 * Validates a proposed action against a normalized rule pack and context data.
 */

function getPath(obj, path) {
  if (path == null || path === '') return obj;
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function isMissing(v) {
  return v === undefined || v === null || v === '';
}

function makeViolation(rule, field, message, extra = {}) {
  return { rule, field, message, ...extra };
}

/**
 * Compile/validate rule pack structure. Throws with actionable diagnostics on malformed packs
 * or unknown entity references. Does not modify existing files.
 */
function loadAndValidatePack(pack) {
  const errors = [];
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    throw new Error('Rule pack must be a JSON object.');
  }
  if (typeof pack.version !== 'number') errors.push('rulePack.version must be a number.');
  if (!pack.entities || typeof pack.entities !== 'object' || Array.isArray(pack.entities)) {
    errors.push('rulePack.entities must be an object mapping entity names to definitions/instances.');
  }
  if (!pack.actions || typeof pack.actions !== 'object' || Array.isArray(pack.actions)) {
    errors.push('rulePack.actions must be an object mapping action types to constraints.');
  }

  const entityDefs = (pack.entities && typeof pack.entities === 'object') ? pack.entities : {};
  const entityNames = new Set(Object.keys(entityDefs));
  const relations = Array.isArray(pack.relations) ? pack.relations : [];
  const actions = (pack.actions && typeof pack.actions === 'object') ? pack.actions : {};

  // Validate relations reference known entities
  relations.forEach((rel, i) => {
    if (!rel || typeof rel !== 'object') {
      errors.push(`relations[${i}] must be an object.`);
      return;
    }
    if (!rel.from || !entityNames.has(rel.from)) errors.push(`relations[${i}].from references unknown entity "${rel.from}".`);
    if (!rel.to || !entityNames.has(rel.to)) errors.push(`relations[${i}].to references unknown entity "${rel.to}".`);
    if (!rel.type) errors.push(`relations[${i}].type is required.`);
  });

  // Validate action constraints and entity references
  for (const [actionName, def] of Object.entries(actions)) {
    if (!def || typeof def !== 'object') {
      errors.push(`actions.${actionName} must be an object.`);
      continue;
    }
    const constraints = Array.isArray(def.constraints) ? def.constraints : [];
    if (!Array.isArray(def.constraints)) errors.push(`actions.${actionName}.constraints must be an array.`);
    constraints.forEach((c, i) => {
      const prefix = `actions.${actionName}.constraints[${i}]`;
      if (!c || typeof c !== 'object') { errors.push(`${prefix} must be an object.`); return; }
      if (!c.rule) errors.push(`${prefix}.rule is required.`);
      if (!c.field) errors.push(`${prefix}.field is required.`);
      if (!c.message) errors.push(`${prefix}.message is required.`);
      if (c.entity && !entityNames.has(c.entity)) {
        errors.push(`${prefix} references unknown entity "${c.entity}".`);
      }
      if (c.compareEntity && !entityNames.has(c.compareEntity)) {
        errors.push(`${prefix} references unknown entity "${c.compareEntity}".`);
      }
      // relation references
      if (c.rule === 'relationExists' || c.relation) {
        const relName = c.relation;
        if (relName) {
          const found = relations.find(r => (r.name || `${r.from}->${r.to}`) === relName || r.from === c.entity || r.to === c.entity);
          // lenient: if relation name given, ensure it exists; if not, ensure some relation touches entity
          if (c.relation && !relations.find(r => r.name === c.relation)) {
            // allow unnamed relation matching by from/to context? require explicit name when relation specified
            errors.push(`${prefix} references unknown relation "${c.relation}".`);
          }
        }
      }
    });
  }

  if (errors.length) {
    const err = new Error(`Malformed or invalid rule pack:\n- ${errors.join('\n- ')}`);
    err.code = 'RULE_PACK_INVALID';
    err.details = errors;
    throw err;
  }

  return {
    version: pack.version,
    entities: entityDefs,
    relations,
    actions,
    data: pack.data || {}
  };
}

/**
 * Validate a proposed action. Action shape: { type, payload, context? }
 * context may provide runtime entity instances keyed by entity name/id.
 * Returns { valid, violations, actionType }
 */
function validateAction(pack, action, runtimeContext = {}) {
  const model = loadAndValidatePack(pack);
  const violations = [];
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return { valid: false, actionType: null, violations: [makeViolation('action.shape', 'action', 'Action must be an object.')] };
  }
  const actionType = action.type || action.action || action.name;
  const payload = action.payload || action.params || action;
  if (!actionType) {
    return { valid: false, actionType: null, violations: [makeViolation('action.type', 'type', 'Action type is required.')] };
  }
  const def = model.actions[actionType];
  if (!def) {
    return { valid: false, actionType, violations: [makeViolation('action.unknown', 'type', `Action type "${actionType}" is not defined in rule pack.`)] };
  }

  // Merge data sources: pack.data, runtimeContext.data, runtimeContext directly
  const data = Object.assign({}, model.data || {}, runtimeContext.data || {});
  // also allow entities passed as top-level maps in runtimeContext
  for (const [k, v] of Object.entries(runtimeContext)) {
    if (k !== 'data' && v && typeof v === 'object') data[k] = Object.assign({}, data[k] || {}, v);
  }

  function lookupEntityInstance(entityName, id) {
    const store = data[entityName];
    if (!store) return undefined;
    if (Array.isArray(store)) return store.find(x => x && (x.id === id || x[`${entityName.slice(0, -1)}Id`] === id));
    return store[id] !== undefined ? store[id] : store[String(id)];
  }

  for (const c of (def.constraints || [])) {
    const rule = c.rule;
    const field = c.field;
    const message = c.message;
    const value = getPath(payload, field);

    switch (rule) {
      case 'required':
        if (isMissing(value)) violations.push(makeViolation(rule, field, message));
        break;
      case 'equals':
        if (value !== c.value) violations.push(makeViolation(rule, field, message));
        break;
      case 'notEquals':
        if (value === c.value) violations.push(makeViolation(rule, field, message));
        break;
      case 'min':
        if (typeof value !== 'number' || value < c.value) violations.push(makeViolation(rule, field, message));
        break;
      case 'max':
        if (typeof value !== 'number' || value > c.value) violations.push(makeViolation(rule, field, message));
        break;
      case 'enum':
        if (!Array.isArray(c.value) || !c.value.includes(value)) violations.push(makeViolation(rule, field, message));
        break;
      case 'entityFieldEquals': {
        // Check field on a looked-up entity equals expected value.
        // c.entity, c.lookupField (payload field holding id), c.entityField, c.value
        const lookupId = getPath(payload, c.lookupField || field);
        const inst = lookupEntityInstance(c.entity, lookupId);
        if (!inst) {
          violations.push(makeViolation(rule, field, message, { entity: c.entity }));
        } else {
          const actual = getPath(inst, c.entityField);
          if (actual !== c.value) violations.push(makeViolation(rule, field, message, { entity: c.entity }));
        }
        break;
      }
      case 'entityFieldMax': {
        // payload field must be <= entity's field (e.g. amount <= order.total)
        const lookupId = getPath(payload, c.lookupField || c.entityIdField);
        const inst = lookupEntityInstance(c.entity, lookupId);
        if (!inst) {
          violations.push(makeViolation(rule, field, message, { entity: c.entity }));
        } else {
          const limit = getPath(inst, c.entityField);
          if (typeof value !== 'number' || typeof limit !== 'number' || value > limit) {
            violations.push(makeViolation(rule, field, message, { entity: c.entity }));
          }
        }
        break;
      }
      case 'entityExists': {
        const lookupId = getPath(payload, c.lookupField || field);
        const inst = lookupEntityInstance(c.entity, lookupId);
        if (!inst) violations.push(makeViolation(rule, field, message, { entity: c.entity }));
        break;
      }
      default:
        violations.push(makeViolation(rule, field, message || `Unsupported rule "${rule}".`));
    }
  }

  return { valid: violations.length === 0, actionType, violations };
}

module.exports = { loadAndValidatePack, validateAction };
