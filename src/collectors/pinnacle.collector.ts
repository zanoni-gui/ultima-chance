import axios, { AxiosInstance } from 'axios';
import { BaseCollector } from './base.collector';
import { RawOdd } from '../types';
import { config, SPORT_ID_SOCCER, ODDS_FORMAT } from '../config';
import { normalizeMarket } from '../normalizer/markets';

const PINNACLE_API = 'https://api.pinnacle.com';
const TARGET_MARKET_KEYWORDS = ['throw', 'Throw'];

export class PinnacleCollector extends BaseCollector {
  readonly name = 'pinnacle';
  private client: AxiosInstance;

  constructor() {
    super();
    const auth = Buffer.from(
      `${config.PINNACLE_USERNAME}:${config.PINNACLE_PASSWORD}`
    ).toString('base64');

    this.client = axios.create({
      baseURL: PINNACLE_API,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  async fetchOdds(): Promise<RawOdd[]> {
    try {
      this.log('Fetching live events...');

      const [eventsResp, oddsResp] = await Promise.all([
        this.client.get(`/v1/fixtures`, {
          params: { sportId: SPORT_ID_SOCCER, isLive: 1 },
        }),
        this.client.get(`/v2/odds`, {
          params: { sportId: SPORT_ID_SOCCER, oddsFormat: ODDS_FORMAT, isLive: 1 },
        }),
      ]);

      const leagues: any[] = eventsResp.data?.league ?? [];
      const events: Map<number, any> = new Map();
      for (const league of leagues) {
        for (const event of league.events ?? []) {
          events.set(event.id, { ...event, leagueName: league.name });
        }
      }

      const oddsLeagues: any[] = oddsResp.data?.leagues ?? [];
      const oddsMap: Map<number, any[]> = new Map();
      for (const league of oddsLeagues) {
        for (const event of league.events ?? []) {
          oddsMap.set(event.id, event.periods ?? []);
        }
      }

      const results: RawOdd[] = [];

      for (const [eventId, event] of events) {
        const periods: any[] = oddsMap.get(eventId) ?? [];
        for (const period of periods) {
          if (period.lineType !== 'game') continue;
          for (const total of period.totals ?? []) {
            const marketName: string = total.type ?? '';
            const isTarget = TARGET_MARKET_KEYWORDS.some(kw => marketName.includes(kw));
            if (!isTarget) continue;

            const marketKey = normalizeMarket(marketName);
            if (!marketKey) continue;

            const base = {
              bookmaker: 'pinnacle' as const,
              eventId: String(eventId),
              homeTeam: event.home ?? event.homeTeam ?? '',
              awayTeam: event.away ?? event.awayTeam ?? '',
              league: event.leagueName ?? '',
              startsAt: new Date(event.starts ?? event.startsAt),
              isLive: true,
              market: marketName,
              line: total.points,
              capturedAt: new Date(),
            };

            if (total.over) results.push({ ...base, outcome: 'over', odd: total.over });
            if (total.under) results.push({ ...base, outcome: 'under', odd: total.under });
          }
        }
      }

      this.log(`Fetched ${results.length} odds`);
      return results;
    } catch (err: any) {
      this.logError('Failed to fetch', err?.message);
      return [];
    }
  }
}
