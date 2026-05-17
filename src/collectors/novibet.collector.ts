import { chromium, Browser, BrowserContext } from 'playwright';
import { BaseCollector } from './base.collector';
import { RawOdd } from '../types';
import { normalizeMarket } from '../normalizer/markets';
import { injectCookies, cookiesExist } from '../utils/cookies';

const NOVIBET_LIVE_URL = 'https://www.novibet.com.br/apostas-ao-vivo/futebol';

export class NovibetCollector extends BaseCollector {
  readonly name = 'novibet';
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      });
    }
    return this.browser;
  }

  private async createContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    return browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'pt-BR',
      viewport: { width: 1366, height: 768 },
      extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
  }

  async fetchOdds(): Promise<RawOdd[]> {
    const context = await this.createContext();

    if (cookiesExist('novibet')) {
      await injectCookies(context, 'novibet');
    } else {
      this.log('No cookies found — scraping without session (likely blocked)');
    }

    const page = await context.newPage();
    const results: RawOdd[] = [];

    try {
      this.log('Navigating to live soccer...');
      await page.goto(NOVIBET_LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);

      // Novibet event containers
      const eventContainers = await page.$$(
        '[class*="live-event"], [class*="LiveEvent"], [class*="match-container"], [data-id]'
      );
      this.log(`Found ${eventContainers.length} events`);

      for (const container of eventContainers.slice(0, 8)) {
        try {
          const homeTeam = await container
            .$eval('[class*="home-team"], [class*="HomeTeam"], [class*="team1"]', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
            .catch(() => '');
          const awayTeam = await container
            .$eval('[class*="away-team"], [class*="AwayTeam"], [class*="team2"]', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
            .catch(() => '');
          if (!homeTeam || !awayTeam) continue;

          await container.click().catch(() => {});
          await page.waitForTimeout(1500);

          const marketSections = await page.$$(
            '[class*="market-section"], [class*="MarketSection"], [class*="betting-market"]'
          );

          for (const section of marketSections) {
            const marketName = await section
              .$eval('[class*="market-title"], [class*="MarketTitle"], h3, h4', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
              .catch(() => '');
            const marketKey = normalizeMarket(marketName);
            if (!marketKey) continue;

            const bets = await section.$$('[class*="bet-button"], [class*="BetButton"], [class*="outcome"]');
            for (const bet of bets) {
              const labelText = await bet
                .$eval('[class*="bet-label"], [class*="outcome-name"], span:first-child', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
                .catch(() => '');
              const oddText = await bet
                .$eval('[class*="odd-value"], [class*="OddValue"], span:last-child', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
                .catch(() => '');

              const odd = parseFloat(oddText.replace(',', '.'));
              if (!odd || isNaN(odd)) continue;

              const isOver = /over|acima|mais/i.test(labelText);
              const isUnder = /under|abaixo|menos/i.test(labelText);
              if (!isOver && !isUnder) continue;

              const lineMatch = labelText.match(/(\d+\.?\d*)/);
              const line = lineMatch ? parseFloat(lineMatch[1]) : 0;
              if (!line) continue;

              results.push({
                bookmaker: 'novibet',
                eventId: `${homeTeam.toLowerCase().replace(/\s/g, '_')}-${awayTeam.toLowerCase().replace(/\s/g, '_')}`,
                homeTeam,
                awayTeam,
                league: 'Unknown',
                startsAt: new Date(),
                isLive: true,
                market: marketName,
                line,
                outcome: isOver ? 'over' : 'under',
                odd,
                capturedAt: new Date(),
              });
            }
          }
        } catch (err) {
          this.logError('Error parsing event', err);
        }
      }

      this.log(`Fetched ${results.length} odds`);
    } catch (err) {
      this.logError('Failed to fetch page', err);
    } finally {
      await context.close();
    }

    return results;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
