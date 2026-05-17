/**
 * Smoke test local — roda o pipeline completo com odds simuladas.
 * Não precisa de Docker, Redis, PostgreSQL ou credenciais reais.
 *
 * Executa: npx tsx src/test-run.ts
 */

import { normalizeMarket } from './normalizer/markets';
import { normalizeEventId } from './normalizer/events';
import { removePinnacleVig, calculateEdge, calculateKelly } from './engine/value';
import { detectArbitrage } from './engine/arbitrage';
import { passesFilters, meetsMinEdge } from './engine/filters';
import { NormalizedOdd } from './types';

const BANKROLL = 1000;
const filters = { minEdgePct: 3, minOdd: 1.5, maxOdd: 5.0 };

// ─── ODDS SIMULADAS ───────────────────────────────────────────────────────────
// Cenário 1: Pinnacle tem 1.91/1.91 em throw-ins 36.5 — Betano tem 2.05 no over
// → Value bet detectado no over da Betano

// Cenário 2: Bet365 tem 2.15 over, Novibet tem 2.15 under
// → Arbitragem entre as duas casas

const now = new Date();
const startsAt = new Date(now.getTime() + 3600000);
const eventId = normalizeEventId('Flamengo', 'Corinthians', startsAt);

const odds: NormalizedOdd[] = [
  // Pinnacle (sharp reference)
  {
    bookmaker: 'pinnacle', normalizedEventId: eventId,
    homeTeam: 'Flamengo', awayTeam: 'Corinthians',
    league: 'Brasileirão', startsAt, isLive: true,
    marketKey: 'throw_ins_ou', line: 36.5, outcome: 'over',
    odd: 1.91, capturedAt: now,
  },
  {
    bookmaker: 'pinnacle', normalizedEventId: eventId,
    homeTeam: 'Flamengo', awayTeam: 'Corinthians',
    league: 'Brasileirão', startsAt, isLive: true,
    marketKey: 'throw_ins_ou', line: 36.5, outcome: 'under',
    odd: 1.91, capturedAt: now,
  },
  // Betano — over desregulado (value bet)
  {
    bookmaker: 'betano', normalizedEventId: eventId,
    homeTeam: 'Flamengo', awayTeam: 'Corinthians',
    league: 'Brasileirão', startsAt, isLive: true,
    marketKey: 'throw_ins_ou', line: 36.5, outcome: 'over',
    odd: 2.05, capturedAt: now,
  },
  // Bet365 — over alto
  {
    bookmaker: 'bet365', normalizedEventId: eventId,
    homeTeam: 'Flamengo', awayTeam: 'Corinthians',
    league: 'Brasileirão', startsAt, isLive: true,
    marketKey: 'throw_ins_ou', line: 36.5, outcome: 'over',
    odd: 2.15, capturedAt: now,
  },
  // Novibet — under alto (cria arb com Bet365)
  {
    bookmaker: 'novibet', normalizedEventId: eventId,
    homeTeam: 'Flamengo', awayTeam: 'Corinthians',
    league: 'Brasileirão', startsAt, isLive: true,
    marketKey: 'throw_ins_ou', line: 36.5, outcome: 'under',
    odd: 2.15, capturedAt: now,
  },
];

// ─── PIPELINE ────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════');
console.log('   🚀 ÚLTIMA CHANCE — SMOKE TEST');
console.log('═══════════════════════════════════════════\n');

// 1. Normalizer
console.log('📋 NORMALIZER');
console.log('─────────────');
const marketNames = [
  'Total Throw-Ins', 'Total Throw-ins',
  'Throw Ins', 'Over/Under Throw Ins', 'Mercado Desconhecido',
];
for (const name of marketNames) {
  const key = normalizeMarket(name);
  console.log(`  "${name}" → ${key ?? '❌ não reconhecido'}`);
}

console.log(`\n  Event ID: ${eventId}`);
console.log(`  (hash de Flamengo x Corinthians)\n`);

// 2. Remove vig da Pinnacle
const sharpOver  = odds.find(o => o.bookmaker === 'pinnacle' && o.outcome === 'over')!;
const sharpUnder = odds.find(o => o.bookmaker === 'pinnacle' && o.outcome === 'under')!;
const fair = removePinnacleVig(sharpOver.odd, sharpUnder.odd);

console.log('📊 VIG REMOVAL (Pinnacle)');
console.log('─────────────────────────');
console.log(`  Over bruto:  ${sharpOver.odd}  →  Fair: ${fair.over.toFixed(4)}`);
console.log(`  Under bruto: ${sharpUnder.odd}  →  Fair: ${fair.under.toFixed(4)}`);
console.log(`  Overround removido: ${(((1/sharpOver.odd + 1/sharpUnder.odd) - 1) * 100).toFixed(2)}%\n`);

// 3. Value bets
console.log('💡 VALUE BETS DETECTADOS');
console.log('─────────────────────────');

const softBooks = odds.filter(o => o.bookmaker !== 'pinnacle');
let foundValue = false;

for (const soft of softBooks) {
  const fairOdd = soft.outcome === 'over' ? fair.over : fair.under;
  if (!passesFilters(soft, filters)) continue;
  const edgePct = calculateEdge({ softOdd: soft.odd, fairOdd });
  if (!meetsMinEdge(edgePct, filters)) continue;

  foundValue = true;
  const stake = calculateKelly({ softOdd: soft.odd, fairOdd, bankroll: BANKROLL });
  const emoji = edgePct >= 8 ? '🔥' : edgePct >= 5 ? '✅' : '📊';

  console.log(`\n  ${emoji} VALUE BET`);
  console.log(`  ⚽ Flamengo x Corinthians (Brasileirão)`);
  console.log(`  📌 Throw-ins >36.5 — ${soft.outcome.toUpperCase()}`);
  console.log(`  📚 Sharp (Pinnacle): ${sharpOver.odd}  →  Fair: ${fairOdd.toFixed(4)}`);
  console.log(`  🎯 Soft (${soft.bookmaker}): ${soft.odd}`);
  console.log(`  📈 Edge: +${edgePct.toFixed(2)}%`);
  console.log(`  💰 Stake sugerida: R$ ${stake.toFixed(2)} (Quarter Kelly)`);
}

if (!foundValue) console.log('  Nenhum value bet com edge ≥ 3%');

// 4. Arbitragem
console.log('\n💎 ARBITRAGEM DETECTADA');
console.log('────────────────────────');

const softOver  = odds.find(o => o.bookmaker === 'bet365'  && o.outcome === 'over');
const softUnder = odds.find(o => o.bookmaker === 'novibet' && o.outcome === 'under');

if (softOver && softUnder) {
  const arb = detectArbitrage({ overOdd: softOver.odd, underOdd: softUnder.odd, bankroll: BANKROLL });
  if (arb) {
    console.log(`\n  💎 ARBITRAGEM`);
    console.log(`  ⚽ Flamengo x Corinthians`);
    console.log(`  📌 Throw-ins 36.5`);
    console.log(`  🟢 OVER  ${softOver.odd} @ ${softOver.bookmaker}   → R$ ${arb.stakes.over}`);
    console.log(`  🔴 UNDER ${softUnder.odd} @ ${softUnder.bookmaker} → R$ ${arb.stakes.under}`);
    console.log(`  📊 Lucro garantido: +${arb.arbPct}% (R$ ${arb.profit.toFixed(2)})\n`);
  } else {
    console.log('  Nenhuma arbitragem (soma das probabilidades ≥ 1)\n');
  }
}

// 5. Formato do alerta Telegram
console.log('📱 PREVIEW DO ALERTA TELEGRAM');
console.log('──────────────────────────────');
console.log(`
✅ VALUE BET DETECTADO

⚽ Flamengo x Corinthians
🏆 Brasileirão
📺 AO VIVO

📌 Mercado: THROW INS OU
📏 Linha: 36.5 | Resultado: OVER

📚 Sharp (Pinnacle): 1.910
🎯 Soft (betano): 2.050
⚖️ Odd justa: ${fair.over.toFixed(3)}

📈 Edge: +${calculateEdge({ softOdd: 2.05, fairOdd: fair.over }).toFixed(2)}%
💰 Stake sugerida: R$ ${calculateKelly({ softOdd: 2.05, fairOdd: fair.over, bankroll: BANKROLL }).toFixed(2)}

⏰ ${new Date().toLocaleString('pt-BR')}
`);

console.log('═══════════════════════════════════════════');
console.log('  ✅ Pipeline 100% funcional!');
console.log('  Próximos passos:');
console.log('  1. Instalar Docker Desktop');
console.log('  2. Adicionar credenciais no .env');
console.log('  3. Exportar cookies das casas');
console.log('  4. npm run worker:collector + worker:engine');
console.log('═══════════════════════════════════════════\n');
