const fs = require('fs');
const path = require('path');

const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.java', '.php']);
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.venv', 'venv', 'coverage', 'vendor', '__pycache__']);

function walk(dir, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const e of entries) {
    if (IGNORE_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, files);
    else if (e.isFile()) files.push(full);
  }
  return files;
}

function rel(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }
function isCode(file) { return CODE_EXT.has(path.extname(file)); }
function readLines(file) { try { return fs.readFileSync(file, 'utf8').split(/\r?\n/); } catch { return null; } }

function add(issues, o) { issues.push(o); }

function scanProject(root) {
  const allFiles = walk(root);
  const codeFiles = allFiles.filter(isCode);
  const fileSet = new Set(allFiles.map(f => rel(root, f)));
  const issues = [];

  // 1) Hardcoded secrets
  const secretPatterns = [
    { re: /(?:AKIA|ASIA)[0-9A-Z]{16}/, label: 'Possible AWS access key' },
    { re: /sk_live_[0-9a-zA-Z]{16,}/, label: 'Possible Stripe live secret key' },
    { re: /ghp_[A-Za-z0-9]{20,}/, label: 'Possible GitHub personal access token' },
    { re: /AIza[0-9A-Za-z\-_]{20,}/, label: 'Possible Google API key' },
    { re: /(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*["'][^"'\s]{8,}["']/i, label: 'Hardcoded credential-like value' },
  ];
  for (const file of codeFiles) {
    const lines = readLines(file); if (!lines) continue;
    const r = rel(root, file);
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|#|\/\*|\*)/.test(line) && !/key|secret|token|password/i.test(line)) return;
      for (const p of secretPatterns) {
        if (p.re.test(line) && !/process\.env|os\.environ|getenv|ENV\[|example|placeholder|your_|changeme|<.*>/i.test(line)) {
          add(issues, { category: 'hardcoded-secrets', severity: 'high', file: r, line: i + 1,
            title: p.label,
            detail: 'Sensitive values embedded in source can leak through repos, logs, or client bundles.',
            fix: 'Move the value to an environment variable or secret manager and rotate any exposed credential.' });
          break;
        }
      }
    });
  }

  // 2) Missing env validation
  const envReads = [];
  for (const file of codeFiles) {
    const lines = readLines(file); if (!lines) continue;
    const r = rel(root, file);
    const text = lines.join('\n');
    const jsEnv = [...text.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(m => m[1]);
    const jsEnvBr = [...text.matchAll(/process\.env\[['"]([A-Z0-9_]+)['"]\]/g)].map(m => m[1]);
    const pyEnv = [...text.matchAll(/os\.(?:environ\[['"]([A-Z0-9_]+)['"]\]|getenv\(['"]([A-Z0-9_]+)['"]\))/g)].map(m => m[1] || m[2]);
    const names = [...new Set([...jsEnv, ...jsEnvBr, ...pyEnv])];
    if (names.length) envReads.push({ file: r, names, text });
  }
  const hasEnvSchema = allFiles.some(f => /zod|envalid|joi|env\.schema|validateEnv|dotenv-safe/i.test(((readLines(f)||[]).join('\n'))));
  const hasEnvExample = fileSet.has('.env.example') || fileSet.has('.env.sample') || [...fileSet].some(f => /env.*example/i.test(f));
  if (envReads.length > 0 && !hasEnvSchema) {
    const uniq = [...new Set(envReads.flatMap(e => e.names))].slice(0, 8);
    add(issues, { category: 'missing-env-validation', severity: 'high',
      file: envReads[0].file, line: 1,
      title: `Environment variables used without validation (${uniq.join(', ')}${uniq.length >= 8 ? ', …' : ''})`,
      detail: 'Apps that read process.env/os.environ directly can fail at runtime with confusing errors or run with unsafe defaults when configuration is missing.',
      fix: 'Validate required environment variables at startup (e.g. a schema/check that fails fast) and document them in .env.example.' });
  }
  if (envReads.length > 0 && !hasEnvExample) {
    add(issues, { category: 'missing-env-validation', severity: 'medium',
      file: envReads[0].file, line: 1,
      title: 'No .env.example or sample env file found',
      detail: 'Without a template, required configuration is easy to miss in local setup and deployment.',
      fix: 'Add a .env.example listing required variables with placeholder values (no real secrets).' });
  }

  // 3) Missing tests
  const testFiles = allFiles.filter(f => /(^|\/)(__tests__\/|tests?\/|spec\/|.*\.(test|spec)\.)/i.test(rel(root, f)) || /\.(test|spec)\.[jt]sx?$/.test(f));
  const pkgFiles = allFiles.filter(f => path.basename(f) === 'package.json');
  let hasTestScript = false;
  for (const p of pkgFiles) {
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      const s = (j.scripts && j.scripts.test) || '';
      if (s && !/no test specified/i.test(s)) hasTestScript = true;
    } catch {}
  }
  if (codeFiles.length > 0 && testFiles.length === 0 && !hasTestScript) {
    add(issues, { category: 'missing-tests', severity: 'medium',
      file: rel(root, codeFiles[0]), line: 1,
      title: 'No tests or test script detected',
      detail: 'AI-generated apps often ship without automated checks, making regressions and broken edge cases easy to miss.',
      fix: 'Add a smoke test or basic unit/integration tests and wire them to a test script or CI check.' });
  }

  // 4) Unhandled errors (async without try/catch or .catch in common server/handler files)
  for (const file of codeFiles) {
    const lines = readLines(file); if (!lines) continue;
    const r = rel(root, file);
    const text = lines.join('\n');
    const isServerish = /express|fastify|koa|router|handler|controller|route|api\//i.test(r) || /app\.(get|post|put|delete|use)\(|router\.(get|post|put|delete)|export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE)/.test(text);
    if (!isServerish) continue;
    const hasAsync = /\basync\b/.test(text);
    const hasTry = /\btry\s*\{/.test(text);
    const hasCatch = /\.catch\s*\(/.test(text);
    if (hasAsync && !hasTry && !hasCatch) {
      // find first async line
      let ln = 1;
      for (let i = 0; i < lines.length; i++) if (/\basync\b/.test(lines[i])) { ln = i + 1; break; }
      add(issues, { category: 'unhandled-errors', severity: 'high', file: r, line: ln,
        title: 'Async handler/route code without visible error handling',
        detail: 'Unhandled promise rejections in request paths can crash processes or return opaque failures to users.',
        fix: 'Wrap async operations in try/catch (or add promise .catch) and return clear error responses; add centralized error middleware where applicable.' });
    }
  }

  // 5) Dependency issues
  const pkg = allFiles.find(f => path.basename(f) === 'package.json' && path.dirname(f) === root) || allFiles.find(f => path.basename(f) === 'package.json');
  if (pkg) {
    try {
      const j = JSON.parse(fs.readFileSync(pkg, 'utf8'));
      const deps = { ...(j.dependencies || {}), ...(j.devDependencies || {}) };
      const r = rel(root, pkg);
      const floating = Object.entries(deps).filter(([, v]) => /(^\*|latest|^git\+)/.test(String(v)));
      if (floating.length) {
        add(issues, { category: 'dependency-issues', severity: 'medium', file: r, line: 1,
          title: `Floating or unpinned dependencies (${floating.map(x=>x[0]).slice(0,5).join(', ')})`,
          detail: 'Using "*" / "latest" or git dependencies makes builds non-reproducible and can pull breaking or malicious changes.',
          fix: 'Pin dependencies to specific versions or ranges you have tested and commit a lockfile.' });
      }
      const hasLock = fileSet.has('package-lock.json') || fileSet.has('pnpm-lock.yaml') || fileSet.has('yarn.lock') || fileSet.has('bun.lockb');
      if (Object.keys(j.dependencies || {}).length > 0 && !hasLock) {
        add(issues, { category: 'dependency-issues', severity: 'medium', file: r, line: 1,
          title: 'No lockfile found for declared dependencies',
          detail: 'Without a lockfile, installs may resolve different dependency trees across machines and over time.',
          fix: 'Generate and commit a lockfile (package-lock.json, pnpm-lock.yaml, or yarn.lock).' });
      }
    } catch {}
  }
  const req = allFiles.find(f => path.basename(f) === 'requirements.txt');
  if (req) {
    const r = rel(root, req);
    const lines = readLines(req) || [];
    const unpinned = lines.filter(l => l && !/^\s*#/.test(l) && !/[=<>~!]/.test(l));
    if (unpinned.length) {
      add(issues, { category: 'dependency-issues', severity: 'medium', file: r, line: 1,
        title: 'Unpinned Python requirements detected',
        detail: 'Requirements without version constraints can change behavior between installs.',
        fix: 'Pin package versions in requirements.txt or use a lock/constraints workflow.' });
    }
  }

  // 6) Exposed endpoints / debug & permissive config
  for (const file of codeFiles) {
    const lines = readLines(file); if (!lines) continue;
    const r = rel(root, file);
    lines.forEach((line, i) => {
      if (/cors\(\s*\)|origin\s*:\s*['"]\*['"]|Access-Control-Allow-Origin['"]?\s*[:=]\s*['"]\*['"]/i.test(line)) {
        add(issues, { category: 'exposed-endpoints', severity: 'medium', file: r, line: i + 1,
          title: 'Permissive CORS configuration (wildcard origin)',
          detail: 'Allowing any origin can expose APIs to unintended cross-site access; review whether this is required.',
          fix: 'Restrict allowed origins to trusted domains, especially for authenticated endpoints.' });
      }
      if (/app\.listen\([^)]*['"]0\.0\.0\.0['"]|host\s*[:=]\s*['"]0\.0\.0\.0['"]/i.test(line)) {
        add(issues, { category: 'exposed-endpoints', severity: 'low', file: r, line: i + 1,
          title: 'Service binds to 0.0.0.0 (all interfaces)',
          detail: 'Binding to all interfaces can expose a development service beyond localhost if not firewalled.',
          fix: 'Bind to localhost for development or ensure network exposure is intentional and protected.' });
      }
      if (/\/(debug|admin|internal)\b|app\.(get|post|all)\(['"]\/debug/i.test(line) && !/test|spec/i.test(r)) {
        add(issues, { category: 'exposed-endpoints', severity: 'medium', file: r, line: i + 1,
          title: 'Potential debug/admin endpoint exposed in app code',
          detail: 'Debug or admin routes can leak sensitive state if reachable in production.',
          fix: 'Remove, protect with authentication, or gate debug endpoints behind an explicit non-production flag.' });
      }
    });
  }

  const severityRank = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => (severityRank[a.severity] - severityRank[b.severity]) || a.category.localeCompare(b.category) || a.file.localeCompare(b.file) || a.line - b.line);

  const byCategory = {};
  for (const i of issues) byCategory[i.category] = (byCategory[i.category] || 0) + 1;

  return {
    scannedAt: new Date().toISOString(),
    root,
    stats: { filesScanned: codeFiles.length, totalFiles: allFiles.length },
    summary: { total: issues.length, byCategory },
    issues,
  };
}

module.exports = { scanProject };
