import crypto from 'crypto';

function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function normalizeEventId(
  homeTeam: string,
  awayTeam: string,
  startsAt: Date,
): string {
  const dateStr = new Date(startsAt).toISOString().slice(0, 13);
  const raw = `${normalize(homeTeam)}|${normalize(awayTeam)}|${dateStr}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}
