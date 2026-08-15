import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  createCommunityReport: vi.fn(),
  listPhotoAlbums: vi.fn(),
  createPhotoAlbum: vi.fn(),
  addTransformToAlbum: vi.fn(),
  removeTransformFromAlbum: vi.fn(),
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
    mocks.createPhotoAlbum.mockResolvedValue({ id: 8, userId: 31, name: "Pilihan" });
    mocks.addTransformToAlbum.mockResolvedValue({ success: true });
    mocks.removeTransformFromAlbum.mockResolvedValue({ success: true });
    const caller = appRouter.createCaller(context());
    await caller.albums.list();
    await caller.albums.create({ name: "Pilihan" });
    await caller.albums.addTransform({ albumId: 8, transformId: 55 });
    await caller.albums.removeTransform({ albumId: 8, transformId: 55 });
    expect(mocks.listPhotoAlbums).toHaveBeenCalledWith(31);
    expect(mocks.createPhotoAlbum).toHaveBeenCalledWith(31, "Pilihan");
    expect(mocks.addTransformToAlbum).toHaveBeenCalledWith(31, 8, 55);
    expect(mocks.removeTransformFromAlbum).toHaveBeenCalledWith(31, 8, 55);
  });

  it("keeps report review actions behind the administrator gate", async () => {
    mocks.resolveCommunityReport.mockResolvedValue({ success: true });
    await expect(appRouter.createCaller(context(1, "admin")).admin.resolveReport({ reportId: 10, action: "dismiss" })).resolves.toEqual({ success: true });
    expect(mocks.resolveCommunityReport).toHaveBeenCalledWith(10, "dismiss");
    await expect(appRouter.createCaller(context()).admin.resolveReport({ reportId: 10, action: "dismiss" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
