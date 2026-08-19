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

  it("mempertahankan ID transformasi pada ekspor gabungan beberapa riwayat privat", () => {
    const csv = formatShareHistoryCsv([{ id: 4, transformId: 2, platform: "instagram", caption: "Frame dua", watermarkText: null, outcome: "shared", createdAt: "2026-08-19T00:00:00.000Z" }, { id: 5, transformId: 8, platform: "whatsapp", caption: "Frame delapan", watermarkText: null, outcome: "copied", createdAt: "2026-08-19T01:00:00.000Z" }]);
    expect(csv).toContain('"2"');
    expect(csv).toContain('"8"');
  });
});
