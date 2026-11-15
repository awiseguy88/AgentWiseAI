'use strict';

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

function inferType(values) {
  const nonEmpty = values.filter(v => !isBlank(v)).map(v => String(v).trim());
  if (nonEmpty.length === 0) return 'empty';
  let allInt = true, allNum = true, allBool = true, allDate = true, allEmail = true, allUrl = true;
  const boolSet = new Set(['true','false','yes','no','0','1']);
  for (const v of nonEmpty) {
    if (!/^[-+]?\d+$/.test(v)) allInt = false;
    if (!/^[-+]?\d*(\.\d+)?$/.test(v) || v === '' || v === '.' || v === '+' || v === '-') allNum = false;
    if (!boolSet.has(v.toLowerCase())) allBool = false;
    if (isNaN(Date.parse(v)) || /^\d+$/.test(v)) allDate = false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) allEmail = false;
    if (!/^https?:\/\//i.test(v)) allUrl = false;
  }
  if (allBool) return 'boolean';
  if (allInt) return 'integer';
  if (allNum) return 'number';
  if (allEmail) return 'email';
  if (allUrl) return 'url';
  if (allDate) return 'date-like';
  // mixed: long-ish text?
  const avgLen = nonEmpty.reduce((a,b)=>a+b.length,0)/nonEmpty.length;
  if (avgLen > 80) return 'long-text';
  return 'text';
}

function analyzeTable(table) {
  const columns = table.headers.map(h => {
    const values = table.records.map(r => r[h]);
    const emptyCount = values.filter(isBlank).length;
    const nonEmptyCount = values.length - emptyCount;
    const uniqueCount = new Set(values.filter(v => !isBlank(v)).map(v => String(v).trim())).size;
    return {
      name: h,
      inferredType: inferType(values),
      emptyCount,
      nonEmptyCount,
      total: values.length,
      emptyPct: values.length ? Math.round((emptyCount / values.length) * 100) : 0,
      uniqueCount,
      sampleValues: values.filter(v => !isBlank(v)).slice(0, 3).map(v => String(v))
    };
  });
  return { table: table.table, file: table.file, rowCount: table.records.length, columns };
}

function relationHints(tablesAnalysis) {
  const tableNames = tablesAnalysis.map(t => t.table);
  const tableNamesLower = tableNames.map(n => n.toLowerCase());
  const hints = [];
  for (const t of tablesAnalysis) {
    for (const c of t.columns) {
      const name = c.name;
      const lower = name.toLowerCase();
      // id/ref/relation naming
      if (/relation/i.test(name)) {
        hints.push({ fromTable: t.table, column: name, reason: 'Column name suggests a relation/computed relation field (Glide relation hint).' });
      }
      if (/(^|[_\s-])(id|ref|fk)($|[_\s-])/i.test(name) || /id$/i.test(name)) {
        // try to match to other tables
        const base = lower.replace(/(_id|id|_ref|ref|_fk|fk)$/i, '').replace(/[^a-z0-9]/g, '');
        const matches = tableNames.filter((tn, i) => {
          const tl = tableNamesLower[i].replace(/[^a-z0-9]/g, '');
          return tl && base && (tl === base || tl === base + 's' || tl + 's' === base) && tn !== t.table;
        });
        if (matches.length) {
          hints.push({ fromTable: t.table, column: name, reason: `Possible reference to table(s): ${matches.join(', ')} (name-based hint).` });
        } else if (/id$/i.test(name) && lower !== 'id' && lower !== 'rowid' && lower !== 'row_id') {
          hints.push({ fromTable: t.table, column: name, reason: 'Column name ends with Id/Ref; may reference another table (name-based hint).' });
        }
      }
      // exact table name match
      const exact = tableNamesLower.indexOf(lower.replace(/[^a-z0-9]/g, ''));
      if (exact >= 0 && tableNames[exact] !== t.table) {
        hints.push({ fromTable: t.table, column: name, reason: `Column name resembles table "${tableNames[exact]}" (name-based hint).` });
      }
    }
  }
  // de-dupe
  const seen = new Set();
  return hints.filter(h => {
    const k = `${h.fromTable}|${h.column}|${h.reason}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
}

function analyzeAll(tables) {
  const tablesAnalysis = tables.map(analyzeTable);
  const hints = relationHints(tablesAnalysis);
  const emptyColumns = [];
  for (const t of tablesAnalysis) {
    for (const c of t.columns) {
      if (c.emptyPct >= 80 || c.inferredType === 'empty') {
        emptyColumns.push({ table: t.table, column: c.name, emptyPct: c.emptyPct, inferredType: c.inferredType });
      }
    }
  }
  return { tables: tablesAnalysis, relationHints: hints, emptyColumns };
}

module.exports = { analyzeAll, analyzeTable, inferType };
