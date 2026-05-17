import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('error', (err) => console.error('[Redis] Error:', err.message));
redis.on('connect', () => console.log('[Redis] Connected'));

export const ODDS_KEY = (bookmaker: string, eventId: string, market: string, outcome: string, line: number) =>
  `odds:${bookmaker}:${eventId}:${market}:${outcome}:${line}`;

export const EVENT_ODDS_KEY = (normalizedEventId: string) =>
  `event:${normalizedEventId}:odds`;

export async function setOdd(key: string, value: string, ttlSeconds = 120) {
  await redis.setex(key, ttlSeconds, value);
}

export async function getOdd(key: string): Promise<string | null> {
  return redis.get(key);
}
