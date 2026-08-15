/**
 * Daily quota helpers. The reset boundary is midnight UTC so the server makes
 * one deterministic decision for every client regardless of device locale.
 */
export const DAILY_TRANSFORM_LIMIT = 5;

export function utcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function dailyQuota(used: number, limit = DAILY_TRANSFORM_LIMIT) {
  return {
    dailyLimit: limit,
    used,
    remaining: Math.max(0, limit - used),
    exhausted: used >= limit,
  };
}
