import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';
import { Opportunity, ValueBet, ArbBet } from '../types';

let bot: TelegramBot | null = null;

function getBot(): TelegramBot {
  if (!bot) {
    bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: false });
  }
  return bot;
}

function formatValueAlert(opp: ValueBet): string {
  const { pair, fairOdd, edgePct, kellyStake } = opp;
  const emoji = edgePct >= 8 ? '🔥' : edgePct >= 5 ? '✅' : '📊';
  return [
    `${emoji} <b>VALUE BET DETECTADO</b>`,
    ``,
    `⚽ <b>${pair.homeTeam} x ${pair.awayTeam}</b>`,
    `🏆 ${pair.league}`,
    `📺 ${pair.isLive ? 'AO VIVO' : 'Pré-jogo'}`,
    ``,
    `📌 Mercado: <b>${pair.marketKey.replace(/_/g, ' ').toUpperCase()}</b>`,
    `📏 Linha: <b>${pair.line}</b> | Resultado: <b>${pair.outcome.toUpperCase()}</b>`,
    ``,
    `📚 Sharp (Pinnacle): <code>${pair.sharp.odd.toFixed(3)}</code>`,
    `🎯 Soft (${pair.soft.bookmaker}): <code>${pair.soft.odd.toFixed(3)}</code>`,
    `⚖️ Odd justa: <code>${fairOdd.toFixed(3)}</code>`,
    ``,
    `📈 Edge: <b>+${edgePct.toFixed(2)}%</b>`,
    `💰 Stake sugerida: <b>R$ ${kellyStake.toFixed(2)}</b>`,
    ``,
    `⏰ ${new Date().toLocaleString('pt-BR')}`,
  ].join('\n');
}

function formatArbAlert(opp: ArbBet): string {
  return [
    `💎 <b>ARBITRAGEM DETECTADA</b>`,
    ``,
    `⚽ <b>${opp.homeTeam} x ${opp.awayTeam}</b>`,
    `🏆 ${opp.league}`,
    ``,
    `📌 Mercado: <b>${opp.marketKey.replace(/_/g, ' ').toUpperCase()}</b>`,
    `📏 Linha: <b>${opp.line}</b>`,
    ``,
    `🟢 OVER ${opp.legOver.odd.toFixed(3)} @ ${opp.legOver.bookmaker} → R$ ${opp.stakes.over.toFixed(2)}`,
    `🔴 UNDER ${opp.legUnder.odd.toFixed(3)} @ ${opp.legUnder.bookmaker} → R$ ${opp.stakes.under.toFixed(2)}`,
    ``,
    `📊 Lucro garantido: <b>+${opp.arbPct.toFixed(2)}%</b> (R$ ${opp.profit.toFixed(2)})`,
    ``,
    `⏰ ${new Date().toLocaleString('pt-BR')}`,
  ].join('\n');
}

export async function sendAlert(opportunity: Opportunity): Promise<void> {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    console.log('[Telegram] Token or chat ID not configured — skipping alert');
    return;
  }

  const message =
    opportunity.type === 'value'
      ? formatValueAlert(opportunity as ValueBet)
      : formatArbAlert(opportunity as ArbBet);

  try {
    await getBot().sendMessage(config.TELEGRAM_CHAT_ID, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    console.log(`[Telegram] Alert sent: ${opportunity.type}`);
  } catch (err) {
    console.error('[Telegram] Failed to send alert:', err);
  }
}

export async function sendStartupMessage(): Promise<void> {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    console.log('[Telegram] Skipping startup message — not configured');
    return;
  }

  const msg = [
    `🚀 <b>Última Chance iniciado</b>`,
    ``,
    `✅ Monitorando: Laterais (Throw-ins)`,
    `📊 Sharp: Pinnacle | Soft: Bet365`,
    `⏱ Intervalo: ${config.CHECK_INTERVAL_MS / 1000}s`,
    `📈 Edge mínimo: ${config.MIN_EDGE_PCT}%`,
  ].join('\n');

  await getBot().sendMessage(config.TELEGRAM_CHAT_ID, msg, { parse_mode: 'HTML' });
}
