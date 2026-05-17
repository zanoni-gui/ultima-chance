import { chromium, Browser, BrowserContext } from 'playwright';
import { BaseCollector } from './base.collector';
import { RawOdd } from '../types';
import { normalizeMarket } from '../normalizer/markets';
import { injectCookies, cookiesExist } from '../utils/cookies';

const BET365_LIVE_URL = 'https://www.bet365.com/#/IP/EV';

export class Bet365Collector extends BaseCollector {
  readonly name = 'bet365';
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
      extraHTTPHeaders: {
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });
  }

  async fetchOdds(): Promise<RawOdd[]> {
    const context = await this.createContext();

    if (cookiesExist('bet365')) {
      await injectCookies(context, 'bet365');
    } else {
      this.log('No cookies found — scraping without session (likely blocked)');
    }

    const page = await context.newPage();
    const results: RawOdd[] = [];

    try {
      this.log('Navigating to live betting...');
      await page.goto(BET365_LIVE_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForTimeout(4000);

      // Try to find live soccer events
      const matchSelectors = [
        '.sl-CouponParticipantWithBookCloses',
        '.sl-MarketCouponFixtureClosedHeader',
        '[class*="LiveMatchHeader"]',
        '[class*="Participant"]',
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let matches: any[] = [];
      for (const selector of matchSelectors) {
        matches = await page.$$(selector);
        if (matches.length > 0) {
          this.log(`Found ${matches.length} matches with selector: ${selector}`);
          break;
        }
      }

      if (matches.length === 0) {
        this.log('No live matches found — Bet365 may require login or geo-restriction applies');
        return [];
      }

      for (const match of matches.slice(0, 5)) {
        try {
          await match.click().catch(() => {});
          await page.waitForTimeout(2000);

          const homeTeam = await page
            .$eval('[class*="TeamHome"], [class*="Home_"]', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
            .catch(() => '');
          const awayTeam = await page
            .$eval('[class*="TeamAway"], [class*="Away_"]', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
            .catch(() => '');

          if (!homeTeam || !awayTeam) continue;

          const marketGroups = await page.$$('[class*="MarketGroup"], .gl-MarketGroup');
          for (const group of marketGroups) {
            const marketName = await group
              .$eval('[class*="Label"], .gl-MarketGroup_Label', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
              .catch(() => '');

            const marketKey = normalizeMarket(marketName);
            if (!marketKey) continue;

            const buttons = await group.$$('[class*="Participant"], .gl-Participant_General');
            for (const btn of buttons) {
              const labelText = await btn
                .$eval('[class*="Name"], .gl-Participant_Name', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
                .catch(() => '');
              const oddText = await btn
                .$eval('[class*="Odds"], .gl-Participant_Odds', (el: unknown) => (el as { textContent?: string | null }).textContent?.trim() ?? '')
                .catch(() => '');

              const odd = parseFloat(oddText);
              if (!odd || isNaN(odd)) continue;

              const isOver = /over|mais/i.test(labelText);
              const isUnder = /under|menos/i.test(labelText);
              if (!isOver && !isUnder) continue;

              const lineMatch = labelText.match(/(\d+\.?\d*)/);
              const line = lineMatch ? parseFloat(lineMatch[1]) : 0;
              if (!line) continue;

              results.push({
                bookmaker: 'bet365',
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
          this.logError('Error parsing match', err);
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
