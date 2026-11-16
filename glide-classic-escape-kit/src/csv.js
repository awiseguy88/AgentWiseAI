'use strict';

const fs = require('fs');
const path = require('path');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  // Normalize newlines
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') {
        row.push(field); field = '';
        // Skip trailing empty line
        if (!(row.length === 1 && row[0] === '')) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  // last field
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
  }
  return rows;
}

function loadCsvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  if (rows.length === 0) return { table: path.basename(filePath, path.extname(filePath)), headers: [], records: [], rawRows: 0 };
  const headers = rows[0].map(h => String(h || '').trim());
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j] || `column_${j + 1}`] = r[j] !== undefined ? String(r[j]) : '';
    }
    records.push(obj);
  }
  return {
    table: path.basename(filePath, path.extname(filePath)),
    file: filePath,
    headers,
    records,
    rawRows: records.length
  };
}

module.exports = { parseCsv, loadCsvFile };
