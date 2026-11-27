import type { Theme } from '../core/theme';

export type Route = 'generate' | 'pack' | 'guide' | 'about';

const ROUTES: Route[] = ['generate', 'pack', 'guide', 'about'];

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').split('?')[0];
  if ((ROUTES as string[]).includes(clean)) return clean as Route;
  return 'generate';
}

export interface HeaderOpts {
  theme: Theme;
  onThemeToggle: () => void;
}

export function renderHeader(container: HTMLElement, active: Route, opts: HeaderOpts): void {
  const link = (route: Route, label: string) =>
    `<a href="#/${route}" data-route="${route}" class="${route === active ? 'active' : ''}">${label}</a>`;
  container.innerHTML = `
    <div class="brand">
      <div class="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3 L21 12 L12 21 L3 12 Z"/></svg>
      </div>
      <div>
        <h1>IconKiln</h1>
        <p class="tag">App icon &amp; favicon pack generator</p>
      </div>
    </div>
    <nav class="nav" aria-label="Primary">
      ${link('generate', 'Generate')}
      ${link('pack', 'Pack')}
      ${link('guide', 'Guide')}
      ${link('about', 'About')}
      <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle theme">${opts.theme === 'dark' ? '☀ Light' : '☾ Dark'}</button>
    </nav>
  `;
  const btn = container.querySelector('#theme-toggle');
  btn?.addEventListener('click', opts.onThemeToggle);
}

export function renderFooter(container: HTMLElement): void {
  container.innerHTML = `
    <span>IconKiln — runs entirely in your browser. No uploads.</span>
    <span><a href="https://aaronwiseai.com/" target="_blank" rel="noopener">AaronWiseAI</a></span>
  `;
}

export function showRoute(route: Route): void {
  for (const r of ROUTES) {
    const el = document.getElementById(`view-${r}`);
    if (el) el.classList.toggle('active', r === route);
  }
}