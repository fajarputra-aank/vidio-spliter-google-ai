import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getPhotoProfileSummary: vi.fn() }));

vi.mock("./db", () => ({
  getPhotoProfileSummary: mocks.getPhotoProfileSummary,
}));

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createProfileContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "profile-user",
    email: "profile@example.com",
    name: "Profile User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("photo.profile", () => {
  it("returns the authenticated user identity and only that user's quota summary", async () => {
    mocks.getPhotoProfileSummary.mockResolvedValue({
      quota: { dailyLimit: 5, used: 2, remaining: 3, exhausted: false, resetsAt: new Date("2026-08-16T00:00:00.000Z") },
      totalTransforms: 11,
    });
    const caller = appRouter.createCaller(createProfileContext());

    const result = await caller.photo.profile();

    expect(mocks.getPhotoProfileSummary).toHaveBeenCalledWith(42);
    expect(result.user).toMatchObject({ name: "Profile User", email: "profile@example.com" });
    expect(result.quota).toMatchObject({ dailyLimit: 5, used: 2, remaining: 3, exhausted: false });
    expect(result.totalTransforms).toBe(11);
  });
});
