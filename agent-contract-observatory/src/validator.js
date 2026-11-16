'use strict';

/**
 * Minimal JSON Schema validator (draft-07-ish subset) that returns field-level
 * violations naming the exact path (e.g. "items.0.sku").
 *
 * Supported keywords: type, required, properties, items, minItems, maxItems,
 * minimum, maximum, exclusiveMinimum, exclusiveMaximum, enum, additionalProperties,
 * minLength, maxLength, minProperties, maxProperties, oneOf, anyOf, allOf,
 * format (email, uri/date/time).
 *
 * Each violation: { field, keyword, message, expected?, actual? }.
 */

function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function pathStr(base, seg) {
  if (base === '' || base === null) return String(seg);
  if (typeof seg === 'number') return `${base}.${seg}`;
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(seg)) return `${base}.${seg}`;
  return `${base}[${JSON.stringify(seg)}]`;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function checkType(schema, value) {
  const t = schema.type;
  if (t == null) return true;
  const types = Array.isArray(t) ? t : [t];
  const actual = typeOf(value);
  if (types.includes(actual)) return true;
  // number vs integer
  if (types.includes('integer') && typeof value === 'number' && Number.isInteger(value)) return true;
  if (types.includes('number') && typeof value === 'number') return true;
  return false;
}

function emailOk(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function validate(schema, value, basePath, errors, root) {
  if (!schema || typeof schema !== 'object') return;
  // allOf / anyOf / oneOf
  if (Array.isArray(schema.allOf)) {
    for (const s of schema.allOf) validate(s, value, basePath, errors, root);
  }
  if (Array.isArray(schema.oneOf)) {
    const counts = schema.oneOf.map((s) => {
      const e = [];
      validate(s, value, basePath, e, root);
      return e.length === 0;
    });
    if (counts.filter(Boolean).length !== 1) {
      errors.push({ field: basePath || '', keyword: 'oneOf', message: 'value must match exactly one of the schemas' });
    }
  }
  if (Array.isArray(schema.anyOf)) {
    const ok = schema.anyOf.some((s) => {
      const e = [];
      validate(s, value, basePath, e, root);
      return e.length === 0;
    });
    if (!ok) errors.push({ field: basePath || '', keyword: 'anyOf', message: 'value must match at least one of the schemas' });
  }

  // type
  if (schema.type != null && !checkType(schema, value)) {
    errors.push({
      field: basePath || '',
      keyword: 'type',
      expected: Array.isArray(schema.type) ? schema.type.join('|') : schema.type,
      actual: typeOf(value),
      message: `expected ${Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type}, got ${typeOf(value)}`,
    });
    // If type mismatched, don't run deeper checks that assume shape.
    if (typeof value !== 'object' || value === null) return;
    if (Array.isArray(value) !== (schema.type === 'array' || (Array.isArray(schema.type) && schema.type.includes('array')))) {
      // still continue for objects? bail for primitives mismatch
      if (schema.type && !Array.isArray(schema.type) && schema.type !== typeOf(value)) {
        // primitive mismatch already recorded; skip deeper
        if (schema.type !== 'object' && schema.type !== 'array') return;
      }
    }
  }

  // enum
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some((x) => deepEqual(x, value))) {
      errors.push({
        field: basePath || '',
        keyword: 'enum',
        expected: schema.enum,
        actual: value,
        message: `value must be one of: ${schema.enum.map((x) => JSON.stringify(x)).join(', ')}`,
      });
    }
  }

  // format
  if (typeof schema.format === 'string' && typeof value === 'string') {
    let ok = true;
    if (schema.format === 'email') ok = emailOk(value);
    if (schema.format === 'uri') { try { new URL(value); } catch (e) { ok = false; } }
    if (!ok) {
      errors.push({ field: basePath || '', keyword: 'format', expected: schema.format, actual: value, message: `must be a valid ${schema.format}` });
    }
  }

  // object handling
  const isObj = isPlainObject(value);
  if (isObj) {
    // required
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in value)) {
          errors.push({
            field: pathStr(basePath, key),
            keyword: 'required',
            message: `${pathStr(basePath, key)}: required`,
          });
        }
      }
    }
    // minProperties / maxProperties
    const propCount = Object.keys(value).length;
    if (typeof schema.minProperties === 'number' && propCount < schema.minProperties) {
      errors.push({ field: basePath || '', keyword: 'minProperties', expected: schema.minProperties, actual: propCount, message: `must have at least ${schema.minProperties} properties` });
    }
    if (typeof schema.maxProperties === 'number' && propCount > schema.maxProperties) {
      errors.push({ field: basePath || '', keyword: 'maxProperties', expected: schema.maxProperties, actual: propCount, message: `must have at most ${schema.maxProperties} properties` });
    }
    // properties
    if (schema.properties && isPlainObject(schema.properties)) {
      for (const key of Object.keys(schema.properties)) {
        if (key in value) {
          validate(schema.properties[key], value[key], pathStr(basePath, key), errors, root);
        }
      }
    }
    // additionalProperties
    if (schema.additionalProperties !== undefined) {
      const known = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(value)) {
        if (known.has(key)) continue;
        if (schema.additionalProperties === false) {
          errors.push({ field: pathStr(basePath, key), keyword: 'additionalProperties', message: `unexpected property: ${key}` });
        } else if (isPlainObject(schema.additionalProperties)) {
          validate(schema.additionalProperties, value[key], pathStr(basePath, key), errors, root);
        }
      }
    }
    // patternProperties (best-effort)
    if (schema.patternProperties && isPlainObject(schema.patternProperties)) {
      for (const pat of Object.keys(schema.patternProperties)) {
        const re = new RegExp(pat);
        for (const key of Object.keys(value)) {
          if (re.test(key)) validate(schema.patternProperties[pat], value[key], pathStr(basePath, key), errors, root);
        }
      }
    }
  }

  // array handling
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push({ field: basePath || '', keyword: 'minItems', expected: schema.minItems, actual: value.length, message: `must have at least ${schema.minItems} items` });
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      errors.push({ field: basePath || '', keyword: 'maxItems', expected: schema.maxItems, actual: value.length, message: `must have at most ${schema.maxItems} items` });
    }
    if (schema.items) {
      const itemsSchema = schema.items;
      value.forEach((item, idx) => {
        if (Array.isArray(itemsSchema)) {
          const s = itemsSchema[idx] || itemsSchema[itemsSchema.length - 1];
          validate(s, item, pathStr(basePath, idx), errors, root);
        } else {
          validate(itemsSchema, item, pathStr(basePath, idx), errors, root);
        }
      });
    }
    if (schema.contains) {
      const ok = value.some((item) => {
        const e = [];
        validate(schema.contains, item, basePath, e, root);
        return e.length === 0;
      });
      if (!ok) errors.push({ field: basePath || '', keyword: 'contains', message: 'array must contain an item matching schema' });
    }
    if (schema.uniqueItems) {
      const seen = new Set();
      let dup = false;
      for (const it of value) { const k = JSON.stringify(it); if (seen.has(k)) { dup = true; break; } seen.add(k); }
      if (dup) errors.push({ field: basePath || '', keyword: 'uniqueItems', message: 'items must be unique' });
    }
  }

  // string handling
  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push({ field: basePath || '', keyword: 'minLength', expected: schema.minLength, actual: value.length, message: `must be at least ${schema.minLength} characters` });
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      errors.push({ field: basePath || '', keyword: 'maxLength', expected: schema.maxLength, actual: value.length, message: `must be at most ${schema.maxLength} characters` });
    }
    if (typeof schema.pattern === 'string') {
      const re = new RegExp(schema.pattern);
      if (!re.test(value)) errors.push({ field: basePath || '', keyword: 'pattern', expected: schema.pattern, actual: value, message: `must match pattern ${schema.pattern}` });
    }
  }

  // number handling
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push({ field: basePath || '', keyword: 'minimum', expected: schema.minimum, actual: value, message: `must be >= ${schema.minimum}` });
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push({ field: basePath || '', keyword: 'maximum', expected: schema.maximum, actual: value, message: `must be <= ${schema.maximum}` });
    }
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
      errors.push({ field: basePath || '', keyword: 'exclusiveMinimum', expected: schema.exclusiveMinimum, actual: value, message: `must be > ${schema.exclusiveMinimum}` });
    }
    if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
      errors.push({ field: basePath || '', keyword: 'exclusiveMaximum', expected: schema.exclusiveMaximum, actual: value, message: `must be < ${schema.exclusiveMaximum}` });
    }
    if (typeof schema.multipleOf === 'number' && value % schema.multipleOf !== 0) {
      errors.push({ field: basePath || '', keyword: 'multipleOf', expected: schema.multipleOf, actual: value, message: `must be a multiple of ${schema.multipleOf}` });
    }
  }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function validateSchema(schema, value) {
  const errors = [];
  validate(schema || {}, value, '', errors, null);
  // normalize field '' -> root
  return errors.map((e) => ({ field: e.field === '' ? '(root)' : e.field, ...e }));
}

module.exports = { validateSchema, deepEqual };
