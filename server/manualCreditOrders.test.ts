import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ listAdminManualCreditOrders: vi.fn(), reviewManualCreditOrder: vi.fn() }));
vi.mock("./db", () => ({ listAdminManualCreditOrders: mocks.listAdminManualCreditOrders, reviewManualCreditOrder: mocks.reviewManualCreditOrder }));
import { appRouter } from "./routers";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: 18, openId: "transfer-reviewer", name: "Transfer Reviewer", email: "reviewer@example.test", loginMethod: "manus", role, unlimitedTransforms: role === "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("manual BCA credit review", () => {
  it("allows only administrators to review a pending transfer and bind the reviewer", async () => {
    mocks.listAdminManualCreditOrders.mockResolvedValue([{ id: 3, status: "pending" }]);
    mocks.reviewManualCreditOrder.mockResolvedValue({ id: 3, status: "approved", changed: true });
    const admin = appRouter.createCaller(context("admin"));
    await expect(admin.admin.manualCreditOrders()).resolves.toHaveLength(1);
    await expect(admin.admin.reviewManualCreditOrder({ orderId: 3, action: "approve" })).resolves.toMatchObject({ status: "approved" });
    expect(mocks.reviewManualCreditOrder).toHaveBeenCalledWith(3, 18, "approve");
    const user = appRouter.createCaller(context("user"));
    await expect(user.admin.reviewManualCreditOrder({ orderId: 3, action: "approve" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
