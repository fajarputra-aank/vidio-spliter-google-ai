import { describe, expect, it } from "vitest";
import { formatProcessDuration } from "./processDuration";

describe("formatProcessDuration", () => {
  it("formats actual completed durations and leaves active work explicit", () => {
    expect(formatProcessDuration("2026-08-19T00:00:00.000Z", "2026-08-19T00:00:43.000Z")).toBe("43 dtk");
    expect(formatProcessDuration("2026-08-19T00:00:00.000Z", "2026-08-19T00:02:08.000Z")).toBe("2 mnt 8 dtk");
    expect(formatProcessDuration("2026-08-19T00:00:00.000Z", null)).toBe("Masih berlangsung");
  });
});
