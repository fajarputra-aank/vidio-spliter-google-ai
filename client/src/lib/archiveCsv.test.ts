import { describe, expect, it } from "vitest";
import { createArchiveCsv } from "./archiveCsv";

describe("createArchiveCsv", () => {
  it("exports only archive metadata with correctly escaped CSV fields", () => {
    const csv = createArchiveCsv([{ title: 'Potret "Pagi"', recipe: "portrait", style: "editorial", aspectRatio: "1:1", createdAt: "2026-08-15T08:00:00.000Z", isHidden: false }]);
    expect(csv).toContain('"Potret ""Pagi"""');
    expect(csv).toContain('"2026-08-15T08:00:00.000Z"');
    expect(csv.split("\n")).toHaveLength(2);
  });
});
