import { describe, expect, it } from "vitest";
import { creditPacks, getCreditPack } from "./creditProducts";

describe("credit products", () => {
  it("exposes fixed server-owned rupiah packs with a positive credit value", () => {
    Object.values(creditPacks).forEach((pack) => {
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.unitAmount).toBeGreaterThan(10_000);
      expect(pack.currency).toBe("idr");
    });
  });

  it("keeps the requested credit-to-rupiah pricing fixed on the server", () => {
    expect(creditPacks.starter).toMatchObject({ credits: 8, unitAmount: 15_000 });
    expect(creditPacks.studio).toMatchObject({ credits: 25, unitAmount: 20_000 });
    expect(creditPacks.archive).toMatchObject({ credits: 60, unitAmount: 25_000 });
  });

  it("rejects an unknown credit pack rather than accepting a client-defined price", () => {
    expect(getCreditPack("studio")).toMatchObject({ id: "studio", credits: 25 });
    expect(getCreditPack("free-unlimited")).toBeNull();
  });
});
