import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ setPhotoTransformHidden: vi.fn(), deletePhotoTransform: vi.fn(), deleteFailedPhotoTransforms: vi.fn(), movePhotoTransformsToTrash: vi.fn(), restoreTrashedPhotoTransform: vi.fn(), emptyPhotoTrash: vi.fn(), deleteCommunityPost: vi.fn() }));
vi.mock("./db", () => ({ setPhotoTransformHidden: mocks.setPhotoTransformHidden, deletePhotoTransform: mocks.deletePhotoTransform, deleteFailedPhotoTransforms: mocks.deleteFailedPhotoTransforms, movePhotoTransformsToTrash: mocks.movePhotoTransformsToTrash, restoreTrashedPhotoTransform: mocks.restoreTrashedPhotoTransform, emptyPhotoTrash: mocks.emptyPhotoTrash, deleteCommunityPost: mocks.deleteCommunityPost }));
import { appRouter } from "./routers";

function ownerContext(): TrpcContext {
  return { user: { id: 23, openId: "owner-test", name: "Owner", email: "owner@test.local", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("owner privacy actions", () => {
  it("passes only the authenticated owner id to hide, trash, restore, empty, or delete a transform and delete a community post", async () => {
    mocks.setPhotoTransformHidden.mockResolvedValue({ success: true, isHidden: true });
    mocks.deletePhotoTransform.mockResolvedValue({ success: true, revokedShareLinks: 2 });
    mocks.deleteFailedPhotoTransforms.mockResolvedValue({ deletedCount: 2, revokedShareLinks: 0 });
    mocks.movePhotoTransformsToTrash.mockResolvedValue({ trashedCount: 2, revokedShareLinks: 1, trashExpiresAt: new Date() });
    mocks.restoreTrashedPhotoTransform.mockResolvedValue({ success: true });
    mocks.emptyPhotoTrash.mockResolvedValue({ deletedCount: 2 });
    mocks.deleteCommunityPost.mockResolvedValue({ success: true });
    const caller = appRouter.createCaller(ownerContext());
    await caller.photo.setHidden({ transformId: 44, isHidden: true });
    await caller.photo.moveToTrash({ transformIds: [44, 45] });
    await caller.photo.restoreFromTrash({ transformId: 44 });
    await caller.photo.emptyTrash();
    await caller.photo.deletePhotoTransform({ transformId: 44 });
    await caller.photo.deleteFailedTransforms({ transformIds: [44, 45] });
    await caller.community.delete({ postId: 55 });
    expect(mocks.setPhotoTransformHidden).toHaveBeenCalledWith(23, 44, true);
    expect(mocks.movePhotoTransformsToTrash).toHaveBeenCalledWith(23, [44, 45]);
    expect(mocks.restoreTrashedPhotoTransform).toHaveBeenCalledWith(23, 44);
    expect(mocks.emptyPhotoTrash).toHaveBeenCalledWith(23);
    expect(mocks.deletePhotoTransform).toHaveBeenCalledWith(23, 44);
    expect(mocks.deleteFailedPhotoTransforms).toHaveBeenCalledWith(23, [44, 45]);
    expect(mocks.deleteCommunityPost).toHaveBeenCalledWith(23, 55);
  });
});
