import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  createPhotoCollaborationShareLink: vi.fn(),
  getCollaborationShareRoleLimits: vi.fn(),
  listPhotoCollaborationShareLinks: vi.fn(),
  revokePhotoCollaborationShareLink: vi.fn(),
  revokeAllActivePhotoCollaborationShareLinks: vi.fn(),
  getPhotoCollaborationShareByTokenHash: vi.fn(),
  listPhotoCollaborationLayoutPresets: vi.fn(),
  createPhotoCollaborationLayoutPreset: vi.fn(),
  deletePhotoCollaborationLayoutPreset: vi.fn(),
  listPhotoCollaborationBrandLogos: vi.fn(),
  createPhotoCollaborationBrandLogo: vi.fn(),
  deletePhotoCollaborationBrandLogo: vi.fn(),
}));

vi.mock("./db", () => ({
  createPhotoCollaborationShareLink: mocks.createPhotoCollaborationShareLink,
  getCollaborationShareRoleLimits: mocks.getCollaborationShareRoleLimits,
  listPhotoCollaborationShareLinks: mocks.listPhotoCollaborationShareLinks,
  revokePhotoCollaborationShareLink: mocks.revokePhotoCollaborationShareLink,
  revokeAllActivePhotoCollaborationShareLinks: mocks.revokeAllActivePhotoCollaborationShareLinks,
  getPhotoCollaborationShareByTokenHash: mocks.getPhotoCollaborationShareByTokenHash,
  listPhotoCollaborationLayoutPresets: mocks.listPhotoCollaborationLayoutPresets,
  createPhotoCollaborationLayoutPreset: mocks.createPhotoCollaborationLayoutPreset,
  deletePhotoCollaborationLayoutPreset: mocks.deletePhotoCollaborationLayoutPreset,
  listPhotoCollaborationBrandLogos: mocks.listPhotoCollaborationBrandLogos,
  createPhotoCollaborationBrandLogo: mocks.createPhotoCollaborationBrandLogo,
  deletePhotoCollaborationBrandLogo: mocks.deletePhotoCollaborationBrandLogo,
}));

import { appRouter } from "./routers";

function context(userId: number, role: "user" | "admin" = "user"): TrpcContext {
  return { user: { id: userId, openId: `share-${userId}`, name: "Pemilik", email: `pemilik${userId}@example.test`, loginMethod: "local", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const layout = { firstX: -12, firstY: 4, firstScale: 1.1, secondX: 8, secondY: -3, secondScale: 0.9 };

describe("tautan dan preset Kolaborasi Foto", () => {
  it("membuat, mendaftar, mencabut satu, dan mencabut semua tautan milik pemilik", async () => {
    mocks.createPhotoCollaborationShareLink.mockResolvedValue({ id: 71, expiresAt: new Date("2026-08-20T00:00:00.000Z") });
    mocks.getCollaborationShareRoleLimits.mockResolvedValue({ user: 3, admin: null });
    mocks.listPhotoCollaborationShareLinks.mockResolvedValue([]);
    mocks.revokePhotoCollaborationShareLink.mockResolvedValue({ success: true });
    mocks.revokeAllActivePhotoCollaborationShareLinks.mockResolvedValue({ revokedCount: 2 });
    const caller = appRouter.createCaller(context(71));
    const created = await caller.photo.createCollaborationShareLink({ transformId: 80, expiresInHours: 24, watermarkText: "Lensa Saku · Kolaborasi" });
    await caller.photo.collaborationShareLinks({ transformId: 80 });
    await expect(caller.photo.collaborationShareLimit()).resolves.toEqual({ maxActiveLinks: 3 });
    await caller.photo.revokeCollaborationShareLink({ shareLinkId: 71 });
    await caller.photo.revokeAllCollaborationShareLinks({ transformId: 80 });
    expect(created.token).toHaveLength(43);
    expect(mocks.createPhotoCollaborationShareLink).toHaveBeenCalledWith(71, "user", 80, expect.any(String), expect.any(Date), "Lensa Saku · Kolaborasi", null);
    expect(mocks.listPhotoCollaborationShareLinks).toHaveBeenCalledWith(71, 80);
    expect(mocks.getCollaborationShareRoleLimits).toHaveBeenCalledOnce();
    expect(mocks.revokePhotoCollaborationShareLink).toHaveBeenCalledWith(71, 71);
    expect(mocks.revokeAllActivePhotoCollaborationShareLinks).toHaveBeenCalledWith(80, 71);
  });

  it("meneruskan peran administrator ke pembatas tautan Kolaborasi", async () => {
    mocks.createPhotoCollaborationShareLink.mockResolvedValue({ id: 101, expiresAt: new Date("2026-08-20T00:00:00.000Z") });
    mocks.getCollaborationShareRoleLimits.mockResolvedValue({ user: 3, admin: null });
    await appRouter.createCaller(context(74, "admin")).photo.createCollaborationShareLink({ transformId: 82, expiresInHours: 72 });
    await expect(appRouter.createCaller(context(74, "admin")).photo.collaborationShareLimit()).resolves.toEqual({ maxActiveLinks: null });
    expect(mocks.createPhotoCollaborationShareLink).toHaveBeenCalledWith(74, "admin", 82, expect.any(String), expect.any(Date), null, null);
  });

  it("menampilkan metadata publik hanya saat token aktif dan menyimpan preset sesuai pemilik", async () => {
    mocks.getPhotoCollaborationShareByTokenHash.mockResolvedValue({ title: "Kolaborasi dua foto", template: "couple", aspectRatio: "1:1", watermarkText: "Lensa Saku", expiresAt: new Date("2026-08-20T00:00:00.000Z") });
    mocks.createPhotoCollaborationLayoutPreset.mockResolvedValue({ id: 8 });
    mocks.listPhotoCollaborationLayoutPresets.mockResolvedValue([]);
    mocks.deletePhotoCollaborationLayoutPreset.mockResolvedValue({ success: true });
    const token = "a".repeat(43);
    const publicCaller = appRouter.createCaller({ user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });
    const owner = appRouter.createCaller(context(72));
    const preview = await publicCaller.photo.collaborationSharePreview({ token });
    await owner.photo.createCollaborationLayoutPreset({ name: "Produk miring", layout });
    await owner.photo.collaborationLayoutPresets();
    await owner.photo.deleteCollaborationLayoutPreset({ presetId: 8 });
    expect(preview).toMatchObject({ title: "Kolaborasi dua foto", template: "couple", hasWatermark: true });
    expect(mocks.getPhotoCollaborationShareByTokenHash).toHaveBeenCalledWith(expect.any(String));
    expect(mocks.createPhotoCollaborationLayoutPreset).toHaveBeenCalledWith(72, "Produk miring", JSON.stringify(layout));
    expect(mocks.listPhotoCollaborationLayoutPresets).toHaveBeenCalledWith(72);
    expect(mocks.deletePhotoCollaborationLayoutPreset).toHaveBeenCalledWith(72, 8);
  });

  it("meneruskan logo watermark hanya untuk pemilik yang membuat tautan", async () => {
    mocks.createPhotoCollaborationShareLink.mockResolvedValue({ id: 90, expiresAt: new Date("2026-08-20T00:00:00.000Z") });
    mocks.listPhotoCollaborationBrandLogos.mockResolvedValue([{ id: 4, name: "Logo toko" }]);
    mocks.deletePhotoCollaborationBrandLogo.mockResolvedValue({ success: true });
    const caller = appRouter.createCaller(context(73));
    const logos = await caller.photo.collaborationBrandLogos();
    await caller.photo.createCollaborationShareLink({ transformId: 81, expiresInHours: 1, watermarkLogoId: 4 });
    await caller.photo.deleteCollaborationBrandLogo({ logoId: 4 });
    expect(logos).toEqual([{ id: 4, name: "Logo toko" }]);
    expect(mocks.listPhotoCollaborationBrandLogos).toHaveBeenCalledWith(73);
    expect(mocks.createPhotoCollaborationShareLink).toHaveBeenCalledWith(73, "user", 81, expect.any(String), expect.any(Date), null, 4);
    expect(mocks.deletePhotoCollaborationBrandLogo).toHaveBeenCalledWith(73, 4);
  });
});
