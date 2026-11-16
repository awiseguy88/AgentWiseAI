export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function renderHeader(container: HTMLElement): void {
  container.innerHTML = `
    <div class="brand">
      <div class="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
      </div>
      <div>
        <h1>PicturaBox</h1>
        <p>Browser-only image resize, format conversion, and batch export — all processing happens locally on your device.</p>
      </div>
    </div>
    <span class="privacy" id="privacy-statement" title="No uploads, no network calls after load">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      Your images never leave your device
    </span>
  `;
}

export function initTheme(settings: { theme: 'light' | 'dark' }): void {
  document.documentElement.setAttribute('data-theme', settings.theme);
}

export function renderFooter(container: HTMLElement): void {
  container.innerHTML = `
    <span>PicturaBox — runs entirely in your browser.</span>
    <span><a href="https://aaronwiseai.com/" target="_blank" rel="noopener">AaronWiseAI</a></span>
  `;
}