const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;
const WORKSPACE_ROOT = path.resolve(process.env.WORKSPACE_ROOT || path.join(__dirname, '..'));

function readReadme(dirPath) {
  const readmePath = path.join(dirPath, 'README.md');
  if (!fs.existsSync(readmePath)) return null;
  try {
    return fs.readFileSync(readmePath, 'utf8');
  } catch (_err) {
    return null;
  }
}

function extractTitleAndSummary(markdown, fallbackName) {
  const lines = markdown.split(/\r?\n/);
  let title = fallbackName;
  let summaryLines = [];
  let inSummary = false;

  for (const line of lines) {
    const heading = line.match(/^#\s+(.+)/);
    if (heading && title === fallbackName) {
      title = heading[1].trim();
      inSummary = true;
      continue;
    }
    if (inSummary) {
      if (/^#{1,6}\s+/.test(line)) break;
      if (line.trim() === '') {
        if (summaryLines.length) break;
        continue;
      }
      summaryLines.push(line.trim());
      if (summaryLines.join(' ').length > 280) break;
    }
  }

  let summary = summaryLines.join(' ').replace(/\s+/g, ' ').trim();
  if (!summary) {
    for (const line of lines) {
      const t = line.trim();
      if (!t || /^#{1,6}\s+/.test(t)) continue;
      summary = t;
      break;
    }
  }
  if (summary.length > 320) summary = summary.slice(0, 317) + '...';
  return { title, summary: summary || 'No description available.' };
}

function scanTools() {
  let entries = [];
  try {
    entries = fs.readdirSync(WORKSPACE_ROOT, { withFileTypes: true });
  } catch (_err) {
    return [];
  }

  const tools = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (path.resolve(WORKSPACE_ROOT, entry.name) === path.resolve(__dirname)) continue;

    const dirPath = path.join(WORKSPACE_ROOT, entry.name);
    const readme = readReadme(dirPath);
    if (!readme) continue;

    const { title, summary } = extractTitleAndSummary(readme, entry.name);
    tools.push({
      id: entry.name,
      folder: entry.name,
      title,
      summary,
      readmePath: path.join(entry.name, 'README.md'),
      launchUrl: `/tool/${encodeURIComponent(entry.name)}`,
    });
  }

  tools.sort((a, b) => a.title.localeCompare(b.title) || a.folder.localeCompare(b.folder));
  return tools;
}

function isSafeToolId(id) {
  return typeof id === 'string' && id.length > 0 && !id.includes('/') && !id.includes('\\') && !id.includes('..') && !id.startsWith('.');
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/tools', (_req, res) => {
  res.json({ workspaceRoot: WORKSPACE_ROOT, tools: scanTools() });
});

app.get('/api/tools/:id', (req, res) => {
  const id = req.params.id;
  if (!isSafeToolId(id)) return res.status(400).json({ error: 'Invalid tool id' });
  const dirPath = path.join(WORKSPACE_ROOT, id);
  const readme = readReadme(dirPath);
  if (!readme) return res.status(404).json({ error: 'Tool README not found' });
  const { title, summary } = extractTitleAndSummary(readme, id);
  res.json({ id, folder: id, title, summary, readme });
});

app.get('/tool/:id', (req, res) => {
  const id = req.params.id;
  if (!isSafeToolId(id)) return res.status(400).send('Invalid tool id');
  const dirPath = path.join(WORKSPACE_ROOT, id);
  const readme = readReadme(dirPath);
  if (!readme) return res.status(404).send('Tool README not found');
  const { title } = extractTitleAndSummary(readme, id);
  const body = marked.parse(readme);
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - Tool Launcher</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; background: #f6f7f9; color: #1f2937; }
    header { background: #111827; color: #fff; padding: 16px 24px; }
    header a { color: #93c5fd; text-decoration: none; }
    main { max-width: 900px; margin: 24px auto; background: #fff; padding: 24px 28px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .meta { color: #6b7280; margin-bottom: 16px; font-size: 14px; }
    pre { background: #0b1020; color: #e5e7eb; padding: 12px; overflow: auto; border-radius: 8px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    h1,h2,h3 { line-height: 1.25; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <header>
    <div><a href="/">← Back to Tool Launcher</a></div>
  </header>
  <main>
    <div class="meta">Folder: <code>${escapeHtml(id)}</code></div>
    <article class="readme">${body}</article>
  </main>
</body>
</html>`);
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function start(port = PORT) {
  return app.listen(port, () => {
    console.log(`Tool Launcher running at http://localhost:${port}`);
    console.log(`Scanning workspace: ${WORKSPACE_ROOT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, scanTools, extractTitleAndSummary, isSafeToolId, WORKSPACE_ROOT };
