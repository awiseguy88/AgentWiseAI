import { describe, it, expect } from 'vitest';
import { FIXTURES } from './fixtures';

describe('synthetic fixtures', () => {
  it('M6 defines required programmatic fixtures with correct dimensions', () => {
    const byName = Object.fromEntries(FIXTURES.map(f => [f.name, f]));
    expect(byName['test-gradient.png']).toMatchObject({ width: 1200, height: 800, format: 'png' });
    expect(byName['test-pattern.png']).toMatchObject({ width: 1000, height: 1000, format: 'png' });
    expect(byName['test-noise.png']).toMatchObject({ width: 800, height: 600, format: 'png' });
    expect(byName['test-portrait.jpg']).toMatchObject({ width: 800, height: 1200, format: 'jpg' });
    expect(byName['test-landscape.webp']).toMatchObject({ width: 1200, height: 800, format: 'webp' });
  });

  it('fixture generators are callable functions', () => {
    for (const f of FIXTURES) {
      expect(typeof f.generate).toBe('function');
    }
  });
});
