/**
 * Rule pack JSON schema + normalization for agent-ontology-guardrails.
 * A rule pack describes domain entities, relations, and action constraints.
 */

const RULE_PACK_SCHEMA = {
  type: 'object',
  required: ['version', 'entities', 'actions'],
  properties: {
    version: { type: 'integer', minimum: 1 },
    entities: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['fields'],
        properties: {
          fields: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['string', 'number', 'boolean', 'enum', 'ref'] },
                required: { type: 'boolean' },
                enum: { type: 'array' },
                ref: { type: 'string' }
              },
              required: ['type']
            }
          }
        }
      }
    },
    relations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['from', 'to', 'type'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          type: { type: 'string', enum: ['hasMany', 'belongsTo', 'oneToOne'] },
          field: { type: 'string' }
        }
      }
    },
    actions: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['constraints'],
        properties: {
          description: { type: 'string' },
          constraints: {
            type: 'array',
            items: {
              type: 'object',
              required: ['rule', 'field', 'message'],
              properties: {
                rule: { type: 'string', enum: ['required', 'equals', 'min', 'max', 'enum', 'entityExists', 'relationValid', 'custom'] },
                field: { type: 'string' },
                value: {},
                message: { type: 'string' },
                entity: { type: 'string' },
                relation: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }
};

/**
 * Validate a rule pack against the schema.
 * Returns { valid: boolean, errors: string[] }
 */
function validateRulePack(pack) {
  const errors = [];
  function check(obj, schema, path = '') {
    if (schema.type === 'object' && obj !== null && typeof obj === 'object') {
      if (schema.required) {
        for (const req of schema.required) {
          if (!(req in obj)) errors.push(`${path}.${req} is required`);
        }
      }
      if (schema.properties) {
        for (const [key, val] of Object.entries(obj)) {
          if (schema.properties[key]) {
            check(val, schema.properties[key], path ? `${path}.${key}` : key);
          }
        }
      }
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        for (const [key, val] of Object.entries(obj)) {
          check(val, schema.additionalProperties, path ? `${path}.${key}` : key);
        }
      }
    } else if (schema.type === 'array' && Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        check(obj[i], schema.items, `${path}[${i}]`);
      }
    } else if (schema.type && typeof obj !== schema.type) {
      if (!(schema.type === 'integer' && Number.isInteger(obj) && typeof obj === 'number')) {
        errors.push(`${path}: expected ${schema.type}, got ${typeof obj}`);
      }
    }
    if (schema.enum && !schema.enum.includes(obj)) {
      errors.push(`${path}: value ${JSON.stringify(obj)} not in enum ${schema.enum.join(', ')}`);
    }
    if (schema.minimum !== undefined && obj < schema.minimum) {
      errors.push(`${path}: must be >= ${schema.minimum}`);
    }
  }
  check(pack, RULE_PACK_SCHEMA, 'rulePack');
  return { valid: errors.length === 0, errors };
}

/**
 * Normalize a valid rule pack into an internal model for fast validation.
 * Resolves entity references and builds lookup maps.
 */
function normalizeRulePack(pack) {
  const { valid, errors } = validateRulePack(pack);
  if (!valid) {
    throw new Error(`Invalid rule pack: ${errors.join('; ')}`);
  }
  const entities = pack.entities || {};
  const relations = pack.relations || [];
  const actions = pack.actions || {};

  // Build relation lookup
  const relationMap = new Map();
  for (const rel of relations) {
    const key = `${rel.from}.${rel.field || rel.type}`;
    relationMap.set(key, rel);
  }

  // Pre-compile action constraints
  const compiledActions = {};
  for (const [actionName, actionDef] of Object.entries(actions)) {
    compiledActions[actionName] = {
      description: actionDef.description || '',
      constraints: (actionDef.constraints || []).map(c => ({
        rule: c.rule,
        field: c.field,
        value: c.value,
        message: c.message,
        entity: c.entity,
        relation: c.relation
      }))
    };
  }

  return {
    version: pack.version,
    entities,
    relations,
    relationMap,
    actions: compiledActions
  };
}

module.exports = { RULE_PACK_SCHEMA, validateRulePack, normalizeRulePack };
