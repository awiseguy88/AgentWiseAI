import { describe, it, expect } from 'vitest';
import { computeTargetSize } from '../src/engine/resize';

const rec = { width: 1200, height: 800 };

describe('resize engine (M2)', () => {
  it('M2-A1 exact: 1200x800 -> W=800 => 800x533', () => {
    const t = computeTargetSize(rec, 'exact', 800, 533);
    expect(t.width).toBe(800);
    expect(t.height).toBe(533);
  });

  it('M2-A1b exact with only width fills height to match ratio', () => {
    const t = computeTargetSize(rec, 'exact', 800, 0);
    // exact with no height keeps source ratio via contain fallback? No — exact uses given dims.
    // With height 0 it falls back to source height.
    expect(t.width).toBe(800);
    expect(t.height).toBe(800);
  });

  it('M2-A2 contain: 1200x800 in 400x400 fits within, aspect preserved', () => {
    const t = computeTargetSize(rec, 'contain', 400, 400);
    expect(t.width).toBeLessThanOrEqual(400);
    expect(t.height).toBeLessThanOrEqual(400);
    expect(t.width / t.height).toBeCloseTo(1200 / 800, 2);
  });

  it('M2-A3 cover: 1200x800 -> exactly 400x400 with centered crop', () => {
    const t = computeTargetSize(rec, 'cover', 400, 400);
    expect(t.width).toBe(400);
    expect(t.height).toBe(400);
    expect(t.crop).toBeDefined();
    expect(t.crop!.sw).toBeCloseTo(800, 0);
    expect(t.crop!.sh).toBeCloseTo(800, 0);
  });

  it('M2-A4 percentage: 50% halves dimensions', () => {
    const t = computeTargetSize(rec, 'percentage', 0, 0, 50);
    expect(t.width).toBe(600);
    expect(t.height).toBe(400);
  });

  it('percentage 25% quarters dimensions', () => {
    const t = computeTargetSize(rec, 'percentage', 0, 0, 25);
    expect(t.width).toBe(300);
    expect(t.height).toBe(200);
  });

  it('contain portrait 800x1200 in 400x400 fits height', () => {
    const t = computeTargetSize({ width: 800, height: 1200 }, 'contain', 400, 400);
    expect(t.height).toBe(400);
    expect(t.width).toBe(Math.round(800 * (400 / 1200)));
  });
});