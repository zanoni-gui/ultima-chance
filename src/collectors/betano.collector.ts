import { chromium, Browser, BrowserContext } from 'playwright';
import { BaseCollector } from './base.collector';
import { RawOdd } from '../types';
import { normalizeMarket } from '../normalizer/markets';

const BETANO_LIVE_URL = 'https://br.betano.com/sport/futebol/ao-vivo/';

export class BetanoCollector extends BaseCollector {
  readonly name = 'betano';
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
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'pt-BR',
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
  }

  async fetchOdds(): Promise<RawOdd[]> {
    const context = await this.createContext();
    const page = await context.newPage();
    const results: RawOdd[] = [];

    try {
      this.log('Navigating to live soccer...');
      await page.goto(BETANO_LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);

      // Betano event rows
      const eventRows = await page.$$('[class*="event-row"], [class*="EventRow"], [data-testid*="event"]');
      this.log(`Found ${eventRows.length} event rows`);

      for (const row of eventRows.slice(0, 8)) {
        try {
          const homeTeam = await row
            .$eval('[class*="home"], [class*="Home"]', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
            .catch(() => '');
          const awayTeam = await row
            .$eval('[class*="away"], [class*="Away"]', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
            .catch(() => '');
          if (!homeTeam || !awayTeam) continue;

          // Click to expand markets
          await row.click().catch(() => {});
          await page.waitForTimeout(1500);

          const marketGroups = await page.$$('[class*="market-group"], [class*="MarketGroup"]');
          for (const group of marketGroups) {
            const marketName = await group
              .$eval('[class*="market-name"], [class*="MarketName"], [class*="title"]', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
              .catch(() => '');
            const marketKey = normalizeMarket(marketName);
            if (!marketKey) continue;

            const options = await group.$$('[class*="selection"], [class*="Selection"], [class*="odd"]');
            for (const opt of options) {
              const labelText = await opt
                .$eval('[class*="label"], [class*="Label"], [class*="name"]', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
                .catch(() => '');
              const oddText = await opt
                .$eval('[class*="odd"], [class*="Odd"], [class*="price"]', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
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
                bookmaker: 'betano',
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
