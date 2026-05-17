import fs from 'fs';
import path from 'path';
import { BrowserContext } from 'playwright';

// Formato exportado pelo EditThisCookie / Cookie-Editor
interface ExportedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  expirationDate?: number; // EditThisCookie usa este campo
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  session?: boolean;
}

const COOKIES_DIR = path.join(process.cwd(), 'cookies');

export function loadCookies(bookmaker: string): ExportedCookie[] | null {
  const filePath = path.join(COOKIES_DIR, `${bookmaker}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const cookies = JSON.parse(raw) as ExportedCookie[];
    console.log(`[Cookies] Loaded ${cookies.length} cookies for ${bookmaker}`);
    return cookies;
  } catch (err) {
    console.error(`[Cookies] Failed to parse ${bookmaker}.json:`, err);
    return null;
  }
}

export async function injectCookies(
  context: BrowserContext,
  bookmaker: string,
): Promise<boolean> {
  const exported = loadCookies(bookmaker);
  if (!exported || exported.length === 0) return false;

  // Mapeia para o formato do Playwright
  const playwrightCookies = exported
    .filter(c => c.name && c.value && c.domain)
    .map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
      path: c.path || '/',
      expires: c.expires ?? c.expirationDate ?? -1,
      httpOnly: c.httpOnly ?? false,
      secure: c.secure ?? false,
      sameSite: mapSameSite(c.sameSite),
    }));

  try {
    await context.addCookies(playwrightCookies);
    console.log(`[Cookies] Injected ${playwrightCookies.length} cookies for ${bookmaker}`);
    return true;
  } catch (err) {
    console.error(`[Cookies] Failed to inject cookies for ${bookmaker}:`, err);
    return false;
  }
}

function mapSameSite(value?: string): 'Strict' | 'Lax' | 'None' | undefined {
  if (!value) return 'Lax';
  const lower = value.toLowerCase();
  if (lower === 'strict') return 'Strict';
  if (lower === 'none') return 'None';
  return 'Lax';
}

export function cookiesExist(bookmaker: string): boolean {
  return fs.existsSync(path.join(COOKIES_DIR, `${bookmaker}.json`));
}
