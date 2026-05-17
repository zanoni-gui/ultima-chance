import { describe, it, expect } from 'vitest';
import { removePinnacleVig, calculateEdge, calculateKelly } from '../../src/engine/value';

describe('removePinnacleVig', () => {
  it('removes vig from a balanced market', () => {
    const fair = removePinnacleVig(1.90, 1.90);
    expect(fair.over).toBeCloseTo(2.0, 1);
    expect(fair.under).toBeCloseTo(2.0, 1);
  });
});

describe('calculateEdge', () => {
  it('returns positive edge when soft odd > fair odd', () => {
    const edge = calculateEdge({ softOdd: 2.10, fairOdd: 1.95 });
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeCloseTo(7.69, 1);
  });

  it('returns negative edge when soft odd < fair odd', () => {
    const edge = calculateEdge({ softOdd: 1.80, fairOdd: 1.95 });
    expect(edge).toBeLessThan(0);
  });
});

describe('calculateKelly', () => {
  it('returns reasonable kelly fraction for good value bet', () => {
    const kelly = calculateKelly({ softOdd: 2.1, fairOdd: 1.95, bankroll: 1000 });
    expect(kelly).toBeGreaterThan(0);
    expect(kelly).toBeLessThan(100);
  });
});
