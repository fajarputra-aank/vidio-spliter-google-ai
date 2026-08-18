import { describe, expect, it } from "vitest";
import { buildSecurityHistoryCsv, securityEventLabel } from "./securityHistoryExport";

describe("security history export", () => {
  it("uses Indonesian labels and escapes CSV fields", () => {
    expect(securityEventLabel("new_device_login")).toBe("Login perangkat atau lokasi baru");
    const csv = buildSecurityHistoryCsv([{ kind: "new_device_login", createdAt: new Date("2026-08-18T00:00:00.000Z") }]);
    expect(csv).toContain("Jenis aktivitas");
    expect(csv).toContain("Login perangkat atau lokasi baru");
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});
