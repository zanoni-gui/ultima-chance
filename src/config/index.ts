import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  DATABASE_URL: z.string().default('postgresql://ultima:senha@localhost:5432/ultima_chance'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  PINNACLE_USERNAME: z.string().default(''),
  PINNACLE_PASSWORD: z.string().default(''),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_CHAT_ID: z.string().default(''),
  MIN_EDGE_PCT: z.coerce.number().default(3),
  MIN_ODD: z.coerce.number().default(1.5),
  MAX_ODD: z.coerce.number().default(5.0),
  DEFAULT_BANKROLL: z.coerce.number().default(1000),
  CHECK_INTERVAL_MS: z.coerce.number().default(30000),
});

export const config = schema.parse(process.env);

export const SPORT_ID_SOCCER = 29;
export const ODDS_FORMAT = 'Decimal';
