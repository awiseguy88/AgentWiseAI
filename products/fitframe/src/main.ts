import './styles.css';
import { defaultSettings, type ImageItem, type Settings, type ProcessResult, type OutputFormat, type CropMode, type WatermarkPosition } from './types.ts';
import { loadSettings, saveSettings } from './settings.ts';
import { detectCapabilities } from './core/capabilities.ts';
import { loadImageFile, processBatch } from './core/processor.ts';
import { exportIndividual, exportZip, saveToFolder } from './core/export.ts';
import { buildFixtures, fixtureFile, corruptFile } from './fixtures.ts';
import { aiHooksAvailable, tryBackgroundRemoval, tryUpscale } from './core/ai-hooks.ts';

const state: {
  settings: Settings;
  items: ImageItem[];
  selectedId: string | null;
  caps: { avif: boolean; webp: boolean; jpeg: boolean; fileSystemAccess: boolean };
  processing: boolean;
  overall: number;
  lastResults: ProcessResult[];
  log: string;
} = {
  settings: loadSettings(defaultSettings()),
  items: [],
  selectedId: null,
  caps: { avif: false, webp: false, jpeg: true, fileSystemAccess: false },
  processing: false,
  overall: 0,
  lastResults: [],
  log: '',
};

let idSeq = 1;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T | null;

function persist() { saveSettings(state.settings); }

function setLog(msg: string) { state.log = msg; const el = $('#log'); if (el) el.textContent = msg; }

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  const s = state.settings;
  const selected = state.items.find(i => i.id === state.selectedId) || null;
  app.innerHTML = `
    <header>
      <h1>FitFrame</h1>
      <div class="subtitle">Bulk image resizing and export — runs fully in your browser.</div>
      <div class="privacy" id="privacy-statement">Files never leave your device.</div>
    </header>
    <div class="layout">
      <aside class="panel" id="controls">
        <h2>Input</h2>
        <div id="dropzone" class="dropzone" tabindex="0">Drop JPG, PNG, WebP, or AVIF images here<br><span class="small">or click to choose files</span></div>
        <input id="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple style="display:none" />
        <div class="actions">
          <button id="btnAddFixtures" class="secondary" type="button">Load demo fixtures</button>
          <button id="btnClear" class="secondary" type="button">Clear</button>
        </div>

        <h2 style="margin-top:14px">Resize</h2>
        <div class="row">
          <div><label for="targetW">Width (px)</label><input id="targetW" type="number" min="1" value="${s.targetWidth ?? ''}" placeholder="auto"></div>
          <div><label for="targetH">Height (px)</label><input id="targetH" type="number" min="1" value="${s.targetHeight ?? ''}" placeholder="auto"></div>
        </div>
        <label class="checkbox"><input id="lockAspect" type="checkbox" ${s.lockAspect ? 'checked' : ''}> Lock aspect ratio</label>
        <label for="cropMode">Crop mode</label>
        <select id="cropMode">
          <option value="contain" ${s.cropMode==='contain'?'selected':''}>Contain (fit, no crop)</option>
          <option value="cover" ${s.cropMode==='cover'?'selected':''}>Cover (crop to fill)</option>
          <option value="custom" ${s.cropMode==='custom'?'selected':''}>Custom per image</option>
        </select>
        <label class="checkbox"><input id="hqResize" type="checkbox" ${s.highQualityResize ? 'checked' : ''}> High-quality resize</label>

        <h2 style="margin-top:14px">Output</h2>
        <label for="outFormat">Format</label>
        <select id="outFormat">
          ${opt('original','Original',s.outputFormat)}${opt('jpeg','JPEG',s.outputFormat)}${opt('webp','WebP',s.outputFormat)}${opt('avif','AVIF',s.outputFormat)}
        </select>
        <div class="small">AVIF: ${state.caps.avif?'supported':'fallback'} · WebP: ${state.caps.webp?'supported':'fallback'} · Save to folder: ${state.caps.fileSystemAccess?'supported':'fallback'}</div>
        <label for="quality">Quality: <span id="qVal">${s.quality}</span>%</label>
        <input id="quality" type="range" min="0" max="100" value="${s.quality}">

        <h3>Rename</h3>
        <label for="renamePattern">Pattern (<code>xxx</code>, <code>ORIGINAL-NAME</code>)</label>
        <input id="renamePattern" type="text" value="${escapeAttr(s.renamePattern)}">
        <label for="renameStart">Start number</label>
        <input id="renameStart" type="number" min="0" value="${s.renameStart}">

        <fieldset>
          <legend>Text watermark</legend>
          <label class="checkbox"><input id="wmEnabled" type="checkbox" ${s.watermark.enabled?'checked':''}> Enable text watermark</label>
          <label for="wmText">Text</label><input id="wmText" type="text" value="${escapeAttr(s.watermark.text)}">
          <div class="row"><div><label>Font</label><input id="wmFont" type="text" value="${escapeAttr(s.watermark.font)}"></div><div><label>Size</label><input id="wmSize" type="number" min="1" value="${s.watermark.size}"></div></div>
          <div class="row"><div><label>Color</label><input id="wmColor" type="text" value="${escapeAttr(s.watermark.color)}"></div><div><label>Opacity (0-1)</label><input id="wmOpacity" type="number" min="0" max="1" step="0.05" value="${s.watermark.opacity}"></div></div>
          <div class="row"><div><label>Position</label><select id="wmPos">${wmPosOptions(s.watermark.position)}</select></div><div><label>Angle</label><input id="wmAngle" type="number" value="${s.watermark.angle}"></div></div>
        </fieldset>

        <fieldset>
          <legend>Border</legend>
          <label class="checkbox"><input id="borderEnabled" type="checkbox" ${s.border.enabled?'checked':''}> Enable border</label>
          <div class="row"><div><label>Color</label><input id="borderColor" type="text" value="${escapeAttr(s.border.color)}"></div><div><label>Thickness (px)</label><input id="borderTh" type="number" min="0" value="${s.border.thickness}"></div></div>
        </fieldset>

        <fieldset>
          <legend>AI hooks (optional, local)</legend>
          <label class="checkbox"><input id="aiBg" type="checkbox" ${s.ai.backgroundRemoval?'checked':''}> Background removal <span class="badge">${aiHooksAvailable()?'ready':'graceful fallback'}</span></label>
          <label for="aiUpscale">Super-resolution upscale</label>
          <select id="aiUpscale">${[1,2,3,4].map(n=>`<option value="${n}" ${s.ai.upscale===n?'selected':''}>${n}x${n===1?' (off)':''}</option>`).join('')}</select>
          <div class="small">Optional models are lazy-loaded and degrade gracefully when unavailable.</div>
        </fieldset>

        <h2 style="margin-top:14px">Export</h2>
        <div class="actions">
          <button id="btnProcessZip" ${state.processing?'disabled':''}>Process & Download ZIP</button>
          <button id="btnProcessEach" class="secondary" ${state.processing?'disabled':''}>Export individually</button>
          <button id="btnSaveFolder" class="secondary" ${state.processing?'disabled':''}>Save to folder</button>
        </div>
        <div class="overall">
          <div class="small">Overall progress</div>
          <div class="progress-bar"><span id="overallBar" style="width:${Math.round(state.overall*100)}%"></span></div>
        </div>
        <div id="log" class="log">${escapeHtml(state.log)}</div>
      </aside>

      <main>
        <div class="panel">
          <h2>Images <span class="small">(${state.items.length})</span></h2>
          <div id="grid" class="grid">${state.items.map(renderCard).join('') || '<div class="small">No images yet. Drop files or load demo fixtures.</div>'}</div>
        </div>
        ${selected ? renderSelectedPanel(selected) : ''}
      </main>
    </div>
    <footer class="note">Shortcuts: Ctrl/Cmd+O open files · Esc clear selection · Tip: click an image to adjust focal point/crop for that image only.</footer>
  `;
  bindEvents();
}

function opt(val: OutputFormat, label: string, cur: OutputFormat) { return `<option value="${val}" ${val===cur?'selected':''}>${label}</option>`; }
function wmPosOptions(cur: WatermarkPosition) {
  const opts: [WatermarkPosition,string][] = [['top-left','Top left'],['top-center','Top center'],['top-right','Top right'],['middle-left','Middle left'],['middle-center','Middle center'],['middle-right','Middle right'],['bottom-left','Bottom left'],['bottom-center','Bottom center'],['bottom-right','Bottom right']];
  return opts.map(([v,l])=>`<option value="${v}" ${v===cur?'selected':''}>${l}</option>`).join('');
}
function escapeHtml(s: string){ return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c] as string)); }
function escapeAttr(s: string){ return escapeHtml(s); }

function renderCard(item: ImageItem): string {
  const status = item.status==='error' ? `<div class="status error">Error: ${escapeHtml(item.error||'failed')}</div>` : item.status==='done' ? `<div class="status done">Ready</div>` : item.status==='processing' ? `<div class="status">Processing…</div>` : `<div class="status">Queued</div>`;
  const pct = Math.round((item.progress||0)*100);
  return `<div class="card ${state.selectedId===item.id?'selected':''}" data-id="${item.id}" tabindex="0">
    <img class="thumb" src="${item.thumbUrl}" alt="${escapeAttr(item.name)}">
    <div class="meta"><strong>${escapeHtml(item.name)}</strong>${item.width}×${item.height} · ${(item.size/1024).toFixed(1)} KB${status}
      <div class="progress-bar"><span style="width:${pct}%"></span></div>
    </div>
  </div>`;
}

function renderSelectedPanel(item: ImageItem): string {
  return `<div class="panel" style="margin-top:12px">
    <h2>Selected image: ${escapeHtml(item.name)}</h2>
    <div class="small">Per-image focal point and custom crop. Changes affect only this image.</div>
    <div class="row">
      <div><label>Focal X (0-1)</label><input id="focalX" type="number" min="0" max="1" step="0.01" value="${item.focal.x}"></div>
      <div><label>Focal Y (0-1)</label><input id="focalY" type="number" min="0" max="1" step="0.01" value="${item.focal.y}"></div>
    </div>
    <div class="actions"><button id="btnFocalCenter" class="secondary" type="button">Auto focal</button><button id="btnClearSel" class="secondary" type="button">Deselect (Esc)</button></div>
    <details style="margin-top:8px"><summary>Custom crop (source pixels, used when crop mode is Custom)</summary>
      <div class="row">
        <div><label>X</label><input id="cropX" type="number" min="0" value="${item.customCrop?.x ?? 0}"></div>
        <div><label>Y</label><input id="cropY" type="number" min="0" value="${item.customCrop?.y ?? 0}"></div>
      </div>
      <div class="row">
        <div><label>W</label><input id="cropW" type="number" min="1" value="${item.customCrop?.w ?? item.width}"></div>
        <div><label>H</label><input id="cropH" type="number" min="1" value="${item.customCrop?.h ?? item.height}"></div>
      </div>
    </details>
  </div>`;
}

function bindEvents() {
  const fileInput = $('#fileInput') as HTMLInputElement | null;
  const dropzone = $('#dropzone');
  dropzone?.addEventListener('click', () => fileInput?.click());
  dropzone?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput?.click(); } });
  ['dragenter','dragover'].forEach(ev => dropzone?.addEventListener(ev, (e)=>{ e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => dropzone?.addEventListener(ev, (e)=>{ e.preventDefault(); dropzone.classList.remove('drag'); }));
  dropzone?.addEventListener('drop', (e: any) => handleFiles(e.dataTransfer?.files));
  fileInput?.addEventListener('change', () => handleFiles(fileInput.files));

  on('#btnAddFixtures','click', async () => {
    try {
      const files = buildFixtures().map(fixtureFile);
      await addFiles(files);
      setLog('Loaded 3 demo fixtures.');
    } catch (e:any) { setLog(`Fixture error: ${e?.message||e}`); }
  });
  on('#btnClear','click', () => { state.items = []; state.selectedId = null; state.lastResults = []; render(); });

  bindSetting('#targetW','targetWidth', (v)=> v===''?null:Number(v));
  bindSetting('#targetH','targetHeight', (v)=> v===''?null:Number(v));
  bindCheck('#lockAspect','lockAspect');
  bindSelect('#cropMode','cropMode');
  bindCheck('#hqResize','highQualityResize');
  bindSelect('#outFormat','outputFormat');
  bindRange('#quality','quality');
  bindSetting('#renamePattern','renamePattern', v=>String(v));
  bindSetting('#renameStart','renameStart', v=>Number(v)||1);

  bindCheck('#wmEnabled', null, (c)=>{ state.settings.watermark.enabled = c; persist(); });
  bindInput('#wmText', v=>{ state.settings.watermark.text = String(v); persist(); });
  bindInput('#wmFont', v=>{ state.settings.watermark.font = String(v)||'sans-serif'; persist(); });
  bindInput('#wmSize', v=>{ state.settings.watermark.size = Number(v)||32; persist(); });
  bindInput('#wmColor', v=>{ state.settings.watermark.color = String(v)||'#ffffff'; persist(); });
  bindInput('#wmOpacity', v=>{ state.settings.watermark.opacity = Math.max(0,Math.min(1,Number(v))); persist(); });
  bindSelect('#wmPos', null, v=>{ state.settings.watermark.position = v as WatermarkPosition; persist(); });
  bindInput('#wmAngle', v=>{ state.settings.watermark.angle = Number(v)||0; persist(); });

  bindCheck('#borderEnabled', null, (c)=>{ state.settings.border.enabled = c; persist(); });
  bindInput('#borderColor', v=>{ state.settings.border.color = String(v)||'#000'; persist(); });
  bindInput('#borderTh', v=>{ state.settings.border.thickness = Math.max(0, Number(v)||0); persist(); });

  bindCheck('#aiBg', null, async (c)=>{ state.settings.ai.backgroundRemoval = c; persist(); if(c){ const r=await tryBackgroundRemoval(); setLog(r.message); render(); }});
  bindSelect('#aiUpscale', null, async (v)=>{ state.settings.ai.upscale = (Number(v)||1) as 1|2|3|4; persist(); if(state.settings.ai.upscale>1){ const r=await tryUpscale(state.settings.ai.upscale); setLog(r.message);} });

  on('#btnProcessZip','click', ()=> runExport('zip'));
  on('#btnProcessEach','click', ()=> runExport('each'));
  on('#btnSaveFolder','click', ()=> runExport('folder'));

  document.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => { state.selectedId = (el as HTMLElement).dataset.id || null; render(); });
  });

  const sel = state.items.find(i=>i.id===state.selectedId);
  if (sel) {
    bindInput('#focalX', v=>{ sel.focal.x = clamp01(Number(v)); });
    bindInput('#focalY', v=>{ sel.focal.y = clamp01(Number(v)); });
    on('#btnFocalCenter','click', ()=>{ sel.focal = { x:0.5, y:0.45 }; render(); });
    on('#btnClearSel','click', ()=>{ state.selectedId = null; render(); });
    ['#cropX','#cropY','#cropW','#cropH'].forEach(id => {
      const inp = $(id) as HTMLInputElement | null;
      inp?.addEventListener('change', () => {
        const x = Number(($('#cropX') as HTMLInputElement)?.value || 0);
        const y = Number(($('#cropY') as HTMLInputElement)?.value || 0);
        const w = Number(($('#cropW') as HTMLInputElement)?.value || sel.width);
        const h = Number(($('#cropH') as HTMLInputElement)?.value || sel.height);
        sel.customCrop = { x, y, w, h };
      });
    });
  }
}
function clamp01(v:number){ return Math.max(0, Math.min(1, isFinite(v)?v:0.5)); }
function on(sel:string, ev:string, fn:(e:Event)=>void){ $(sel)?.addEventListener(ev, fn as any); }
function bindSetting(sel:string, key:keyof Settings, conv:(v:any)=>any){ const el=$(sel) as HTMLInputElement|null; el?.addEventListener('change',()=>{ (state.settings as any)[key]=conv(el.value); persist(); }); }
function bindCheck(sel:string, key:keyof Settings | null, extra?: (c:boolean)=>void){ const el=$(sel) as HTMLInputElement|null; el?.addEventListener('change',()=>{ const c=el.checked; if(key) (state.settings as any)[key]=c; extra?.(c); persist(); }); }
function bindSelect(sel:string, key:keyof Settings | null, extra?: (v:string)=>void){ const el=$(sel) as HTMLSelectElement|null; el?.addEventListener('change',()=>{ const v=el.value; if(key) (state.settings as any)[key]=v; extra?.(v); persist(); }); }
function bindRange(sel:string, key:keyof Settings){ const el=$(sel) as HTMLInputElement|null; el?.addEventListener('input',()=>{ (state.settings as any)[key]=Number(el.value); const qv=$('#qVal'); if(qv) qv.textContent=el.value; persist(); }); }
function bindInput(sel:string, fn:(v:any)=>void){ const el=$(sel) as HTMLInputElement|null; el?.addEventListener('change',()=>fn(el.value)); }

async function handleFiles(fileList: FileList | null | undefined) {
  if (!fileList || !fileList.length) return;
  await addFiles(Array.from(fileList));
}
async function addFiles(files: File[]) {
  for (const file of files) {
    const id = String(idSeq++);
    try {
      const { item } = await loadImageFile(file, 0);
      state.items.push({ id, status: 'queued', progress: 0, ...item } as ImageItem);
    } catch (e:any) {
      // show as errored item so batch can continue/report
      state.items.push({ id, file, name: file.name, originalName: file.name.replace(/\.[^.]+$/, ''), size: file.size, width: 0, height: 0, thumbUrl: '', focal:{x:0.5,y:0.45}, status:'error', progress:0, error: e?.message || 'Unsupported or corrupt image' } as ImageItem);
    }
  }
  render();
}

async function runExport(mode: 'zip'|'each'|'folder') {
  if (state.processing || !state.items.length) return;
  state.processing = true; state.overall = 0; state.lastResults = [];
  render();
  const okItems = state.items.filter(i => i.status !== 'error' || i.width>0);
  // mark queued for processable ones
  state.items.forEach(i => { if (i.status !== 'error') { i.status = 'processing'; i.progress = 0; } });
  render();
  const results = await processBatch(okItems, state.settings, state.caps, (id, p, overall) => {
    const it = state.items.find(x=>x.id===id);
    if (it) { it.progress = p; if (p>=1) it.status = 'processing'; }
    state.overall = overall;
    const bar = $('#overallBar') as HTMLElement | null; if (bar) bar.style.width = `${Math.round(overall*100)}%`;
  });
  state.lastResults = results;
  // apply results
  for (const r of results) {
    const it = state.items.find(x=>x.id===r.id);
    if (!it) continue;
    if (r.ok) { it.status = 'done'; it.progress = 1; it.outputBlob = r.blob; it.outputName = r.name; }
    else { it.status = 'error'; it.error = r.error; it.progress = 1; }
  }
  const good = results.filter(r=>r.ok);
  try {
    if (mode === 'zip') await exportZip(good);
    else if (mode === 'each') exportIndividual(good);
    else {
      const res = await saveToFolder(good);
      setLog(res.message || (res.ok ? 'Saved.' : 'Save failed'));
    }
    setLog(`${good.length} file(s) exported, ${results.length-good.length} failed.`);
  } catch (e:any) {
    setLog(`Export error: ${e?.message||e}`);
  }
  state.processing = false; state.overall = 1;
  render();
}

// keyboard shortcuts
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); ($('#fileInput') as HTMLInputElement | null)?.click(); }
  if (e.key === 'Escape') { state.selectedId = null; render(); }
});

(async function init(){
  try { state.caps = await detectCapabilities(); } catch {}
  // expose a tiny hook for tests/demo
  (window as any).__fitframe = { state, addCorrupt: async ()=>{ await addFiles([corruptFile()]); } };
  render();
  setLog('Ready. Files never leave your device.');
})();