import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ createManualCreditOrder: vi.fn() }));
vi.mock("./db", () => ({ createManualCreditOrder: mocks.createManualCreditOrder }));
import { appRouter } from "./routers";

function buyerContext(): TrpcContext {
  return { user: { id: 7, openId: "buyer-user", name: "Frame Buyer", email: "buyer@example.test", loginMethod: "manus", role: "user", unlimitedTransforms: false, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("manual BCA credit order", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a server-priced transfer request bound to the authenticated buyer", async () => {
    mocks.createManualCreditOrder.mockResolvedValue({ id: 31, userId: 7, packId: "studio", credits: 25, amountIdr: 20_000, status: "pending" });
    const result = await appRouter.createCaller(buyerContext()).billing.createManualOrder({ packId: "studio" });
    expect(result).toMatchObject({ packId: "studio", amountIdr: 20_000, status: "pending" });
    expect(mocks.createManualCreditOrder).toHaveBeenCalledWith(7, expect.objectContaining({ id: "studio", credits: 25, unitAmount: 20_000, currency: "idr" }));
  });
});
