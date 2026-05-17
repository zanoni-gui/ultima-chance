import { describe, it, expect } from 'vitest';
import { detectArbitrage } from '../../src/engine/arbitrage';

describe('detectArbitrage', () => {
  it('detects arbitrage when sum of implied probs < 1', () => {
    const result = detectArbitrage({ overOdd: 2.10, underOdd: 2.10, bankroll: 1000 });
    expect(result).not.toBeNull();
    expect(result!.arbPct).toBeGreaterThan(0);
  });

  it('returns null when no arbitrage exists', () => {
    const result = detectArbitrage({ overOdd: 1.85, underOdd: 1.85, bankroll: 1000 });
    expect(result).toBeNull();
  });

  it('calculates correct stakes for arb', () => {
    const result = detectArbitrage({ overOdd: 2.10, underOdd: 2.10, bankroll: 1000 });
    expect(result).not.toBeNull();
    expect(result!.stakes.over + result!.stakes.under).toBeCloseTo(1000, 0);
  });
});
