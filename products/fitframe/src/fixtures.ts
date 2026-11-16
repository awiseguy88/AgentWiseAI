import { splitName } from './core/rename.ts';

export interface FixtureSpec {
  id: string;
  name: string;
  w: number;
  h: number;
  draw: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number) => void;
}

export function buildFixtures(): FixtureSpec[] {
  return [
    {
      id: 'gradient',
      name: 'gradient.png',
      w: 1200,
      h: 800,
      draw: (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#1e3a8a');
        g.addColorStop(0.5, '#7c3aed');
        g.addColorStop(1, '#db2777');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      },
    },
    {
      id: 'checker',
      name: 'checker.png',
      w: 1000,
      h: 1000,
      draw: (ctx, w, h) => {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, w, h);
        const cell = 100;
        for (let y = 0; y < h; y += cell) {
          for (let x = 0; x < w; x += cell) {
            if (((x / cell) + (y / cell)) % 2 === 0) {
              ctx.fillStyle = '#fafafa';
              ctx.fillRect(x, y, cell, cell);
            }
          }
        }
      },
    },
    {
      id: 'noise',
      name: 'noise.png',
      w: 800,
      h: 600,
      draw: (ctx, w, h) => {
        const img = ctx.getImageData(0, 0, w, h);
        let seed = 1337;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (let i = 0; i < img.data.length; i += 4) {
          img.data[i] = Math.floor(rnd() * 256);
          img.data[i + 1] = Math.floor(rnd() * 256);
          img.data[i + 2] = Math.floor(rnd() * 256);
          img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      },
    },
  ];
}

export function fixtureFile(spec: FixtureSpec): File {
  const canvas = document.createElement('canvas');
  canvas.width = spec.w; canvas.height = spec.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d ctx');
  spec.draw(ctx, spec.w, spec.h);
  const dataUrl = canvas.toDataURL('image/png');
  const bin = atob(dataUrl.split(',')[1]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], spec.name, { type: 'image/png' });
}

export function syntheticFile(name: string, bytes: Uint8Array, type = 'image/png'): File {
  return new File([bytes as BlobPart], name, { type });
}

export function corruptFile(): File {
  return new File([new Uint8Array([0, 1, 2, 3, 4, 5])], 'broken.png', { type: 'image/png' });
}