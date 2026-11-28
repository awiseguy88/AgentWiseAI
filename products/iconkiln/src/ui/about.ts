export function renderAbout(container: HTMLElement): void {
  container.innerHTML = `
    <h2 class="page-title">About IconKiln</h2>
    <p class="page-sub">A browser-only app-icon and favicon pack generator for AI agents and developers.</p>
    <div class="panel doc">
      <h3>Offline &amp; private</h3>
      <p>IconKiln runs entirely in your browser. After the static bundle loads, it makes <strong>no network requests</strong> — your images are decoded, resized, and encoded on your own device and never uploaded anywhere. Your theme preference is stored locally in <code>localStorage</code>.</p>

      <h3>What it does</h3>
      <p>One source image in, a complete icon asset set out: a multi-resolution <code>.ico</code> or per-size PNGs, individual downloads, and a ZIP pack with conventional favicon, Apple touch, and Android chrome assets plus a <code>site.webmanifest</code> and <code>README.txt</code>.</p>

      <h3>Privacy summary</h3>
      <ul>
        <li>No uploads, no accounts, no analytics.</li>
        <li>No network calls after the page loads.</li>
        <li>All processing is client-side.</li>
      </ul>

      <p class="small muted">IconKiln is open source under the MIT license.</p>
      <p class="small">Part of the <a href="https://aaronwiseai.com/" target="_blank" rel="noopener">AaronWiseAI</a> open-source tool collection — <a href="https://aaronwiseai.com/" target="_blank" rel="noopener">https://aaronwiseai.com/</a>.</p>
    </div>
  `;
}