import { describe, expect, it } from "vitest";
import { creditPacks, getCreditPack } from "./creditProducts";

describe("credit products", () => {
  it("exposes fixed server-owned packs with a positive credit value and checkout price", () => {
    Object.values(creditPacks).forEach((pack) => {
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.unitAmount).toBeGreaterThan(49);
      expect(pack.currency).toBe("usd");
    });
  });

  it("rejects an unknown credit pack rather than accepting a client-defined price", () => {
    expect(getCreditPack("studio")).toMatchObject({ id: "studio", credits: 25 });
    expect(getCreditPack("free-unlimited")).toBeNull();
  });
});
