import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { hashPassword } from "./localAuth";

const mocks = vi.hoisted(() => ({
  updateLocalPassword: vi.fn(),
  recordUserSecurityEvent: vi.fn(),
  listUserSecurityEvents: vi.fn(),
  sendPasswordChangedEmail: vi.fn(),
}));

vi.mock("./db", () => ({
  updateLocalPassword: mocks.updateLocalPassword,
  recordUserSecurityEvent: mocks.recordUserSecurityEvent,
  listUserSecurityEvents: mocks.listUserSecurityEvents,
}));

vi.mock("./accountEmails", () => ({
  issueAccountEmail: vi.fn(),
  sendPasswordChangedEmail: mocks.sendPasswordChangedEmail,
}));

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

async function createContext(): Promise<{ ctx: TrpcContext; user: AuthenticatedUser }> {
  const user: AuthenticatedUser = {
    id: 88,
    openId: "security-user",
    name: "Security User",
    email: "security@example.com",
    loginMethod: "password",
    passwordHash: await hashPassword("kata-sandi-lama-aman"),
    mustChangePassword: false,
    emailVerifiedAt: new Date(),
    role: "user",
    unlimitedTransforms: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return { ctx: { user, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] }, user };
}

describe("account security", () => {
  it("records a private audit event and emails the owner after a self-service password change", async () => {
    const { ctx, user } = await createContext();
    mocks.updateLocalPassword.mockResolvedValue(user);
    mocks.sendPasswordChangedEmail.mockResolvedValue(true);
    const result = await appRouter.createCaller(ctx).auth.changePassword({ currentPassword: "kata-sandi-lama-aman", nextPassword: "kata-sandi-baru-aman" });
    expect(mocks.recordUserSecurityEvent).toHaveBeenCalledWith(88, "password_changed");
    expect(mocks.sendPasswordChangedEmail).toHaveBeenCalledWith(user);
    expect(result.emailNoticeSent).toBe(true);
  });

  it("returns only the authenticated owner’s security history", async () => {
    const { ctx } = await createContext();
    mocks.listUserSecurityEvents.mockResolvedValue([{ id: 1, userId: 88, kind: "login", createdAt: new Date() }]);
    const result = await appRouter.createCaller(ctx).auth.securityHistory();
    expect(mocks.listUserSecurityEvents).toHaveBeenCalledWith(88);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("login");
  });
});
