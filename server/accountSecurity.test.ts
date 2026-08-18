import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { hashPassword } from "./localAuth";

const mocks = vi.hoisted(() => ({
  updateLocalPassword: vi.fn(),
  invalidateUserSessions: vi.fn(),
  recordUserSecurityEvent: vi.fn(),
  listUserSecurityEvents: vi.fn(),
  getLoginLock: vi.fn(),
  getUserByEmail: vi.fn(),
  recordFailedLogin: vi.fn(),
  sendPasswordChangedEmail: vi.fn(),
  sendAccountLockedEmail: vi.fn(),
}));

vi.mock("./db", () => ({
  updateLocalPassword: mocks.updateLocalPassword,
  invalidateUserSessions: mocks.invalidateUserSessions,
  recordUserSecurityEvent: mocks.recordUserSecurityEvent,
  listUserSecurityEvents: mocks.listUserSecurityEvents,
  getLoginLock: mocks.getLoginLock,
  getUserByEmail: mocks.getUserByEmail,
  recordFailedLogin: mocks.recordFailedLogin,
}));

vi.mock("./accountEmails", () => ({
  issueAccountEmail: vi.fn(),
  sendPasswordChangedEmail: mocks.sendPasswordChangedEmail,
  sendAccountLockedEmail: mocks.sendAccountLockedEmail,
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
  return { ctx: { user, req: { headers: {} } as TrpcContext["req"], res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"] }, user };
}

describe("account security", () => {
  it("records a private audit event and emails the owner after a self-service password change", async () => {
    const { ctx, user } = await createContext();
    mocks.updateLocalPassword.mockResolvedValue(user);
    mocks.invalidateUserSessions.mockResolvedValue(1);
    mocks.sendPasswordChangedEmail.mockResolvedValue(true);
    const result = await appRouter.createCaller(ctx).auth.changePassword({ currentPassword: "kata-sandi-lama-aman", nextPassword: "kata-sandi-baru-aman" });
    expect(mocks.recordUserSecurityEvent).toHaveBeenCalledWith(88, "password_changed");
    expect(mocks.sendPasswordChangedEmail).toHaveBeenCalledWith(user);
    expect(result.emailNoticeSent).toBe(true);
  });

  it("invalidates every local session and clears the current cookie on demand", async () => {
    const { ctx } = await createContext();
    mocks.invalidateUserSessions.mockResolvedValue(2);
    await expect(appRouter.createCaller(ctx).auth.signOutAllSessions()).resolves.toEqual({ success: true });
    expect(mocks.invalidateUserSessions).toHaveBeenCalledWith(88);
    expect(mocks.recordUserSecurityEvent).toHaveBeenCalledWith(88, "all_sessions_signed_out");
    expect((ctx.res.clearCookie as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it("records and emails an account lock only after the login throttle locks a known account", async () => {
    const { ctx, user } = await createContext();
    mocks.getLoginLock.mockResolvedValue(null);
    mocks.getUserByEmail.mockResolvedValue(user);
    mocks.recordFailedLogin.mockResolvedValue(new Date(Date.now() + 15 * 60 * 1000));
    mocks.sendAccountLockedEmail.mockResolvedValue(true);
    await expect(appRouter.createCaller(ctx).auth.login({ email: user.email!, password: "kata-sandi-yang-salah" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(mocks.recordUserSecurityEvent).toHaveBeenCalledWith(88, "account_locked");
    expect(mocks.sendAccountLockedEmail).toHaveBeenCalledWith(user);
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
