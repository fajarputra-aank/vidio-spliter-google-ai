import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ createPhotoCollaborationResultReport: vi.fn(), getPhotoCollaborationComparison: vi.fn(), listCollaborationBrandBackgroundPresets: vi.fn(), createCollaborationBrandBackgroundPreset: vi.fn() }));
vi.mock("./db", () => ({ createPhotoCollaborationResultReport: mocks.createPhotoCollaborationResultReport, getPhotoCollaborationComparison: mocks.getPhotoCollaborationComparison, listCollaborationBrandBackgroundPresets: mocks.listCollaborationBrandBackgroundPresets, createCollaborationBrandBackgroundPreset: mocks.createCollaborationBrandBackgroundPreset }));
import { appRouter } from "./routers";

function context(userId: number, role: "user" | "admin" = "user"): TrpcContext { return { user: { id: userId, openId: `feedback-${userId}`, name: "Pengguna", email: `pengguna${userId}@example.test`, loginMethod: "local", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

describe("laporan hasil dan preset brand Kolaborasi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("meneruskan laporan hasil hanya melalui identitas pemilik pemanggil", async () => {
    mocks.createPhotoCollaborationResultReport.mockResolvedValue({ success: true });
    await expect(appRouter.createCaller(context(44)).photo.reportCollaborationResult({ transformId: 81, reason: "face_mismatch", details: "Wajah pada frame akhir kurang sesuai." })).resolves.toEqual({ success: true });
    expect(mocks.createPhotoCollaborationResultReport).toHaveBeenCalledWith(44, expect.objectContaining({ transformId: 81, reason: "face_mismatch" }));
  });

  it("mengembalikan perbandingan versi melalui proxy privat tanpa metadata sumber", async () => {
    mocks.getPhotoCollaborationComparison.mockResolvedValue({ before: { id: 71, title: "Kolaborasi awal", resultUrl: "/manus-storage/results/before.png", createdAt: new Date() }, after: { id: 81, title: "Kolaborasi ulang", resultUrl: "/manus-storage/results/after.png", createdAt: new Date() } });
    const result = await appRouter.createCaller(context(44)).photo.collaborationComparison({ transformId: 81 });
    expect(mocks.getPhotoCollaborationComparison).toHaveBeenCalledWith(44, 81);
    expect(result).toMatchObject({ before: { resultUrl: "/api/media/private/results%2Fbefore.png" }, after: { resultUrl: "/api/media/private/results%2Fafter.png" } });
    expect(JSON.stringify(result)).not.toContain("sourceKey");
  });

  it("membatasi pengelolaan preset latar brand pada administrator", async () => {
    await expect(appRouter.createCaller(context(44)).admin.createCollaborationBrandBackgroundPreset({ name: "Ruang Brand", background: "office", isActive: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    mocks.createCollaborationBrandBackgroundPreset.mockResolvedValue({ id: 3, name: "Ruang Brand", background: "office", isActive: true });
    await appRouter.createCaller(context(1, "admin")).admin.createCollaborationBrandBackgroundPreset({ name: "Ruang Brand", background: "office", isActive: true });
    expect(mocks.createCollaborationBrandBackgroundPreset).toHaveBeenCalledWith({ name: "Ruang Brand", background: "office", isActive: true });
  });
});
