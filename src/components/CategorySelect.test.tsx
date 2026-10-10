import { describe, expect, it } from 'vitest';
import { computePlacement } from './CategorySelect';

describe('CategorySelect placement', () => {
  it('opens below a field near the top of the screen', () => {
    const placement = computePlacement({ top: 100, bottom: 140, left: 16, width: 300 }, 800);
    expect(placement.up).toBe(false);
    expect(placement.top).toBe(148);
    expect(placement.maxHeight).toBe(400);
  });

  it('opens upwards from a field at the bottom of the screen, within the space above', () => {
    const placement = computePlacement({ top: 600, bottom: 640, left: 16, width: 300 }, 700);
    expect(placement.up).toBe(true);
    expect(placement.bottom).toBe(108);
    expect(placement.maxHeight).toBe(400);
    const tight = computePlacement({ top: 300, bottom: 340, left: 16, width: 300 }, 420);
    expect(tight.up).toBe(true);
    expect(tight.maxHeight).toBe(284);
  });
});
