import { redis } from './db/redis';
import { prisma } from './db/prisma';
import { sendStartupMessage } from './alerts/telegram';

async function main(): Promise<void> {
  console.log('🚀 Última Chance starting...');

  await redis.connect();
  await prisma.$connect().catch(err => {
    console.warn('DB not available yet (run docker compose up -d):', err.message);
  });

  await sendStartupMessage();

  console.log('✅ System ready. Start workers separately:');
  console.log('  npm run worker:collector');
  console.log('  npm run worker:engine');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
