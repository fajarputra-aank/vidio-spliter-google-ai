import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  createCommunityReport: vi.fn(),
  listPhotoAlbums: vi.fn(),
  listArchivedPhotoAlbums: vi.fn(),
  createPhotoAlbum: vi.fn(),
  renamePhotoAlbum: vi.fn(),
  deletePhotoAlbum: vi.fn(),
  setPhotoAlbumArchived: vi.fn(),
  touchPhotoAlbum: vi.fn(),
  addTransformToAlbum: vi.fn(),
  addTransformsToAlbum: vi.fn(),
  removeTransformFromAlbum: vi.fn(),
  listUserNotifications: vi.fn(),
  getUserNotificationDetail: vi.fn(),
  markUserNotificationRead: vi.fn(),
  markAllUserNotificationsRead: vi.fn(),
  getUserNotificationPreferences: vi.fn(),
  updateUserNotificationPreferences: vi.fn(),
  listAdminCommunityReports: vi.fn(),
  resolveCommunityReport: vi.fn(),
}));
vi.mock("./db", () => mocks);
import { appRouter } from "./routers";

function context(id = 31, role: "admin" | "user" = "user"): TrpcContext {
  return { user: { id, openId: `user-${id}`, name: "Penguji", email: `user${id}@test.local`, loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("community report and private album contracts", () => {
  it("threads the authenticated reporter and a validated reason to the reporting guard", async () => {
    mocks.createCommunityReport.mockResolvedValue({ success: true });
    await expect(appRouter.createCaller(context()).community.report({ postId: 72, reason: "copyright", details: "Hak atas gambar perlu ditinjau." })).resolves.toEqual({ success: true });
    expect(mocks.createCommunityReport).toHaveBeenCalledWith(31, { postId: 72, reason: "copyright", details: "Hak atas gambar perlu ditinjau." });
    await expect(appRouter.createCaller(context()).community.report({ postId: 72, reason: "invalid" as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("scopes every album action to the authenticated owner", async () => {
    mocks.listPhotoAlbums.mockResolvedValue([]);
    mocks.listArchivedPhotoAlbums.mockResolvedValue([]);
    mocks.createPhotoAlbum.mockResolvedValue({ id: 8, userId: 31, name: "Pilihan" });
    mocks.renamePhotoAlbum.mockResolvedValue({ success: true });
    mocks.deletePhotoAlbum.mockResolvedValue({ success: true });
    mocks.setPhotoAlbumArchived.mockResolvedValue({ success: true, isArchived: true });
    mocks.touchPhotoAlbum.mockResolvedValue({ success: true });
    mocks.addTransformToAlbum.mockResolvedValue({ success: true });
    mocks.addTransformsToAlbum.mockResolvedValue({ success: true, added: 2 });
    mocks.removeTransformFromAlbum.mockResolvedValue({ success: true });
    const caller = appRouter.createCaller(context());
    await caller.albums.list();
    await caller.albums.listArchived();
    await caller.albums.create({ name: "Pilihan" });
    await caller.albums.rename({ albumId: 8, name: "Pilihan baru" });
    await caller.albums.setArchived({ albumId: 8, isArchived: true });
    await caller.albums.touch({ albumId: 8 });
    await caller.albums.addTransform({ albumId: 8, transformId: 55 });
    await caller.albums.addTransforms({ albumId: 8, transformIds: [55, 56] });
    await caller.albums.removeTransform({ albumId: 8, transformId: 55 });
    await caller.albums.delete({ albumId: 8 });
    expect(mocks.listPhotoAlbums).toHaveBeenCalledWith(31);
    expect(mocks.listArchivedPhotoAlbums).toHaveBeenCalledWith(31);
    expect(mocks.createPhotoAlbum).toHaveBeenCalledWith(31, "Pilihan");
    expect(mocks.renamePhotoAlbum).toHaveBeenCalledWith(31, 8, "Pilihan baru");
    expect(mocks.setPhotoAlbumArchived).toHaveBeenCalledWith(31, 8, true);
    expect(mocks.touchPhotoAlbum).toHaveBeenCalledWith(31, 8);
    expect(mocks.addTransformToAlbum).toHaveBeenCalledWith(31, 8, 55);
    expect(mocks.addTransformsToAlbum).toHaveBeenCalledWith(31, 8, [55, 56]);
    expect(mocks.removeTransformFromAlbum).toHaveBeenCalledWith(31, 8, 55);
    expect(mocks.deletePhotoAlbum).toHaveBeenCalledWith(31, 8);
  });

  it("exposes only the signed-in user's moderation notifications and read action", async () => {
    mocks.listUserNotifications.mockResolvedValue([{ id: 17, userId: 31, title: "Karya publik ditindak moderator" }]);
    mocks.getUserNotificationDetail.mockResolvedValue({ notification: { id: 17, userId: 31 }, moderation: { action: "Publikasi komunitas dihapus" } });
    mocks.markUserNotificationRead.mockResolvedValue({ success: true });
    mocks.markAllUserNotificationsRead.mockResolvedValue({ success: true, marked: 3 });
    const caller = appRouter.createCaller(context());
    await expect(caller.notifications.list()).resolves.toEqual([{ id: 17, userId: 31, title: "Karya publik ditindak moderator" }]);
    await expect(caller.notifications.detail({ notificationId: 17 })).resolves.toEqual({ notification: { id: 17, userId: 31 }, moderation: { action: "Publikasi komunitas dihapus" } });
    await expect(caller.notifications.markRead({ notificationId: 17 })).resolves.toEqual({ success: true });
    await expect(caller.notifications.markAllRead()).resolves.toEqual({ success: true, marked: 3 });
    expect(mocks.listUserNotifications).toHaveBeenCalledWith(31);
    expect(mocks.getUserNotificationDetail).toHaveBeenCalledWith(31, 17);
    expect(mocks.markUserNotificationRead).toHaveBeenCalledWith(31, 17);
    expect(mocks.markAllUserNotificationsRead).toHaveBeenCalledWith(31);
  });

  it("keeps notification preferences private to the authenticated user", async () => {
    const preferences = { communityModeration: false, accountActivity: true, productUpdates: false };
    mocks.getUserNotificationPreferences.mockResolvedValue(preferences);
    mocks.updateUserNotificationPreferences.mockResolvedValue(preferences);
    const caller = appRouter.createCaller(context());
    await expect(caller.notifications.preferences()).resolves.toEqual(preferences);
    await expect(caller.notifications.updatePreferences(preferences)).resolves.toEqual(preferences);
    expect(mocks.getUserNotificationPreferences).toHaveBeenCalledWith(31);
    expect(mocks.updateUserNotificationPreferences).toHaveBeenCalledWith(31, preferences);
  });

  it("keeps report review actions behind the administrator gate", async () => {
    mocks.resolveCommunityReport.mockResolvedValue({ success: true });
    await expect(appRouter.createCaller(context(1, "admin")).admin.resolveReport({ reportId: 10, action: "dismiss" })).resolves.toEqual({ success: true });
    expect(mocks.resolveCommunityReport).toHaveBeenCalledWith(10, "dismiss");
    await expect(appRouter.createCaller(context()).admin.resolveReport({ reportId: 10, action: "dismiss" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
