export function normalizeRun(run) {
  const duration = Number(run.duration);
  const retries = Number(run.retries ?? 0);
  const confidenceRaw = run.confidence;
  const confidence = confidenceRaw === '' || confidenceRaw == null ? null : Number(confidenceRaw);
  return {
    id: String(run.id ?? cryptoId()),
    task: String(run.task ?? '').trim(),
    outcome: String(run.outcome ?? 'unknown').toLowerCase().trim(),
    duration: Number.isFinite(duration) ? duration : 0,
    retries: Number.isFinite(retries) ? retries : 0,
    humanOverride: toBool(run.humanOverride),
    errorType: String(run.errorType ?? '').trim(),
    confidence: Number.isFinite(confidence) ? confidence : null,
    notes: String(run.notes ?? '').trim(),
    date: run.date ? String(run.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

export function toBool(value) {
  if (typeof value === 'boolean') return value;
  const v = String(value ?? '').toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes';
}

export function cryptoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `run-${Math.random().toString(36).slice(2, 10)}`;
}

export function computeSummary(runs) {
  const total = runs.length;
  const completed = runs.filter((r) => r.outcome === 'success' || r.outcome === 'completed').length;
  const overrides = runs.filter((r) => r.humanOverride).length;
  const failures = runs.filter((r) => r.outcome === 'failure' || r.outcome === 'failed' || r.outcome === 'error');
  const avgDuration = total ? runs.reduce((s, r) => s + (Number(r.duration) || 0), 0) / total : 0;
  const failureCategories = {};
  for (const r of failures) {
    const key = (r.errorType || 'unspecified').trim() || 'unspecified';
    failureCategories[key] = (failureCategories[key] || 0) + 1;
  }
  const recurring = Object.entries(failureCategories)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  return {
    total,
    completionRate: total ? completed / total : 0,
    interventionRate: total ? overrides / total : 0,
    avgDuration,
    recurring,
  };
}

export function weeklyTrends(runs) {
  const buckets = new Map();
  for (const run of runs) {
    const week = isoWeekStart(run.date);
    if (!buckets.has(week)) buckets.set(week, []);
    buckets.get(week).push(run);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, items]) => {
      const s = computeSummary(items);
      return {
        week,
        total: items.length,
        completionRate: s.completionRate,
        interventionRate: s.interventionRate,
      };
    });
}

export function isoWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return 'invalid-date';
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

export function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { if (row.some((c) => c !== '')) rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { inQuotes = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { pushField(); i++; continue; }
    if (ch === '\n') { pushField(); pushRow(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    field += ch; i++;
  }
  pushField(); pushRow();
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] ?? ''; });
    return normalizeRun(obj);
  });
}

export function toCSV(runs) {
  const headers = ['id','task','outcome','duration','retries','humanOverride','errorType','confidence','notes','date'];
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.join(',')];
  for (const r of runs) lines.push(headers.map((h) => escape(r[h])).join(','));
  return lines.join('\n');
}
