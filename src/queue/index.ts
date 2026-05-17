import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';

const connection = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
};

export const oddsQueue = new Queue('odds-processing', { connection });

export interface OddsJobData {
  normalizedEventId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
}

export function createOddsWorker(
  processor: (job: Job<OddsJobData>) => Promise<void>
): Worker<OddsJobData> {
  return new Worker('odds-processing', processor, {
    connection,
    concurrency: 5,
  });
}
