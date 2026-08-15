import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getAdminDashboard: vi.fn() }));
vi.mock("./db", () => ({ getAdminDashboard: mocks.getAdminDashboard }));
import { appRouter } from "./routers";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: 1, openId: "role-test", name: "Role Test", email: "role@test.local", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("admin dashboard", () => {
  it("returns aggregate operations data for an administrator", async () => {
    mocks.getAdminDashboard.mockResolvedValue({ overview: { totalUsers: 2 }, recentTransforms: [], recentPurchases: [], dayStart: new Date() });
    const result = await appRouter.createCaller(context("admin")).admin.dashboard();
    expect(result.overview.totalUsers).toBe(2);
    expect(mocks.getAdminDashboard).toHaveBeenCalledOnce();
  });

  it("rejects a regular user before the dashboard query runs", async () => {
    await expect(appRouter.createCaller(context("user")).admin.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
