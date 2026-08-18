import { describe, expect, it } from "vitest";
import { getSecuritySummaryPeriodKey } from "./securitySummarySchedule";

describe("security summary period keys", () => {
  it("creates a stable daily key and a disabled null key", () => {
    const now = new Date("2026-08-18T08:00:00.000Z");
    expect(getSecuritySummaryPeriodKey("daily", now)).toBe("daily-2026-08-18");
    expect(getSecuritySummaryPeriodKey("disabled", now)).toBeNull();
  });

  it("uses an ISO week so a retry in the same week has the same weekly key", () => {
    expect(getSecuritySummaryPeriodKey("weekly", new Date("2026-08-17T08:00:00.000Z"))).toBe("weekly-2026-W34");
    expect(getSecuritySummaryPeriodKey("weekly", new Date("2026-08-18T08:00:00.000Z"))).toBe("weekly-2026-W34");
  });
});
