import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ createSession: vi.fn() }));

vi.mock("./stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: mocks.createSession } } }),
}));

import { appRouter } from "./routers";

function buyerContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "buyer-user",
      name: "Frame Buyer",
      email: "buyer@example.test",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: { origin: "https://studio.example.test" }, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("credit checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSession.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
  });

  it("creates a server-priced checkout session bound to the authenticated user", async () => {
    const caller = appRouter.createCaller(buyerContext());
    const result = await caller.billing.checkout({ packId: "studio" });

    expect(result.checkoutUrl).toBe("https://checkout.stripe.test/session");
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      client_reference_id: "7",
      customer_email: "buyer@example.test",
      allow_promotion_codes: true,
      success_url: "https://studio.example.test/profil?checkout=success",
      cancel_url: "https://studio.example.test/profil?checkout=cancelled",
      metadata: expect.objectContaining({ user_id: "7", pack_id: "studio" }),
    }));
  });
});
