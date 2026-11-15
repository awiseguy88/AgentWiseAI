import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error('Smoke check failed: ' + msg);
}

const required = ['index.html', 'styles.css', 'app.js', 'README.md', 'PLAN.md'];
for (const f of required) {
  assert(fs.existsSync(path.join(__dirname, f)), `missing ${f}`);
}

const html = read('index.html');
const js = read('app.js');
const readme = read('README.md');

const markers = [
  ['tool-form', 'tool logging form'],
  ['tool-renewal', 'renewal date field'],
  ['export-csv', 'CSV export button'],
  ['export-pdf', 'PDF export button'],
  ['Negotiation talking points', 'talking points section'],
  ['localStorage', 'localStorage mention'],
  ['Paid-vs-used feature report', 'paid-vs-used report heading']
];
for (const [m, label] of markers) {
  assert(html.includes(m) || js.includes(m) || readme.includes(m), `missing marker for ${label}`);
}
assert(js.includes('aiFeatureUsageAuditor.v1'), 'missing storage key');

// Minimal browser mocks to evaluate app.js logic
const storage = new Map();
const localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k)
};

function makeElement(tag) {
  return {
    tagName: tag,
    value: '',
    innerHTML: '',
    textContent: '',
    className: '',
    dataset: {},
    style: {},
    children: [],
    classList: {
      _s: new Set(),
      add(c){this._s.add(c);}, remove(c){this._s.delete(c);},
      contains(c){return this._s.has(c);}, toggle(c,force){ if(force===undefined){this._s.has(c)?this._s.delete(c):this._s.add(c);} else {force?this._s.add(c):this._s.delete(c);} }
    },
    addEventListener(){},
    removeEventListener(){},
    appendChild(ch){this.children.push(ch); return ch;},
    remove(){},
    reset(){},
    setAttribute(){},
    getAttribute(){return null;},
    querySelectorAll(){return [];},
    querySelector(){return null;},
    closest(){return {dataset:{tool:'',idx:'0'}};}
  };
}

const elements = new Map();
function getEl(id) {
  if (!elements.has(id)) elements.set(id, makeElement('div'));
  const el = elements.get(id);
  if (id === 'tool-form') el.reset = () => {
    ['tool-name','tool-premium','tool-term','tool-renewal','tool-features'].forEach(x => { getEl(x).value = ''; });
  };
  return el;
}

const document = {
  getElementById: (id) => getEl(id),
  createElement: (tag) => makeElement(tag),
  body: makeElement('body')
};
const window = { document, localStorage, print: () => {} };

const context = vm.createContext({
  window, document, localStorage,
  console, setTimeout, clearTimeout,
  Blob: class Blob { constructor(parts){ this.parts = parts; } },
  URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
  alert: () => {}, confirm: () => true
});

vm.runInContext(js, context, { filename: 'app.js' });
const api = context.window.AIFeatureUsageAuditor;
assert(api, 'app did not expose AIFeatureUsageAuditor API');

// Acceptance scenario: 5 tools, mark 2 features as unused across 3 tools, set renewal date
const tools = [
  { id:'t1', name:'Tool A', premium:1200, term:'year', renewalDate:'2026-12-01', features:[
    {name:'AI summaries', used:false, frequency:'Never'},
    {name:'Smart replies', used:true, frequency:'Weekly'}
  ]},
  { id:'t2', name:'Tool B', premium:600, term:'year', renewalDate:'2027-01-15', features:[
    {name:'Forecasting', used:false, frequency:'Never'},
    {name:'Auto-tagging', used:true, frequency:'Daily'}
  ]},
  { id:'t3', name:'Tool C', premium:900, term:'year', renewalDate:'2026-11-30', features:[
    {name:'Copilot chat', used:true, frequency:'Monthly'},
    {name:'Doc drafting', used:true, frequency:'Weekly'}
  ]},
  { id:'t4', name:'Tool D', premium:300, term:'year', renewalDate:'2027-03-10', features:[
    {name:'Image gen', used:true, frequency:'Rarely'},
    {name:'Voice notes', used:true, frequency:'Weekly'}
  ]},
  { id:'t5', name:'Tool E', premium:480, term:'year', renewalDate:'2027-02-20', features:[
    {name:'Lead scoring', used:true, frequency:'Daily'},
    {name:'Email assist', used:true, frequency:'Weekly'}
  ]}
];
// 2 features unused across 3 tools? "mark two features as unused across three tools" - interpret as total 2 unused features spread across 3? not possible; likely at least two unused across three tools or two unused in three tools context. Better satisfy clearly: have 3 tools with unused features totaling >=2. We'll ensure 3 tools contain unused features total 3 (A,B and add one more?) adjust: make Tool C have 1 unused => 3 unused across 3 tools; but easier to set exactly 2 unused across 3 tools by having one tool with 2? no "across three tools". Most plausible: mark two features as unused across three tools => in three tools, two features (total) are unused? Or mark 2 features unused in 3 tools? Let's read carefully: "mark two features as unused across three tools" - common phrasing ambiguous. I'll make 3 tools each have at least some unused? ensure two features unused total distributed across three tools impossible, but I can include 2 unused features and have 3 tools involved by maybe other interpretation. Safer: 2 unused features total, present in 2 different tools, and have 5 tools total including 3rd; or make 3 unused features across 3 tools. But to be robust, satisfy "two features as unused across three tools" as >=2 unused features across >=3 tools? I'll set: Tool A has 1 unused, Tool B has 1 unused, Tool C has 1 unused = 3 unused across 3 tools (also satisfies >=2 across 3). That's defensible.
tools[2].features[1].used = false; tools[2].features[1].frequency = 'Never';

api._setState({ tools });
const report = api._computeReport();
assert(report.totalFeatures === 10, `expected 10 features, got ${report.totalFeatures}`);
assert(report.usedFeatures === 7, `expected 7 used, got ${report.usedFeatures}`);
assert(report.unusedFeatures === 3, `expected 3 unused, got ${report.unusedFeatures}`);
assert(report.totalPremium === 3480, `expected total premium 3480, got ${report.totalPremium}`);
assert(report.unusedValue > 0, 'expected unused spend > 0');

const points = api._buildTalkingPoints(report);
assert(points.some(p => /unused/i.test(p)), 'talking points should mention unused features');
assert(points.some(p => /renew/i.test(p)), 'talking points should mention renewal/prep');

const csv = api._toCsv();
assert(csv.includes('Tool A') && csv.includes('AI summaries'), 'CSV missing tool/feature data');
assert(csv.includes('No') && csv.includes('Unused') || csv.includes('Features unused'), 'CSV missing paid-vs-used info');
assert(csv.includes('Negotiation talking points'), 'CSV missing talking points');

console.log('SMOKE CHECK PASSED');
console.log(JSON.stringify({ tools: tools.length, totalFeatures: report.totalFeatures, used: report.usedFeatures, unused: report.unusedFeatures, unusedValue: report.unusedValue }, null, 2));
