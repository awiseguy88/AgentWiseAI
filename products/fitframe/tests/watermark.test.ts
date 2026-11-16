import { describe, it, expect } from 'vitest';
import { positionToOffsets } from '../src/core/watermark.ts';

describe('watermark positioning math', () => {
  const w = 1000, h = 600;
  const pad = 0.05; // 50px, 30px

  it('top-left aligns to padded top-left', () => {
    const p = positionToOffsets('top-left', w, h, 0, 0);
    expect(p.x).toBe(50);
    expect(p.y).toBe(30);
    expect(p.align).toBe('left');
    expect(p.baseline).toBe('top');
  });

  it('bottom-right aligns to padded bottom-right', () => {
    const p = positionToOffsets('bottom-right', w, h, 0, 0);
    expect(p.x).toBe(950);
    expect(p.y).toBe(570);
    expect(p.align).toBe('right');
    expect(p.baseline).toBe('bottom');
  });

  it('middle-center centers both axes', () => {
    const p = positionToOffsets('middle-center', w, h, 0, 0);
    expect(p.x).toBe(500);
    expect(p.y).toBe(300);
    expect(p.align).toBe('center');
    expect(p.baseline).toBe('middle');
  });

  it('top-center centers horizontally, top vertically', () => {
    const p = positionToOffsets('top-center', w, h, 0, 0);
    expect(p.x).toBe(500);
    expect(p.y).toBe(30);
    expect(p.align).toBe('center');
    expect(p.baseline).toBe('top');
  });

  it('middle-right right-aligns, middle vertically', () => {
    const p = positionToOffsets('middle-right', w, h, 0, 0);
    expect(p.x).toBe(950);
    expect(p.y).toBe(300);
    expect(p.align).toBe('right');
    expect(p.baseline).toBe('middle');
  });

  it('bottom-left left-aligns, bottom vertically', () => {
    const p = positionToOffsets('bottom-left', w, h, 0, 0);
    expect(p.x).toBe(50);
    expect(p.y).toBe(570);
    expect(p.align).toBe('left');
    expect(p.baseline).toBe('bottom');
  });
});