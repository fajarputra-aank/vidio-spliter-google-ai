import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ moderateDeleteCommunityPost: vi.fn() }));
vi.mock("./db", () => ({ moderateDeleteCommunityPost: mocks.moderateDeleteCommunityPost }));
import { appRouter } from "./routers";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: 4, openId: "moderator", name: "Moderator", email: "moderator@test.local", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("community moderation", () => {
  it("allows only an administrator to remove a public post", async () => {
    mocks.moderateDeleteCommunityPost.mockResolvedValue({ success: true });
    await expect(appRouter.createCaller(context("admin")).admin.moderateDeletePost({ postId: 12 })).resolves.toEqual({ success: true });
    expect(mocks.moderateDeleteCommunityPost).toHaveBeenCalledWith(12);
    await expect(appRouter.createCaller(context("user")).admin.moderateDeletePost({ postId: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
