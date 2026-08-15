import { describe, expect, it } from "vitest";
import { dailyQuota, utcDayBounds } from "./photoQuota";

describe("daily photo quota", () => {
  it("limits a user to five transform attempts per UTC day", () => {
    expect(dailyQuota(0)).toMatchObject({ dailyLimit: 5, remaining: 5, exhausted: false });
    expect(dailyQuota(4)).toMatchObject({ remaining: 1, exhausted: false });
    expect(dailyQuota(5)).toMatchObject({ remaining: 0, exhausted: true });
    expect(dailyQuota(9)).toMatchObject({ remaining: 0, exhausted: true });
  });

  it("returns a deterministic UTC day boundary", () => {
    const { start, end } = utcDayBounds(new Date("2026-08-15T23:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-08-15T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-16T00:00:00.000Z");
  });
});
