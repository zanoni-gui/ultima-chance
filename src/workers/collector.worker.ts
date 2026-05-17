import { PinnacleCollector } from '../collectors/pinnacle.collector';
import { Bet365Collector } from '../collectors/bet365.collector';
import { BetanoCollector } from '../collectors/betano.collector';
import { NovibetCollector } from '../collectors/novibet.collector';
import { normalizeMarket } from '../normalizer/markets';
import { normalizeEventId } from '../normalizer/events';
import { setOdd, ODDS_KEY, EVENT_ODDS_KEY, redis } from '../db/redis';
import { oddsQueue } from '../queue';
import { NormalizedOdd, RawOdd } from '../types';
import { config } from '../config';

const pinnacle = new PinnacleCollector();
const bet365   = new Bet365Collector();
const betano   = new BetanoCollector();
const novibet  = new NovibetCollector();

async function processRawOdd(raw: RawOdd): Promise<NormalizedOdd | null> {
  const marketKey = normalizeMarket(raw.market);
  if (!marketKey) return null;

  const normalizedEventId = normalizeEventId(raw.homeTeam, raw.awayTeam, raw.startsAt);

  const normalized: NormalizedOdd = {
    bookmaker: raw.bookmaker,
    normalizedEventId,
    homeTeam: raw.homeTeam,
    awayTeam: raw.awayTeam,
    league: raw.league,
    startsAt: raw.startsAt,
    isLive: raw.isLive,
    marketKey,
    line: raw.line,
    outcome: raw.outcome,
    odd: raw.odd,
    capturedAt: raw.capturedAt,
  };

  const key = ODDS_KEY(raw.bookmaker, normalizedEventId, marketKey, raw.outcome, raw.line);
  await setOdd(key, JSON.stringify(normalized), 120);
  await redis.sadd(EVENT_ODDS_KEY(normalizedEventId), key);
  await redis.expire(EVENT_ODDS_KEY(normalizedEventId), 120);

  return normalized;
}

async function runCollection(): Promise<void> {
  console.log('[CollectorWorker] Starting collection cycle...');
  const eventsSeen = new Set<string>();

  const [pinnacleResult, bet365Result, betanoResult, novibetResult] = await Promise.allSettled([
    pinnacle.fetchOdds(),
    bet365.fetchOdds(),
    betano.fetchOdds(),
    novibet.fetchOdds(),
  ]);

  const allRaw: RawOdd[] = [
    ...(pinnacleResult.status === 'fulfilled' ? pinnacleResult.value : []),
    ...(bet365Result.status  === 'fulfilled' ? bet365Result.value  : []),
    ...(betanoResult.status  === 'fulfilled' ? betanoResult.value  : []),
    ...(novibetResult.status === 'fulfilled' ? novibetResult.value : []),
  ];

  for (const raw of allRaw) {
    const norm = await processRawOdd(raw);
    if (!norm) continue;

    if (!eventsSeen.has(norm.normalizedEventId)) {
      eventsSeen.add(norm.normalizedEventId);
      await oddsQueue.add(
        'process-event',
        {
          normalizedEventId: norm.normalizedEventId,
          homeTeam: norm.homeTeam,
          awayTeam: norm.awayTeam,
          league: norm.league,
        },
        { removeOnComplete: 10, removeOnFail: 5 }
      );
    }
  }

  console.log(`[CollectorWorker] Processed ${allRaw.length} odds, queued ${eventsSeen.size} events`);
}

async function start(): Promise<void> {
  console.log('[CollectorWorker] Started');
  await redis.connect();
  await runCollection();
  setInterval(runCollection, config.CHECK_INTERVAL_MS);
}

start().catch(console.error);
