import { describe, expect, it, vi } from "vitest";
import { finalizeManualTransfer } from "./manualTransferFlow";

describe("manual transfer credit flow", () => {
  it("shows a submitted transfer as pending in the local history before the balance query refreshes", async () => {
    const prependOrder = vi.fn();
    const invalidateBalance = vi.fn().mockResolvedValue(undefined);
    const clearSelection = vi.fn();
    const order = { id: 44, packId: "studio", credits: 25, amountIdr: 20_000, status: "pending" as const };
    await finalizeManualTransfer({ order, prependOrder, invalidateBalance, clearSelection });
    expect(prependOrder).toHaveBeenCalledWith(expect.objectContaining({ id: 44, status: "pending", amountIdr: 20_000 }));
    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(invalidateBalance).toHaveBeenCalledTimes(1);
  });
});
