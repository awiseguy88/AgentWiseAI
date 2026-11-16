/**
 * Programmatic synthetic fixtures (no external assets).
 * Each fixture declares deterministic dimensions and a generator spec that
 * produces a Canvas element in a browser context. Dimensions here are the
 * contract verified by tests; pixel rendering happens at runtime in the browser.
 */

export interface FixtureSpec {
  name: string;
  width: number;
  height: number;
  format: 'png' | 'jpg' | 'webp';
  description: string;
  generate: () => HTMLCanvasElement;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function genGradient(): HTMLCanvasElement {
  const c = makeCanvas(1200, 800);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 1200, 800);
  g.addColorStop(0, '#0ea5e9');
  g.addColorStop(0.5, '#6366f1');
  g.addColorStop(1, '#ec4899');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1200, 800);
  return c;
}

export function genCheckerboard(): HTMLCanvasElement {
  const c = makeCanvas(1000, 1000);
  const ctx = c.getContext('2d')!;
  const size = 50;
  for (let y = 0; y < 1000; y += size) {
    for (let x = 0; x < 1000; x += size) {
      ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#0f172a' : '#e2e8f0';
      ctx.fillRect(x, y, size, size);
    }
  }
  return c;
}

export function genNoise(): HTMLCanvasElement {
  const c = makeCanvas(800, 600);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(800, 600);
  let seed = 424242;
  function rand() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = Math.floor(rand() * 256);
    img.data[i + 1] = Math.floor(rand() * 256);
    img.data[i + 2] = Math.floor(rand() * 256);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function genPortrait(): HTMLCanvasElement {
  const c = makeCanvas(800, 1200);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 1200);
  g.addColorStop(0, '#1e293b');
  g.addColorStop(1, '#0ea5e9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 800, 1200);
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(400, 400, 150, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function genLandscape(): HTMLCanvasElement {
  const c = makeCanvas(1200, 800);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 1200, 0);
  g.addColorStop(0, '#0f172a');
  g.addColorStop(0.5, '#6366f1');
  g.addColorStop(1, '#f59e0b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1200, 800);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(100, 200, 300, 200);
  ctx.fillRect(500, 300, 400, 150);
  return c;
}

export const FIXTURES: FixtureSpec[] = [
  { name: 'test-gradient.png', width: 1200, height: 800, format: 'png', description: 'Linear gradient', generate: genGradient },
  { name: 'test-pattern.png', width: 1000, height: 1000, format: 'png', description: 'Checkerboard', generate: genCheckerboard },
  { name: 'test-noise.png', width: 800, height: 600, format: 'png', description: 'Seeded noise', generate: genNoise },
  { name: 'test-portrait.jpg', width: 800, height: 1200, format: 'jpg', description: 'Portrait gradient + circle', generate: genPortrait },
  { name: 'test-landscape.webp', width: 1200, height: 800, format: 'webp', description: 'Horizontal gradient + rects', generate: genLandscape },
];