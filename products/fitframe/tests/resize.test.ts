import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeTargetSize, computeResizePlan, suggestFocalPoint } from '../src/core/resize.ts';

describe('resize math', () => {
  it('aspect lock: width only scales height proportionally', () => {
    const r = computeTargetSize(1000, 500, 800, null, true);
    expect(r.w).toBe(800);
    expect(r.h).toBe(400);
  });

  it('aspect lock: height only scales width proportionally', () => {
    const r = computeTargetSize(1000, 500, null, 400, true);
    expect(r.h).toBe(400);
    expect(r.w).toBe(800);
  });

  it('aspect lock: both given fits to width and adjusts height', () => {
    const r = computeTargetSize(1000, 500, 800, 600, true);
    expect(r.w).toBe(800);
    expect(r.h).toBe(400);
  });

  it('no lock: both given used as-is', () => {
    const r = computeTargetSize(1000, 500, 800, 600, false);
    expect(r.w).toBe(800);
    expect(r.h).toBe(600);
  });

  it('no target: original size', () => {
    const r = computeTargetSize(1000, 500, null, null, false);
    expect(r.w).toBe(1000);
    expect(r.h).toBe(500);
  });

  it('contain keeps source fully visible, letterboxes', () => {
    const p = computeResizePlan({ srcW: 1000, srcH: 500, targetW: 500, targetH: 500, lockAspect: false, cropMode: 'contain', focal: { x: 0.5, y: 0.5 } });
    expect(p.outW).toBe(500);
    expect(p.outH).toBe(500);
    expect(p.destW).toBe(500);
    expect(p.destH).toBe(250);
    expect(p.destX).toBe(0);
    expect(p.destY).toBe(125);
    expect(p.srcX).toBe(0);
    expect(p.srcY).toBe(0);
  });

  it('cover crops to fill exactly', () => {
    const p = computeResizePlan({ srcW: 1000, srcH: 500, targetW: 400, targetH: 400, lockAspect: false, cropMode: 'cover', focal: { x: 0.5, y: 0.5 } });
    expect(p.outW).toBe(400);
    expect(p.outH).toBe(400);
    // src aspect wider than target: take full height, crop width to target aspect
    expect(p.srcW).toBe(500);
    expect(p.srcH).toBe(500);
    expect(p.srcX).toBe(250); // centered
    expect(p.srcY).toBe(0);
    expect(p.destW).toBe(400);
    expect(p.destH).toBe(400);
    expect(p.destX).toBe(0);
    expect(p.destY).toBe(0);
  });

  it('cover respects focal point: focal right keeps right edge', () => {
    const p = computeResizePlan({ srcW: 1000, srcH: 500, targetW: 400, targetH: 400, lockAspect: false, cropMode: 'cover', focal: { x: 1, y: 0.5 } });
    expect(p.srcX).toBe(500); // 1000 - 500
  });

  it('cover focal clamps to bounds', () => {
    const p = computeResizePlan({ srcW: 1000, srcH: 500, targetW: 400, targetH: 400, lockAspect: false, cropMode: 'cover', focal: { x: 0, y: 0.5 } });
    expect(p.srcX).toBe(0);
  });

  it('custom crop uses provided rect and clamps', () => {
    const p = computeResizePlan({ srcW: 1000, srcH: 500, targetW: 400, targetH: 400, lockAspect: false, cropMode: 'custom', focal: { x: 0.5, y: 0.5 }, customCrop: { x: 100, y: 50, w: 300, h: 200 } });
    expect(p.srcX).toBe(100);
    expect(p.srcY).toBe(50);
    expect(p.srcW).toBe(300);
    expect(p.srcH).toBe(200);
    expect(p.destX).toBe(0);
    expect(p.destY).toBe(0);
  });

  it('custom crop clamps oversized rect to source', () => {
    const p = computeResizePlan({ srcW: 1000, srcH: 500, targetW: 400, targetH: 400, lockAspect: false, cropMode: 'custom', focal: { x: 0.5, y: 0.5 }, customCrop: { x: 950, y: 450, w: 500, h: 500 } });
    expect(p.srcX).toBe(950);
    expect(p.srcY).toBe(450);
    expect(p.srcW).toBe(50);
    expect(p.srcH).toBe(50);
  });

  it('suggestFocalPoint returns in-range center-bias', () => {
    const f = suggestFocalPoint(1000, 500);
    expect(f.x).toBeGreaterThanOrEqual(0);
    expect(f.x).toBeLessThanOrEqual(1);
    expect(f.y).toBeGreaterThanOrEqual(0);
    expect(f.y).toBeLessThanOrEqual(1);
  });
});