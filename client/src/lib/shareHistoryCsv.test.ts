import { describe, expect, it } from "vitest";
import { formatShareHistoryCsv } from "./shareHistoryCsv";

describe("formatShareHistoryCsv", () => {
  it("mengekspor metadata berbagi dengan penggandaan tanda kutip", () => {
    const csv = formatShareHistoryCsv([{ id: 1, transformId: 2, platform: "instagram", caption: 'Promo "baru"', watermarkText: "@toko", outcome: "shared", createdAt: "2026-08-19T00:00:00.000Z" }]);
    expect(csv).toContain('"Promo ""baru"""');
    expect(csv).not.toContain("resultUrl");
  });
});
