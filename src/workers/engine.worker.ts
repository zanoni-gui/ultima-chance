import { Job } from 'bullmq';
import { createOddsWorker, OddsJobData } from '../queue';
import { redis, EVENT_ODDS_KEY } from '../db/redis';
import { NormalizedOdd, OddPair, ValueBet, ArbBet } from '../types';
import { removePinnacleVig, calculateEdge, calculateKelly } from '../engine/value';
import { detectArbitrage } from '../engine/arbitrage';
import { passesFilters, meetsMinEdge } from '../engine/filters';
import { sendAlert } from '../alerts/telegram';
import { prisma } from '../db/prisma';
import { config } from '../config';

const filters = {
  minEdgePct: config.MIN_EDGE_PCT,
  minOdd: config.MIN_ODD,
  maxOdd: config.MAX_ODD,
};

async function getOddsForEvent(normalizedEventId: string): Promise<NormalizedOdd[]> {
  const keys = await redis.smembers(EVENT_ODDS_KEY(normalizedEventId));
  const results: NormalizedOdd[] = [];
  for (const key of keys) {
    const val = await redis.get(key);
    if (val) results.push(JSON.parse(val) as NormalizedOdd);
  }
  return results;
}

function buildPinnacleMap(odds: NormalizedOdd[]): Map<string, NormalizedOdd> {
  const map = new Map<string, NormalizedOdd>();
  for (const o of odds.filter(x => x.bookmaker === 'pinnacle')) {
    map.set(`${o.marketKey}:${o.line}:${o.outcome}`, o);
  }
  return map;
}

async function processEvent(job: Job<OddsJobData>): Promise<void> {
  const { normalizedEventId, homeTeam, awayTeam, league } = job.data;
  const odds = await getOddsForEvent(normalizedEventId);
  if (odds.length < 2) return;

  const pinnacleMap = buildPinnacleMap(odds);
  const opportunities: (ValueBet | ArbBet)[] = [];

  // Group by marketKey + line for vig removal
  const marketLines = new Set<string>();
  for (const [key] of pinnacleMap) {
    const parts = key.split(':');
    marketLines.add(`${parts[0]}:${parts[1]}`);
  }

  for (const marketLine of marketLines) {
    const [marketKey, lineStr] = marketLine.split(':');
    const sharpOver = pinnacleMap.get(`${marketKey}:${lineStr}:over`);
    const sharpUnder = pinnacleMap.get(`${marketKey}:${lineStr}:under`);
    if (!sharpOver || !sharpUnder) continue;

    const fair = removePinnacleVig(sharpOver.odd, sharpUnder.odd);
    const line = parseFloat(lineStr);

    for (const outcomeKey of ['over', 'under'] as const) {
      const fairOdd = outcomeKey === 'over' ? fair.over : fair.under;
      const softOdds = odds.filter(
        o =>
          o.bookmaker !== 'pinnacle' &&
          o.marketKey === marketKey &&
          o.line === line &&
          o.outcome === outcomeKey
      );

      for (const soft of softOdds) {
        if (!passesFilters(soft, filters)) continue;
        const edgePct = calculateEdge({ softOdd: soft.odd, fairOdd });
        if (!meetsMinEdge(edgePct, filters)) continue;

        const sharpRef = outcomeKey === 'over' ? sharpOver : sharpUnder;
        const valueBet: ValueBet = {
          type: 'value',
          pair: {
            marketKey: marketKey as any,
            line,
            outcome: outcomeKey,
            homeTeam,
            awayTeam,
            league,
            isLive: sharpOver.isLive,
            sharp: sharpRef,
            soft,
          },
          fairOdd,
          edgePct: parseFloat(edgePct.toFixed(2)),
          kellyStake: calculateKelly({
            softOdd: soft.odd,
            fairOdd,
            bankroll: config.DEFAULT_BANKROLL,
          }),
        };
        opportunities.push(valueBet);
      }
    }

    // Arb between soft books
    const softOver = odds.find(
      o => o.bookmaker !== 'pinnacle' && o.marketKey === marketKey && o.line === line && o.outcome === 'over'
    );
    const softUnder = odds.find(
      o => o.bookmaker !== 'pinnacle' && o.marketKey === marketKey && o.line === line && o.outcome === 'under'
    );

    if (softOver && softUnder) {
      const arb = detectArbitrage({
        overOdd: softOver.odd,
        underOdd: softUnder.odd,
        bankroll: config.DEFAULT_BANKROLL,
      });
      if (arb) {
        const arbBet: ArbBet = {
          type: 'arbitrage',
          homeTeam,
          awayTeam,
          league,
          marketKey: marketKey as any,
          line,
          legOver: softOver,
          legUnder: softUnder,
          ...arb,
        };
        opportunities.push(arbBet);
      }
    }
  }

  for (const opp of opportunities) {
    console.log(`[Engine] ${opp.type.toUpperCase()} found: ${homeTeam} x ${awayTeam}`);
    await sendAlert(opp);

    try {
      const event = await prisma.event.upsert({
        where: { normalizedId: normalizedEventId },
        update: { isLive: true },
        create: {
          normalizedId: normalizedEventId,
          homeTeam,
          awayTeam,
          league,
          startsAt: new Date(),
          isLive: true,
        },
      });

      await prisma.opportunity.create({
        data: {
          eventId: event.id,
          type: opp.type,
          marketKey: opp.type === 'value' ? opp.pair.marketKey : opp.marketKey,
          line: opp.type === 'value' ? opp.pair.line : opp.line,
          outcome: opp.type === 'value' ? opp.pair.outcome : null,
          edgePct: opp.type === 'value' ? opp.edgePct : null,
          arbPct: opp.type === 'arbitrage' ? opp.arbPct : null,
          bookmaker: opp.type === 'value' ? opp.pair.soft.bookmaker : null,
          fairOdd: opp.type === 'value' ? opp.fairOdd : null,
          softOdd: opp.type === 'value' ? opp.pair.soft.odd : null,
          sharpOdd: opp.type === 'value' ? opp.pair.sharp.odd : null,
          alertedAt: new Date(),
        },
      });
    } catch (dbErr) {
      console.error('[Engine] DB write failed (continuing):', dbErr);
    }
  }
}

const worker = createOddsWorker(processEvent);
worker.on('completed', job => console.log(`[Engine] Job ${job.id} done`));
worker.on('failed', (job, err) => console.error(`[Engine] Job ${job?.id} failed:`, err.message));

redis.connect().catch(console.error);
console.log('[EngineWorker] Started, waiting for jobs...');
