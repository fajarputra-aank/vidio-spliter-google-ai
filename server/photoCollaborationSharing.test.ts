import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ createPhotoCollaborationShareLink: vi.fn(), listPhotoCollaborationShareLinks: vi.fn(), revokePhotoCollaborationShareLink: vi.fn(), getPhotoCollaborationShareByTokenHash: vi.fn(), listPhotoCollaborationLayoutPresets: vi.fn(), createPhotoCollaborationLayoutPreset: vi.fn(), deletePhotoCollaborationLayoutPreset: vi.fn() }));
vi.mock("./db", () => ({ createPhotoCollaborationShareLink: mocks.createPhotoCollaborationShareLink, listPhotoCollaborationShareLinks: mocks.listPhotoCollaborationShareLinks, revokePhotoCollaborationShareLink: mocks.revokePhotoCollaborationShareLink, getPhotoCollaborationShareByTokenHash: mocks.getPhotoCollaborationShareByTokenHash, listPhotoCollaborationLayoutPresets: mocks.listPhotoCollaborationLayoutPresets, createPhotoCollaborationLayoutPreset: mocks.createPhotoCollaborationLayoutPreset, deletePhotoCollaborationLayoutPreset: mocks.deletePhotoCollaborationLayoutPreset }));
import { appRouter } from "./routers";

function context(userId: number): TrpcContext { return { user: { id: userId, openId: `share-${userId}`, name: "Pemilik", email: `pemilik${userId}@example.test`, loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }
const layout = { firstX: -12, firstY: 4, firstScale: 1.1, secondX: 8, secondY: -3, secondScale: 0.9 };

describe("tautan dan preset Kolaborasi Foto", () => {
  it("membuat, mendaftar, dan mencabut tautan dengan identitas pemilik aktif", async () => {
    mocks.createPhotoCollaborationShareLink.mockResolvedValue({ id: 71, expiresAt: new Date("2026-08-20T00:00:00.000Z") }); mocks.listPhotoCollaborationShareLinks.mockResolvedValue([]); mocks.revokePhotoCollaborationShareLink.mockResolvedValue({ success: true });
    const caller = appRouter.createCaller(context(71)); const created = await caller.photo.createCollaborationShareLink({ transformId: 80, expiresInHours: 24 }); await caller.photo.collaborationShareLinks({ transformId: 80 }); await caller.photo.revokeCollaborationShareLink({ shareLinkId: 71 });
    expect(created.token).toHaveLength(43); expect(mocks.createPhotoCollaborationShareLink).toHaveBeenCalledWith(71, 80, expect.any(String), expect.any(Date)); expect(mocks.listPhotoCollaborationShareLinks).toHaveBeenCalledWith(71, 80); expect(mocks.revokePhotoCollaborationShareLink).toHaveBeenCalledWith(71, 71);
  });

  it("menampilkan metadata publik hanya saat token aktif dan menyimpan preset sesuai pemilik", async () => {
    mocks.getPhotoCollaborationShareByTokenHash.mockResolvedValue({ title: "Kolaborasi dua foto", template: "couple", aspectRatio: "1:1", expiresAt: new Date("2026-08-20T00:00:00.000Z") }); mocks.createPhotoCollaborationLayoutPreset.mockResolvedValue({ id: 8 }); mocks.listPhotoCollaborationLayoutPresets.mockResolvedValue([]); mocks.deletePhotoCollaborationLayoutPreset.mockResolvedValue({ success: true });
    const token = "a".repeat(43); const publicCaller = appRouter.createCaller({ user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] }); const owner = appRouter.createCaller(context(72)); const preview = await publicCaller.photo.collaborationSharePreview({ token }); await owner.photo.createCollaborationLayoutPreset({ name: "Produk miring", layout }); await owner.photo.collaborationLayoutPresets(); await owner.photo.deleteCollaborationLayoutPreset({ presetId: 8 });
    expect(preview).toMatchObject({ title: "Kolaborasi dua foto", template: "couple" }); expect(mocks.getPhotoCollaborationShareByTokenHash).toHaveBeenCalledWith(expect.any(String)); expect(mocks.createPhotoCollaborationLayoutPreset).toHaveBeenCalledWith(72, "Produk miring", JSON.stringify(layout)); expect(mocks.listPhotoCollaborationLayoutPresets).toHaveBeenCalledWith(72); expect(mocks.deletePhotoCollaborationLayoutPreset).toHaveBeenCalledWith(72, 8);
  });
});
