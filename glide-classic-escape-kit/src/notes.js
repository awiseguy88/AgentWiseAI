'use strict';

const fs = require('fs');
const path = require('path');

function stripComment(line) {
  let inS = false, inD = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === '#' && !inS && !inD) return line.slice(0, i);
  }
  return line;
}

function parseScalar(v) {
  if (v == null) return '';
  v = String(v).trim();
  if (v === '') return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  // inline array [a, b]
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(s => parseScalar(s));
  }
  return v;
}

// Minimal YAML subset parser: nested maps via indentation, lists with "- "
function parseSimpleYaml(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const root = {};
  // stack of {indent, container, keyForNext?}
  const stack = [{ indent: -1, container: root }];
  for (let raw of lines) {
    const noComment = stripComment(raw);
    if (!noComment.trim()) continue;
    const indent = raw.match(/^\s*/)[0].length;
    const line = noComment.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].container;

    if (line.startsWith('- ')) {
      const valStr = line.slice(2).trim();
      if (!Array.isArray(parent)) {
        // cannot attach, skip
        continue;
      }
      if (valStr.includes(':')) {
        const idx = valStr.indexOf(':');
        const k = valStr.slice(0, idx).trim();
        const rest = valStr.slice(idx + 1).trim();
        const obj = {};
        obj[k] = rest ? parseScalar(rest) : {};
        parent.push(obj);
        if (!rest) {
          stack.push({ indent, container: obj[k] });
        } else {
          stack.push({ indent, container: obj });
        }
      } else {
        parent.push(parseScalar(valStr));
      }
      continue;
    }

    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rest = line.slice(idx + 1).trim();
    if (Array.isArray(parent)) continue;
    if (rest === '') {
      // Could be map or list; peek next significant line
      let nextIsList = false;
      // naive peek handled by later lines; default to object, but if next list item comes with greater indent and parent context expects? easier: set object, will adjust on '-'
      parent[key] = {};
      stack.push({ indent, container: parent[key] });
    } else {
      parent[key] = parseScalar(rest);
    }
  }
  // Second pass fix: objects that should be arrays? detect keys that are objects but were used as list containers incorrectly is hard; instead handle common "key:" followed by "- " by converting empty obj to array when first child push attempted — done partially. Better: reparse with lookahead for list.
  return fixArrays(root);
}

function fixArrays(node) {
  if (Array.isArray(node)) return node.map(fixArrays);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = fixArrays(v);
    }
    return out;
  }
  return node;
}

function parseSimpleYamlRobust(text) {
  // Robust pass with lookahead
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const root = {};
  const stack = [{ indent: -1, container: root, type: 'map' }];

  function nextSignificant(from) {
    for (let j = from; j < lines.length; j++) {
      const nc = stripComment(lines[j]);
      if (nc.trim()) return { indent: lines[j].match(/^\s*/)[0].length, text: nc.trim() };
    }
    return null;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const noComment = stripComment(raw);
    if (!noComment.trim()) continue;
    const indent = raw.match(/^\s*/)[0].length;
    const line = noComment.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    let ctx = stack[stack.length - 1];

    if (line.startsWith('- ')) {
      if (ctx.type !== 'list') continue;
      const valStr = line.slice(2).trim();
      if (valStr.includes(':')) {
        const cidx = valStr.indexOf(':');
        const k = valStr.slice(0, cidx).trim();
        const rest = valStr.slice(cidx + 1).trim();
        const obj = {};
        if (rest === '') {
          const ns = nextSignificant(i + 1);
          if (ns && ns.indent > indent && ns.text.startsWith('- ')) obj[k] = [];
          else obj[k] = {};
          ctx.container.push(obj);
          stack.push({ indent, container: obj[k], type: Array.isArray(obj[k]) ? 'list' : 'map' });
        } else {
          obj[k] = parseScalar(rest);
          ctx.container.push(obj);
          // allow further indented keys for same list-item object
          stack.push({ indent, container: obj, type: 'map' });
        }
      } else {
        ctx.container.push(parseScalar(valStr));
      }
      continue;
    }

    const cidx = line.indexOf(':');
    if (cidx === -1) continue;
    const key = line.slice(0, cidx).trim();
    const rest = line.slice(cidx + 1).trim();
    if (ctx.type === 'list') continue;
    if (rest === '') {
      const ns = nextSignificant(i + 1);
      if (ns && ns.indent > indent && ns.text.startsWith('- ')) {
        ctx.container[key] = [];
        stack.push({ indent, container: ctx.container[key], type: 'list' });
      } else {
        ctx.container[key] = {};
        stack.push({ indent, container: ctx.container[key], type: 'map' });
      }
    } else {
      ctx.container[key] = parseScalar(rest);
    }
  }
  return root;
}

function loadNotes(filePath) {
  if (!filePath) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  let data;
  if (ext === '.json') data = JSON.parse(text);
  else data = parseSimpleYamlRobust(text);
  return normalizeNotes(data || {});
}

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function normalizeNotes(data) {
  const notes = {
    appName: data.appName || data.app_name || data.name || '',
    description: data.description || '',
    screens: toArray(data.screens).map(s => typeof s === 'string' ? { name: s } : (s || {})),
    logic: toArray(data.logic || data.workflows || data.actions).map(s => typeof s === 'string' ? { name: s } : (s || {})),
    roles: toArray(data.roles || data.users || data.userRoles).map(s => typeof s === 'string' ? { name: s } : (s || {})),
    integrations: toArray(data.integrations),
    cost: data.cost || data.costs || data.costComparison || {},
    notes: toArray(data.notes),
    raw: data
  };
  return notes;
}

module.exports = { loadNotes, parseSimpleYamlRobust, normalizeNotes };
