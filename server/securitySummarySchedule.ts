import type { SecuritySummaryFrequency } from "./db";

function utcDateKey(now: Date) {
  return now.toISOString().slice(0, 10);
}

function isoWeekKey(now: Date) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function getSecuritySummaryPeriodKey(frequency: SecuritySummaryFrequency, now = new Date()) {
  if (frequency === "daily") return `daily-${utcDateKey(now)}`;
  if (frequency === "weekly") return `weekly-${isoWeekKey(now)}`;
  return null;
}
