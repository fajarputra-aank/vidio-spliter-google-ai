import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ listUnlimitedTransformUsers: vi.fn(), setUnlimitedTransformsByAdmin: vi.fn(), setUserRoleByEmail: vi.fn(), listAdminAccessAudits: vi.fn() }));
vi.mock("./db", () => ({ listUnlimitedTransformUsers: mocks.listUnlimitedTransformUsers, setUnlimitedTransformsByAdmin: mocks.setUnlimitedTransformsByAdmin, setUserRoleByEmail: mocks.setUserRoleByEmail, listAdminAccessAudits: mocks.listAdminAccessAudits }));
import { appRouter } from "./routers";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: 52, openId: "access-manager", name: "Access Manager", email: "admin@example.test", loginMethod: "manus", role, unlimitedTransforms: false, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("admin unlimited transform access", () => {
  it("lets an administrator list and update special access by normalized email", async () => {
    mocks.listUnlimitedTransformUsers.mockResolvedValue([{ id: 9, email: "creator@example.test", name: "Creator", unlimitedTransforms: true }]);
    mocks.setUnlimitedTransformsByAdmin.mockResolvedValue({ id: 9, email: "creator@example.test", unlimitedTransforms: true, changed: true, isAdmin: false });
    mocks.listAdminAccessAudits.mockResolvedValue([]);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.admin.unlimitedAccessList({ search: "creator", access: "unlimited" })).resolves.toHaveLength(1);
    await caller.admin.setUnlimitedAccess({ email: " Creator@Example.Test ", enabled: true });
    expect(mocks.setUnlimitedTransformsByAdmin).toHaveBeenCalledWith(52, "Creator@Example.Test", true);
    expect(mocks.listUnlimitedTransformUsers).toHaveBeenCalledWith({ search: "creator", access: "unlimited" });
  });

  it("rejects regular users before any special-access data is exposed or changed", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.admin.unlimitedAccessList()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.setUnlimitedAccess({ email: "creator@example.test", enabled: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.accessAudits()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.setUserRole({ email: "creator@example.test", role: "admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("records role-management calls with the acting administrator identity", async () => {
    mocks.setUserRoleByEmail.mockResolvedValue({ id: 9, email: "creator@example.test", role: "admin", unlimitedTransforms: true, changed: true });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.admin.setUserRole({ email: " Creator@Example.Test ", role: "admin" })).resolves.toMatchObject({ changed: true });
    expect(mocks.setUserRoleByEmail).toHaveBeenCalledWith(52, "Creator@Example.Test", "admin");
  });
});
