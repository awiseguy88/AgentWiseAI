import type { GenerateState } from './generate';
import { assetBaseName } from '../core/build';
import { planPack, buildManifest, buildReadme } from '../core/pack';

export function renderPack(container: HTMLElement, state: GenerateState): void {
  const src = state.source;
  if (!src) {
    container.innerHTML = `
      <h2 class="page-title">Pack preview</h2>
      <p class="page-sub">See every file the ZIP pack will contain and preview the manifest before exporting.</p>
      <div class="panel"><p class="empty-note">Load a source image on the Generate tab first, then return here to preview the pack.</p></div>
    `;
    return;
  }
  const base = assetBaseName(src.name);
  const plan = planPack(base, state.settings.sizes);
  const manifest = buildManifest(plan, base);
  const readme = buildReadme(base, plan);

  const fileRows = plan.images
    .map((img) => `<li><span>${img.name}</span><span class="sz">${img.size.w}×${img.size.h}</span></li>`)
    .join('');
  const manifestRows = `<li><span>${plan.manifestName}</span><span class="sz">manifest</span></li><li><span>${plan.readmeName}</span><span class="sz">readme</span></li>`;

  container.innerHTML = `
    <h2 class="page-title">Pack preview</h2>
    <p class="page-sub">The ZIP pack contains these files. The manifest references the generated PNG icons; export from the Generate tab.</p>
    <div class="panel">
      <h3>Files in ${base}-icon-pack.zip</h3>
      <ul class="file-list">${fileRows}${manifestRows}</ul>
    </div>
    <div class="panel">
      <h3>${plan.manifestName}</h3>
      <pre class="code">${escapeHtml(JSON.stringify(manifest, null, 2))}</pre>
    </div>
    <div class="panel">
      <h3>${plan.readmeName}</h3>
      <pre class="code">${escapeHtml(readme)}</pre>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}