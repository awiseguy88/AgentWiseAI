'use strict';

const fs = require('fs');
const path = require('path');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInventory(analysis) {
  let html = '';
  for (const t of analysis.tables) {
    html += `<section class="card"><h3>Table: ${esc(t.table)} <small>(${t.rowCount} rows)</small></h3>`;
    html += `<p class="source">Source: verified from CSV export${t.file ? ` (${esc(path.basename(t.file))})` : ''}.</p>`;
    html += '<table><thead><tr><th>Column</th><th>Inferred type</th><th>Empty</th><th>Unique (non-empty)</th><th>Samples</th></tr></thead><tbody>';
    for (const c of t.columns) {
      html += `<tr><td>${esc(c.name)}</td><td>${esc(c.inferredType)}</td><td>${c.emptyCount}/${c.total} (${c.emptyPct}%)</td><td>${c.uniqueCount}</td><td>${esc(c.sampleValues.join(' | '))}</td></tr>`;
    }
    html += '</tbody></table></section>';
  }
  return html || '<p>No CSV tables provided.</p>';
}

function renderRelationHints(analysis) {
  if (!analysis.relationHints.length) return '<p>No relation hints detected from column names. Review manually for Glide relations/computed columns.</p>';
  let html = '<ul>';
  for (const h of analysis.relationHints) {
    html += `<li><strong>${esc(h.fromTable)}.${esc(h.column)}</strong>: ${esc(h.reason)}</li>`;
  }
  html += '</ul>';
  return html;
}

function renderEmptyColumns(analysis) {
  if (!analysis.emptyColumns.length) return '<p>No mostly-empty columns detected (&ge;80% empty). Verify manually.</p>';
  let html = '<table><thead><tr><th>Table</th><th>Column</th><th>Empty %</th><th>Inferred type</th></tr></thead><tbody>';
  for (const e of analysis.emptyColumns) {
    html += `<tr><td>${esc(e.table)}</td><td>${esc(e.column)}</td><td>${e.emptyPct}%</td><td>${esc(e.inferredType)}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function renderRoles(notes) {
  const roles = notes && notes.roles ? notes.roles : [];
  let html = '<p class="source">User/role checklist: template populated from app notes when provided; otherwise starter items. Confirm against your actual app.</p>';
  html += '<ul class="checklist">';
  const items = roles.length ? roles : [
    { name: 'Admin/Owner', notes: 'Full access, configuration, billing/data management' },
    { name: 'Editor/Staff', notes: 'Create and update operational records' },
    { name: 'Viewer/Client', notes: 'Read-only or limited access to own records' }
  ];
  for (const r of items) {
    const name = typeof r === 'string' ? r : (r.name || r.role || 'Role');
    const note = typeof r === 'object' ? (r.notes || r.description || r.permissions || '') : '';
    html += `<li><label><input type="checkbox"> <strong>${esc(name)}</strong></label>${note ? ` — ${esc(String(note))}` : ''}</li>`;
  }
  if (!roles.length) html += '<li><label><input type="checkbox"> <em>Add app-specific roles from your Glide app notes</em></label></li>';
  html += '</ul>';
  html += `<p class="label-note ${roles.length ? 'user-supplied' : 'template'}">Source: ${roles.length ? 'User-supplied logic notes (roles)' : 'Starter template (no roles provided in notes)'}.</p>`;
  return html;
}

function renderScreenLogic(analysis, notes) {
  const screens = notes && notes.screens ? notes.screens : [];
  const logic = notes && notes.logic ? notes.logic : [];
  let html = '<p class="source">Combines verified table inventory with user-supplied screen/logic notes. Verified data findings come from CSV exports; screens and logic flows require confirmation from app notes or manual review.</p>';

  html += '<h3>Detected data tables (verified from CSV exports)</h3><ul class="checklist">';
  if (analysis.tables.length) {
    for (const t of analysis.tables) {
      html += `<li><label><input type="checkbox"> Rebuild data table <strong>${esc(t.table)}</strong></label> — ${t.rowCount} rows, ${t.columns.length} columns.</li>`;
    }
  } else {
    html += '<li><em>No CSV tables provided.</em></li>';
  }
  html += '</ul><p class="label-note verified">Source: Verified data findings from exported CSV files.</p>';

  html += '<h3>Screens (user-supplied notes / manual checklist)</h3><ul class="checklist">';
  const screenItems = screens.length ? screens : [
    { name: 'Home / Dashboard', notes: 'Entry point, summary metrics' },
    { name: 'List view(s)', notes: 'Per-table browse/search/filter screens' },
    { name: 'Detail/Form screen(s)', notes: 'Create/edit/view records' }
  ];
  for (const s of screenItems) {
    const name = typeof s === 'string' ? s : (s.name || s.screen || 'Screen');
    const note = typeof s === 'object' ? (s.notes || s.description || s.purpose || '') : '';
    html += `<li><label><input type="checkbox"> <strong>${esc(name)}</strong></label>${note ? ` — ${esc(String(note))}` : ''}</li>`;
  }
  if (!screens.length) html += '<li><label><input type="checkbox"> <em>Add all app-specific screens from Glide</em></label></li>';
  html += '</ul>';
  html += `<p class="label-note ${screens.length ? 'user-supplied' : 'template'}">Source: ${screens.length ? 'User-supplied logic notes (screens)' : 'Starter template (no screens provided in notes)'}.</p>`;

  html += '<h3>Logic / actions / workflows (user-supplied notes / manual checklist)</h3><ul class="checklist">';
  const logicItems = logic.length ? logic : [
    { name: 'Visibility & filtering rules', notes: 'Row owners, role filters, per-screen visibility' },
    { name: 'Actions & buttons', notes: 'Add/edit/delete, navigation, custom actions' },
    { name: 'Computed columns / relations', notes: 'Recreate formulas, rollups, lookups, relations' },
    { name: 'Integrations & notifications', notes: 'Email, webhooks, Slack, Zapier/Make, etc.' }
  ];
  for (const l of logicItems) {
    const name = typeof l === 'string' ? l : (l.name || l.logic || l.workflow || 'Logic item');
    const note = typeof l === 'object' ? (l.notes || l.description || l.details || '') : '';
    html += `<li><label><input type="checkbox"> <strong>${esc(name)}</strong></label>${note ? ` — ${esc(String(note))}` : ''}</li>`;
  }
  if (!logic.length) html += '<li><label><input type="checkbox"> <em>Add app-specific logic from Glide</em></label></li>';
  html += '</ul>';
  html += `<p class="label-note ${logic.length ? 'user-supplied' : 'template'}">Source: ${logic.length ? 'User-supplied logic notes (logic/workflows)' : 'Starter template (no logic provided in notes)'}.</p>`;
  return html;
}

function costRows(notes) {
  const cost = (notes && notes.cost) || {};
  const currency = cost.currency || 'USD';
  const assumptions = cost.assumptions || cost.notes || '';
  const defaults = [
    { category: 'Subscription (monthly)', classic: cost.classicMonthly || '', glideos: cost.glideOsMonthly || '', rebuild: cost.rebuildMonthly || '', note: 'Platform/tooling fees' },
    { category: 'Subscription (annual)', classic: cost.classicAnnual || '', glideos: cost.glideOsAnnual || '', rebuild: cost.rebuildAnnual || '', note: 'Annualized platform/tooling' },
    { category: 'Data migration & cleanup', classic: 'N/A', glideos: cost.glideOsMigration || '', rebuild: cost.rebuildMigration || '', note: 'Export, transform, import' },
    { category: 'Screen/UI rebuild effort', classic: 'N/A', glideos: cost.glideOsUi || '', rebuild: cost.rebuildUi || '', note: 'Recreate screens/layouts' },
    { category: 'Logic/workflow rebuild effort', classic: 'N/A', glideos: cost.glideOsLogic || '', rebuild: cost.rebuildLogic || '', note: 'Actions, computed logic, integrations' },
    { category: 'Testing & rollout', classic: 'N/A', glideos: cost.glideOsTesting || '', rebuild: cost.rebuildTesting || '', note: 'QA, training, cutover' },
    { category: 'Ongoing maintenance (monthly)', classic: cost.classicMaintenance || '', glideos: cost.glideOsMaintenance || '', rebuild: cost.rebuildMaintenance || '', note: 'Updates and support' }
  ];
  const custom = Array.isArray(cost.rows) ? cost.rows.map(r => ({
    category: r.category || r.name || '', classic: r.classic || '', glideos: r.glideos || r.glideOs || '', rebuild: r.rebuild || '', note: r.note || r.notes || ''
  })) : [];
  return { currency, assumptions, rows: defaults.concat(custom) };
}

function renderCostWorksheet(notes) {
  const { currency, assumptions, rows } = costRows(notes);
  let html = `<p class="source">Rough cost-comparison worksheet (${esc(currency)}). These are planning estimates only — verify pricing, effort, and scope before making decisions.</p>`;
  if (assumptions) html += `<p><strong>Assumptions (user-supplied):</strong> ${esc(String(assumptions))}</p>`;
  html += '<table><thead><tr><th>Category</th><th>Glide Classic</th><th>GlideOS</th><th>Generic rebuild</th><th>Notes</th></tr></thead><tbody>';
  for (const r of rows) {
    html += `<tr><td>${esc(r.category)}</td><td>${esc(r.classic)}</td><td>${esc(r.glideos)}</td><td>${esc(r.rebuild)}</td><td>${esc(r.note)}</td></tr>`;
  }
  html += '</tbody></table>';
  html += `<p class="label-note ${(notes && notes.cost && Object.keys(notes.cost).length) ? 'user-supplied' : 'template'}">Source: ${(notes && notes.cost && Object.keys(notes.cost).length) ? 'Template prefilled with user-supplied cost assumptions where provided' : 'Starter template (no cost assumptions provided in notes)'}; values are rough planning estimates.</p>`;
  return html;
}

function generateHtmlReport(analysis, notes, meta) {
  const appName = (notes && notes.appName) || meta.appName || 'Glide Classic App';
  const notesProvided = !!(notes && (notes.screens.length || notes.logic.length || notes.roles.length || (notes.cost && Object.keys(notes.cost).length)));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Glide Classic Escape Kit — ${esc(appName)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;color:#1f2937;background:#f8fafc;line-height:1.5}
  header{background:#0f172a;color:#fff;padding:24px 28px} header h1{margin:0 0 6px;font-size:1.6rem} header p{margin:4px 0;color:#cbd5e1}
  main{max-width:1100px;margin:0 auto;padding:20px 24px 40px}
  h2{margin-top:28px;border-bottom:2px solid #e2e8f0;padding-bottom:6px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin:12px 0}
  table{width:100%;border-collapse:collapse;margin:10px 0;font-size:0.95rem} th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;vertical-align:top} th{background:#f1f5f9}
  .banner{padding:12px 14px;border-radius:8px;margin:12px 0;border:1px solid}
  .verified{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
  .user-supplied{background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a}
  .template{background:#fffbeb;border-color:#fde68a;color:#92400e}
  .label-note{font-size:0.9rem;margin-top:6px;padding:6px 8px;border-radius:6px;border:1px solid}
  .checklist{list-style:none;padding-left:0} .checklist li{margin:6px 0}
  .source{color:#475569;font-size:0.95rem} small{color:#64748b}
  footer{margin-top:30px;color:#64748b;font-size:0.9rem}
</style>
</head>
<body>
<header>
  <h1>Glide Classic Escape Kit</h1>
  <p><strong>App:</strong> ${esc(appName)}</p>
  <p>Offline rebuild inventory and planning report generated ${esc(meta.generatedAt || new Date().toISOString())}.</p>
</header>
<main>
  <section>
    <h2>How to read this report</h2>
    <div class="banner verified"><strong>Verified data findings</strong> are derived from the CSV exports you provided (tables, columns, inferred types, empty/missing values, and name-based relation hints). Confirm them against your source data.</div>
    <div class="banner user-supplied"><strong>User-supplied logic notes</strong> come from the app-notes file you provided (screens, logic/workflows, roles, cost assumptions). They are included as-is for planning and must be confirmed against the actual app.</div>
    <div class="banner template"><strong>Starter templates</strong> appear where notes were not provided. They are checklists to complete, not verified facts.</div>
    <p>Notes file provided: <strong>${notesProvided ? 'yes' : 'no (templates shown)'}</strong>. No external services were used.</p>
  </section>

  <section>
    <h2>1. Rebuild inventory (verified from data)</h2>
    <h3>Tables, columns, and inferred types</h3>
    ${renderInventory(analysis)}
    <h3>Relation hints (name-based, verify manually)</h3>
    <p class="label-note verified">Source: Verified column names from CSV exports; hints are heuristic.</p>
    ${renderRelationHints(analysis)}
    <h3>Missing / mostly-empty columns</h3>
    <p class="label-note verified">Source: Verified from CSV export values (columns &ge;80% empty or entirely empty).</p>
    ${renderEmptyColumns(analysis)}
    <h3>User/role checklist</h3>
    ${renderRoles(notes)}
  </section>

  <section>
    <h2>2. Screen-and-logic checklist template</h2>
    ${renderScreenLogic(analysis, notes)}
  </section>

  <section>
    <h2>3. Rough cost-comparison worksheet</h2>
    ${renderCostWorksheet(notes)}
  </section>

  <footer>
    <p>Glide Classic Escape Kit — offline, no external services. Separates verified data findings from user-supplied logic notes.</p>
  </footer>
</main>
</body>
</html>`;
}

function generateChecklistMd(analysis, notes) {
  const lines = [];
  const screens = notes && notes.screens ? notes.screens : [];
  const logic = notes && notes.logic ? notes.logic : [];
  const roles = notes && notes.roles ? notes.roles : [];
  lines.push('# Screen-and-logic checklist (Glide Classic Escape Kit)');
  lines.push('');
  lines.push('> **Verified data findings** come from CSV exports. **User-supplied logic notes** come from your app-notes file. Items without notes are starter templates — confirm against the actual app.');
  lines.push('');
  lines.push('## Data tables (verified from CSV exports)');
  if (analysis.tables.length) {
    for (const t of analysis.tables) lines.push(`- [ ] Rebuild data table **${t.table}** (${t.rowCount} rows, ${t.columns.length} columns)`);
  } else {
    lines.push('- [ ] _No CSV tables provided_');
  }
  lines.push('');
  lines.push(`## Screens (${screens.length ? 'user-supplied notes' : 'starter template'})`);
  const screenItems = screens.length ? screens : ['Home / Dashboard', 'List view(s)', 'Detail/Form screen(s)', 'Add app-specific screens'];
  for (const s of screenItems) {
    const name = typeof s === 'string' ? s : (s.name || s.screen || 'Screen');
    const note = typeof s === 'object' && (s.notes || s.description) ? ` — ${s.notes || s.description}` : '';
    lines.push(`- [ ] ${name}${note}`);
  }
  lines.push('');
  lines.push(`## Logic / actions / workflows (${logic.length ? 'user-supplied notes' : 'starter template'})`);
  const logicItems = logic.length ? logic : ['Visibility & filtering rules', 'Actions & buttons', 'Computed columns / relations', 'Integrations & notifications', 'Add app-specific logic'];
  for (const l of logicItems) {
    const name = typeof l === 'string' ? l : (l.name || l.logic || l.workflow || 'Logic item');
    const note = typeof l === 'object' && (l.notes || l.description) ? ` — ${l.notes || l.description}` : '';
    lines.push(`- [ ] ${name}${note}`);
  }
  lines.push('');
  lines.push(`## User/role checklist (${roles.length ? 'user-supplied notes' : 'starter template'})`);
  const roleItems = roles.length ? roles : ['Admin/Owner', 'Editor/Staff', 'Viewer/Client', 'Add app-specific roles'];
  for (const r of roleItems) {
    const name = typeof r === 'string' ? r : (r.name || r.role || 'Role');
    const note = typeof r === 'object' && (r.notes || r.permissions) ? ` — ${r.notes || r.permissions}` : '';
    lines.push(`- [ ] ${name}${note}`);
  }
  lines.push('');
  return lines.join('\n');
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function generateCostCsv(notes) {
  const { currency, assumptions, rows } = costRows(notes);
  const lines = [];
  lines.push(['Currency', currency].map(csvEscape).join(','));
  lines.push(['Assumptions (user-supplied or empty)', assumptions || ''].map(csvEscape).join(','));
  lines.push(['Category', 'Glide Classic', 'GlideOS', 'Generic rebuild', 'Notes'].map(csvEscape).join(','));
  for (const r of rows) lines.push([r.category, r.classic, r.glideos, r.rebuild, r.note].map(csvEscape).join(','));
  return lines.join('\n') + '\n';
}

function writeOutputs(outDir, analysis, notes, meta) {
  fs.mkdirSync(outDir, { recursive: true });
  const html = generateHtmlReport(analysis, notes, meta);
  const checklist = generateChecklistMd(analysis, notes);
  const costCsv = generateCostCsv(notes);
  const inventory = { meta, analysis, notes: notes ? { appName: notes.appName, description: notes.description, screens: notes.screens, logic: notes.logic, roles: notes.roles, integrations: notes.integrations, cost: notes.cost, notes: notes.notes } : null };
  fs.writeFileSync(path.join(outDir, 'report.html'), html, 'utf8');
  fs.writeFileSync(path.join(outDir, 'checklist.md'), checklist, 'utf8');
  fs.writeFileSync(path.join(outDir, 'cost-worksheet.csv'), costCsv, 'utf8');
  fs.writeFileSync(path.join(outDir, 'inventory.json'), JSON.stringify(inventory, null, 2), 'utf8');
  return ['report.html', 'inventory.json', 'checklist.md', 'cost-worksheet.csv'];
}

module.exports = { generateHtmlReport, generateChecklistMd, generateCostCsv, writeOutputs };
