import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getCollaborationShareRoleLimits: vi.fn(),
  updateCollaborationShareRoleLimit: vi.fn(),
  listAdminActivePhotoCollaborationShareLinks: vi.fn(),
  revokeAllActivePhotoCollaborationShareLinks: vi.fn(),
}));

vi.mock("./db", () => ({
  getCollaborationShareRoleLimits: mocks.getCollaborationShareRoleLimits,
  updateCollaborationShareRoleLimit: mocks.updateCollaborationShareRoleLimit,
  listAdminActivePhotoCollaborationShareLinks: mocks.listAdminActivePhotoCollaborationShareLinks,
  revokeAllActivePhotoCollaborationShareLinks: mocks.revokeAllActivePhotoCollaborationShareLinks,
}));

import { appRouter } from "./routers";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: 52, openId: "collaboration-manager", name: "Admin", email: "admin@example.test", loginMethod: "local", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("admin collaboration share management", () => {
  it("lets an administrator inspect active links, update role limits, and revoke a result's active links", async () => {
    mocks.getCollaborationShareRoleLimits.mockResolvedValue({ user: 3, admin: null });
    mocks.listAdminActivePhotoCollaborationShareLinks.mockResolvedValue([{ id: 4, transformId: 91 }]);
    mocks.updateCollaborationShareRoleLimit.mockResolvedValue({ role: "user", maxActiveLinks: 5 });
    mocks.revokeAllActivePhotoCollaborationShareLinks.mockResolvedValue({ revokedCount: 3 });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.admin.collaborationShareRoleLimits()).resolves.toMatchObject({ user: 3, admin: null });
    await expect(caller.admin.activeCollaborationShareLinks()).resolves.toHaveLength(1);
    await caller.admin.updateCollaborationShareRoleLimit({ role: "user", maxActiveLinks: 5 });
    await caller.admin.revokeAllActiveCollaborationShareLinks({ transformId: 91 });
    expect(mocks.updateCollaborationShareRoleLimit).toHaveBeenCalledWith("user", 5);
    expect(mocks.revokeAllActivePhotoCollaborationShareLinks).toHaveBeenCalledWith(91);
  });

  it("rejects regular users before active-link data or role-limit controls are exposed", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.admin.collaborationShareRoleLimits()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.activeCollaborationShareLinks()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.updateCollaborationShareRoleLimit({ role: "admin", maxActiveLinks: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.revokeAllActiveCollaborationShareLinks({ transformId: 91 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
