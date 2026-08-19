import { describe, expect, it } from "vitest";
import { buildTransformActivityCsv } from "./transformActivityCsv";

describe("ekspor aktivitas transformasi CSV", () => {
  it("mengekspor metadata aktivitas dengan BOM dan tanpa URL atau kunci penyimpanan", () => {
    const csv = buildTransformActivityCsv({
      id: 42,
      title: "Produk \"Pagi\"",
      recipe: "product",
      style: "editorial",
      aspectRatio: "1:1",
      status: "completed",
      createdAt: new Date("2026-08-19T01:00:00.000Z"),
      completedAt: new Date("2026-08-19T01:00:45.000Z"),
      queuePosition: 3,
      providerAttemptCount: 2,
      autoRetryAt: new Date("2026-08-19T01:00:20.000Z"),
      retryOfTransformId: null,
      retryInstruction: null,
    });

    expect(csv.startsWith("\uFEFF\"Aktivitas\",\"Waktu\",\"Detail metadata\"\r\n")).toBe(true);
    expect(csv).toContain('Produk ""Pagi"" · resep product');
    expect(csv).toContain("Percobaan ulang otomatis");
    expect(csv).toContain("Selesai setelah 2 percobaan layanan.");
    expect(csv).not.toMatch(/https?:\/\/|sourceKey|resultUrl|manus-storage/i);
  });
});
