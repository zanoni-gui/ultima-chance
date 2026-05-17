import { describe, it, expect } from 'vitest';
import { normalizeMarket } from '../../src/normalizer/markets';

describe('normalizeMarket', () => {
  it('normalizes Pinnacle throw-ins market name', () => {
    expect(normalizeMarket('Total Throw-Ins')).toBe('throw_ins_ou');
  });

  it('normalizes Bet365 throw-ins market name', () => {
    expect(normalizeMarket('Total Throw-ins')).toBe('throw_ins_ou');
  });

  it('normalizes alternate throw-ins spellings', () => {
    expect(normalizeMarket('Throw Ins')).toBe('throw_ins_ou');
    expect(normalizeMarket('Over/Under Throw Ins')).toBe('throw_ins_ou');
  });

  it('returns null for unknown market', () => {
    expect(normalizeMarket('Unknown Market XYZ')).toBeNull();
  });
});
