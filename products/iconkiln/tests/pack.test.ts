import { describe, it, expect } from 'vitest';
import { planPack, buildManifest, buildReadme } from '../src/core/pack';

describe('pack: planPack (ICK-013, WF-4 D3, WF-5 E1)', () => {
  it('includes per-size PNGs for every selected size', () => {
    const plan = planPack('myapp', [{ w: 16, h: 16 }, { w: 32, h: 32 }]);
    const sizeNames = plan.images.filter((i) => i.role === 'size').map((i) => i.name);
    expect(sizeNames).toContain('myapp-16x16.png');
    expect(sizeNames).toContain('myapp-32x32.png');
  });

  it('adds conventional favicon, apple-touch, and android-chrome assets', () => {
    const plan = planPack('myapp', [{ w: 64, h: 64 }]);
    const names = plan.images.map((i) => i.name);
    // apple touch icon present
    expect(names).toContain('apple-touch-icon.png');
    // android chrome 192 and 256
    expect(names).toContain('android-chrome-192x192.png');
    expect(names).toContain('android-chrome-256x256.png');
  });

  it('does not duplicate a favicon size already covered by a selected size', () => {
    const plan = planPack('myapp', [{ w: 16, h: 16 }, { w: 32, h: 32 }]);
    const favicon16 = plan.images.filter((i) => i.name === 'favicon-16x16.png');
    expect(favicon16).toHaveLength(0);
  });
});

describe('pack: buildManifest (ICK-013, D3)', () => {
  it('produces a manifest with correct icon entries and sizes strings', () => {
    const plan = planPack('myapp', [{ w: 48, h: 48 }]);
    const manifest = buildManifest(plan, 'myapp');
    expect(manifest.name).toBe('myapp');
    const icons = manifest.icons as Array<{ src: string; sizes: string; type: string }>;
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.type).toBe('image/png');
      expect(icon.sizes).toMatch(/^\d+x\d+$/);
    }
  });

  it('manifest is JSON-serializable and parses back (D3)', () => {
    const plan = planPack('app', [{ w: 32, h: 32 }]);
    const manifest = buildManifest(plan, 'app');
    const round = JSON.parse(JSON.stringify(manifest));
    expect(round.icons.length).toBe(manifest.icons instanceof Array ? (manifest.icons as unknown[]).length : 0);
  });
});

describe('pack: buildReadme', () => {
  it('lists all files and usage notes', () => {
    const plan = planPack('myapp', [{ w: 32, h: 32 }]);
    const readme = buildReadme('myapp', plan);
    expect(readme).toContain('myapp-32x32.png');
    expect(readme).toContain('site.webmanifest');
    expect(readme).toContain('README.txt');
    expect(readme.toLowerCase()).toContain('browser');
  });
});