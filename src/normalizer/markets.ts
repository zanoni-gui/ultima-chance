import { MarketKey } from '../types';

type MarketPattern = { pattern: RegExp; key: MarketKey };

const MARKET_PATTERNS: MarketPattern[] = [
  { pattern: /throw.?in/i, key: 'throw_ins_ou' },
  { pattern: /corner/i, key: 'corners_ou' },
  { pattern: /card/i, key: 'cards_ou' },
  { pattern: /shot/i, key: 'shots_ou' },
];

export function normalizeMarket(rawName: string): MarketKey | null {
  for (const { pattern, key } of MARKET_PATTERNS) {
    if (pattern.test(rawName)) return key;
  }
  return null;
}
