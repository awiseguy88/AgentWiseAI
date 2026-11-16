import { describe, it, expect } from 'vitest';
import { orientationToTransform } from '../src/engine/exif';

describe('EXIF orientation', () => {
  it('M5-A2 orientation 6 maps to 90deg rotation (swap dimensions)', () => {
    const t = orientationToTransform(6);
    expect(t.swap).toBe(true);
    expect(t.rotateDeg).toBe(90);
  });

  it('orientation 1 is identity', () => {
    const t = orientationToTransform(1);
    expect(t.swap).toBe(false);
    expect(t.rotateDeg).toBe(0);
    expect(t.flipX).toBe(false);
    expect(t.flipY).toBe(false);
  });

  it('orientation 3 rotates 180', () => {
    const t = orientationToTransform(3);
    expect(t.rotateDeg).toBe(180);
  });
});
