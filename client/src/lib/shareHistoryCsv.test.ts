import { describe, expect, it } from "vitest";
import { formatShareHistoryCsv } from "./shareHistoryCsv";

describe("formatShareHistoryCsv", () => {
  it("mengekspor metadata berbagi dengan penggandaan tanda kutip", () => {
    const csv = formatShareHistoryCsv([{ id: 1, transformId: 2, platform: "instagram", caption: 'Promo "baru"', watermarkText: "@toko", outcome: "shared", createdAt: "2026-08-19T00:00:00.000Z" }]);
    expect(csv).toContain('"Promo ""baru"""');
    expect(csv).not.toContain("resultUrl");
  });

  it("mengekspor hanya baris yang diberikan dari hasil filter aktif", () => {
    const csv = formatShareHistoryCsv([{ id: 4, transformId: 2, platform: "instagram", caption: "Promo yang dicari", watermarkText: null, outcome: "shared", createdAt: "2026-08-19T00:00:00.000Z" }]);
    expect(csv).toContain("Promo yang dicari");
    expect(csv).not.toContain("Caption milik hasil lain");
  });
});
