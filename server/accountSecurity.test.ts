import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { hashPassword } from "./localAuth";

const mocks = vi.hoisted(() => ({
  updateLocalPassword: vi.fn(),
  invalidateUserSessions: vi.fn(),
  recordUserSecurityEvent: vi.fn(),
  listUserSecurityEvents: vi.fn(),
  listUserActiveSessions: vi.fn(),
  getLoginLock: vi.fn(),
  getUserByEmail: vi.fn(),
  recordFailedLogin: vi.fn(),
  clearFailedLogins: vi.fn(),
  getUserSessionVersion: vi.fn(),
  touchLocalSignIn: vi.fn(),
  revokeUserActiveSession: vi.fn(),
  sendPasswordChangedEmail: vi.fn(),
  sendAccountLockedEmail: vi.fn(),
  sendNewDeviceLoginEmail: vi.fn(),
  registerActiveSession: vi.fn(),
}));

vi.mock("./db", () => ({
  updateLocalPassword: mocks.updateLocalPassword,
  invalidateUserSessions: mocks.invalidateUserSessions,
  recordUserSecurityEvent: mocks.recordUserSecurityEvent,
  listUserSecurityEvents: mocks.listUserSecurityEvents,
  listUserActiveSessions: mocks.listUserActiveSessions,
  getLoginLock: mocks.getLoginLock,
  getUserByEmail: mocks.getUserByEmail,
  recordFailedLogin: mocks.recordFailedLogin,
  clearFailedLogins: mocks.clearFailedLogins,
  getUserSessionVersion: mocks.getUserSessionVersion,
  touchLocalSignIn: mocks.touchLocalSignIn,
  revokeUserActiveSession: mocks.revokeUserActiveSession,
}));

vi.mock("./accountEmails", () => ({
  issueAccountEmail: vi.fn(),
  sendPasswordChangedEmail: mocks.sendPasswordChangedEmail,
  sendAccountLockedEmail: mocks.sendAccountLockedEmail,
  sendNewDeviceLoginEmail: mocks.sendNewDeviceLoginEmail,
}));

vi.mock("./sessionMetadata", () => ({ registerActiveSession: mocks.registerActiveSession }));

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
    mocks.registerActiveSession.mockResolvedValue({ id: "current-session", isKnown: true, deviceLabel: "Windows · Chrome", locationLabel: "Jakarta, Indonesia" });
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

  it("emails the owner when a successful login comes from a new device or location", async () => {
    const { ctx, user } = await createContext();
    mocks.getLoginLock.mockResolvedValue(null);
    mocks.getUserByEmail.mockResolvedValue(user);
    mocks.getUserSessionVersion.mockResolvedValue(0);
    const newSession = { id: "18e0fb45-0922-4a01-aa11-aeb6a9f9567f", isKnown: false, deviceLabel: "Mac · Safari", locationLabel: "Bandung, Indonesia" };
    mocks.registerActiveSession.mockResolvedValue(newSession);
    mocks.sendNewDeviceLoginEmail.mockResolvedValue(true);
    await expect(appRouter.createCaller(ctx).auth.login({ email: user.email!, password: "kata-sandi-lama-aman" })).resolves.toMatchObject({ user });
    expect(mocks.recordUserSecurityEvent).toHaveBeenCalledWith(88, "new_device_login");
    expect(mocks.sendNewDeviceLoginEmail).toHaveBeenCalledWith(user, newSession);
  });

  it("returns only the authenticated owner’s security history", async () => {
    const { ctx } = await createContext();
    mocks.listUserSecurityEvents.mockResolvedValue([{ id: 1, userId: 88, kind: "login", createdAt: new Date() }]);
    const result = await appRouter.createCaller(ctx).auth.securityHistory();
    expect(mocks.listUserSecurityEvents).toHaveBeenCalledWith(88);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("login");
  });

  it("returns only the owner’s active sessions and marks the current device", async () => {
    const { ctx } = await createContext();
    ctx.sessionId = "current-session";
    mocks.listUserActiveSessions.mockResolvedValue([{ id: "current-session", userId: 88, deviceLabel: "Windows · Chrome", locationLabel: "Jakarta, Indonesia", lastSeenAt: new Date(), createdAt: new Date(), revokedAt: null }]);
    const result = await appRouter.createCaller(ctx).auth.activeSessions();
    expect(mocks.listUserActiveSessions).toHaveBeenCalledWith(88);
    expect(result[0]).toMatchObject({ id: "current-session", isCurrent: true });
    expect(result[0]).not.toHaveProperty("userId");
  });

  it("revokes only the selected session belonging to the authenticated owner", async () => {
    const { ctx } = await createContext();
    mocks.revokeUserActiveSession.mockResolvedValue(true);
    const sessionId = "18e0fb45-0922-4a01-aa11-aeb6a9f9567f";
    await expect(appRouter.createCaller(ctx).auth.signOutSession({ sessionId })).resolves.toEqual({ success: true, signedOutCurrent: false });
    expect(mocks.revokeUserActiveSession).toHaveBeenCalledWith(88, sessionId);
    expect(mocks.recordUserSecurityEvent).toHaveBeenCalledWith(88, "session_signed_out");
  });
});
