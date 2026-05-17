export type Bookmaker = 'pinnacle' | 'bet365';

export type MarketKey =
  | 'throw_ins_ou'
  | 'corners_ou'
  | 'cards_ou'
  | 'shots_ou';

export type Outcome = 'over' | 'under' | 'home' | 'away' | 'draw';

export interface RawOdd {
  bookmaker: Bookmaker;
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  startsAt: Date;
  isLive: boolean;
  market: string;
  line: number;
  outcome: Outcome;
  odd: number;
  capturedAt: Date;
}

export interface NormalizedOdd {
  bookmaker: Bookmaker;
  normalizedEventId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  startsAt: Date;
  isLive: boolean;
  marketKey: MarketKey;
  line: number;
  outcome: Outcome;
  odd: number;
  capturedAt: Date;
}

export interface OddPair {
  marketKey: MarketKey;
  line: number;
  outcome: Outcome;
  homeTeam: string;
  awayTeam: string;
  league: string;
  isLive: boolean;
  sharp: NormalizedOdd;
  soft: NormalizedOdd;
}

export interface ValueBet {
  type: 'value';
  pair: OddPair;
  fairOdd: number;
  edgePct: number;
  kellyStake: number;
}

export interface ArbBet {
  type: 'arbitrage';
  homeTeam: string;
  awayTeam: string;
  league: string;
  marketKey: MarketKey;
  line: number;
  legOver: NormalizedOdd;
  legUnder: NormalizedOdd;
  arbPct: number;
  stakes: { over: number; under: number };
  profit: number;
}

export type Opportunity = ValueBet | ArbBet;

export interface EngineFilters {
  minEdgePct: number;
  minOdd: number;
  maxOdd: number;
}
