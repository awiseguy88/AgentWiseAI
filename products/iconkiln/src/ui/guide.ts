export function renderGuide(container: HTMLElement): void {
  container.innerHTML = `
    <h2 class="page-title">Guide</h2>
    <p class="page-sub">How IconKiln turns one source image into a complete icon set, and what each output is for.</p>
    <div class="panel doc">
      <h3>1. Load a source image</h3>
      <p>Drop an image or use the file picker. IconKiln accepts PNG, SVG, JPG, BMP, GIF (first frame), and WebP. SVG is rasterized locally. Files that are unsupported or larger than 32&nbsp;MB are rejected with an inline message and never crash the app. <em>Load sample</em> fills the stage with a bundled original image.</p>

      <h3>2. Choose an icon type</h3>
      <p><strong>Multi-resolution (.ico)</strong> packs every selected size into a single <code>favicon.ico</code>. <strong>One file per size</strong> produces a separate <code>name-&lt;W&gt;x&lt;H&gt;.png</code> for each size.</p>

      <h3>3. Pick sizes</h3>
      <p>Toggle the preset chips (16, 24, 32, 48, 64, 128, 256) independently, or type a custom list like <code>30x30,60x60</code>. Custom sizes are validated and clamped to the 16–256 range; a bare number such as <code>64</code> is treated as <code>64x64</code>.</p>

      <h3>4. Background</h3>
      <p>Keep transparency to preserve an alpha channel through to the PNG and ICO, or flatten onto a chosen color to remove transparency.</p>

      <h3>5. Preview and export</h3>
      <p>Each size previews at exact pixel dimensions on a checkerboard so transparency is visible. Export a multi-resolution <code>.ico</code>, individual PNGs, any single asset, or a full ZIP pack.</p>

      <h3>The ICO container</h3>
      <p>A Windows icon (<code>.ico</code>) is an <code>ICONDIR</code> header followed by one <code>ICONDIRENTRY</code> per frame and the image blocks. IconKiln writes PNG-encoded blocks, so transparency is preserved. The directory stores width/height as a single byte where <code>0</code> means 256.</p>
      <table>
        <thead><tr><th>Size</th><th>Typical use</th></tr></thead>
        <tbody>
          <tr><td>16×16</td><td>Browser tab favicon</td></tr>
          <tr><td>24×24</td><td>Windows taskbar / shortcuts</td></tr>
          <tr><td>32×32</td><td>High-DPI tab / Windows</td></tr>
          <tr><td>48×48</td><td>Windows site tile</td></tr>
          <tr><td>64×64</td><td>General app icon</td></tr>
          <tr><td>128×128</td><td>Store / high-res</td></tr>
          <tr><td>180×180</td><td>Apple touch icon</td></tr>
          <tr><td>192 / 256</td><td>Android chrome / PWA</td></tr>
        </tbody>
      </table>

      <h3>The ZIP pack</h3>
      <p>The pack contains conventional <code>favicon</code>, <code>apple-touch-icon</code>, and <code>android-chrome</code> PNGs, a valid <code>site.webmanifest</code> referencing those icons, and a <code>README.txt</code>. Drop the files at your site root and link the manifest from your HTML <code>&lt;head&gt;</code>.</p>
    </div>
  `;
}