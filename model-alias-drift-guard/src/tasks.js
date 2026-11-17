'use strict';

// Golden prompt set loader: bundled 30-task coding-agent fixture + user tasks.
// Each task: { id, title, tags, prompt, tools, expect }
// expect: { tool_sequence[], tool_args{name:{k:v}}, enums{...}, output_format, forbid_tools[], contains_all[], not_contains[], refusal_expected }

const fs = require('fs');
const path = require('path');

const TOOL_ROOT = path.resolve(__dirname, '..');

function loadGoldenTasks(options) {
  const opts = options || {};
  const tasks = [];
  const dirs = [path.join(TOOL_ROOT, 'tasks')];
  if (opts.userTasksDir) dirs.push(path.resolve(opts.userTasksDir));
  if (opts.taskFiles) {
    for (const f of opts.taskFiles) dirs.push(path.resolve(f));
  }
  for (const dir of dirs) {
    loadDir(dir, tasks, opts);
  }
  // dedupe by id (first wins)
  const seen = new Set();
  return tasks.filter(t => {
    if (!t.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

function loadDir(dir, out, opts) {
  if (!fs.existsSync(dir)) return;
  const st = fs.statSync(dir);
  if (st.isFile()) {
    loadFile(dir, out);
    return;
  }
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    const st2 = fs.statSync(p);
    if (st2.isDirectory()) loadDir(p, out, opts);
    else if (name.endsWith('.json')) loadFile(p, out);
  }
}

function loadFile(file, out) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to parse task file ${file}: ${e.message}`);
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  for (const t of arr) {
    if (!t || !t.id) throw new Error(`Task in ${file} missing id`);
    t.source = t.source || 'file';
    t.source_path = file;
    out.push(t);
  }
}

function validateTasks(tasks) {
  const errs = [];
  const ids = new Set();
  for (const t of tasks) {
    if (ids.has(t.id)) errs.push(`duplicate task id: ${t.id}`);
    ids.add(t.id);
    if (!t.prompt || typeof t.prompt !== 'string') errs.push(`task ${t.id} missing prompt`);
    if (!t.expect || typeof t.expect !== 'object') errs.push(`task ${t.id} missing expect`);
  }
  return errs;
}

module.exports = { loadGoldenTasks, validateTasks, TOOL_ROOT };