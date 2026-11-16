/**
 * Synthetic test fixtures generated programmatically (no external assets).
 * Generates Canvas-compatible data URLs and ImageData for tests.
 */

export interface FixtureSpec {
  name: string;
  width: number;
  height: number;
  format: 'png' | 'jpg' | 'webp';
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
  g.addColorStop(0, '#ff6b6b');
  g.addColorStop(0.5, '#4ecdc4');
  g.addColorStop(1, '#45b7d1');
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
      ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#222' : '#eee';
      ctx.fillRect(x, y, size, size);
    }
  }
  return c;
}

export function genNoise(): HTMLCanvasElement {
  const c = makeCanvas(800, 600);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(800, 600);
  // Deterministic seeded LCG
  let seed = 12345;
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
  g.addColorStop(0, '#2c3e50');
  g.addColorStop(1, '#3498db');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 800, 1200);
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(400, 400, 150, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function genLandscape(): HTMLCanvasElement {
  const c = makeCanvas(1200, 800);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 1200, 0);
  g.addColorStop(0, '#1a2a6c');
  g.addColorStop(0.5, '#b21f1f');
  g.addColorStop(1, '#fdbb2d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1200, 800);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(100, 200, 300, 200);
  ctx.fillRect(500, 300, 400, 150);
  return c;
}

export const FIXTURES: FixtureSpec[] = [
  { name: 'test-gradient.png', width: 1200, height: 800, format: 'png', generate: genGradient },
  { name: 'test-pattern.png', width: 1000, height: 1000, format: 'png', generate: genCheckerboard },
  { name: 'test-noise.png', width: 800, height: 600, format: 'png', generate: genNoise },
  { name: 'test-portrait.jpg', width: 800, height: 1200, format: 'jpg', generate: genPortrait },
  { name: 'test-landscape.webp', width: 1200, height: 800, format: 'webp', generate: genLandscape },
];
