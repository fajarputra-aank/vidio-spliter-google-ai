import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ listUnlimitedTransformUsers: vi.fn(), setUnlimitedTransformsByEmail: vi.fn() }));
vi.mock("./db", () => ({ listUnlimitedTransformUsers: mocks.listUnlimitedTransformUsers, setUnlimitedTransformsByEmail: mocks.setUnlimitedTransformsByEmail }));
import { appRouter } from "./routers";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: 52, openId: "access-manager", name: "Access Manager", email: "admin@example.test", loginMethod: "manus", role, unlimitedTransforms: false, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("admin unlimited transform access", () => {
  it("lets an administrator list and update special access by normalized email", async () => {
    mocks.listUnlimitedTransformUsers.mockResolvedValue([{ id: 9, email: "creator@example.test", name: "Creator" }]);
    mocks.setUnlimitedTransformsByEmail.mockResolvedValue({ id: 9, email: "creator@example.test", unlimitedTransforms: true, changed: true, isAdmin: false });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.admin.unlimitedAccessList()).resolves.toHaveLength(1);
    await caller.admin.setUnlimitedAccess({ email: " Creator@Example.Test ", enabled: true });
    expect(mocks.setUnlimitedTransformsByEmail).toHaveBeenCalledWith("Creator@Example.Test", true);
  });

  it("rejects regular users before any special-access data is exposed or changed", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.admin.unlimitedAccessList()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.setUnlimitedAccess({ email: "creator@example.test", enabled: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
