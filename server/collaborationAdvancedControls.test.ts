import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getOwnedPhotoTransform: vi.fn(), getDailyPhotoQuota: vi.fn(), consumePurchasedCredit: vi.fn(), refundPurchasedCredit: vi.fn(), getProcessingQueueStatus: vi.fn(), createPhotoTransform: vi.fn(), completePhotoTransform: vi.fn(), failPhotoTransform: vi.fn(), markPhotoTransformAutoRetry: vi.fn(), storageGetSignedUrl: vi.fn(), generateImage: vi.fn(), assessCollaborationFaceReadiness: vi.fn(),
}));
vi.mock("./db", () => ({ getOwnedPhotoTransform: mocks.getOwnedPhotoTransform, getDailyPhotoQuota: mocks.getDailyPhotoQuota, consumePurchasedCredit: mocks.consumePurchasedCredit, refundPurchasedCredit: mocks.refundPurchasedCredit, getProcessingQueueStatus: mocks.getProcessingQueueStatus, createPhotoTransform: mocks.createPhotoTransform, completePhotoTransform: mocks.completePhotoTransform, failPhotoTransform: mocks.failPhotoTransform, markPhotoTransformAutoRetry: mocks.markPhotoTransformAutoRetry }));
vi.mock("./storage", () => ({ storageGetSignedUrl: mocks.storageGetSignedUrl }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: mocks.generateImage }));
vi.mock("./collaborationFaceReadiness", () => ({ assessCollaborationFaceReadiness: mocks.assessCollaborationFaceReadiness }));
import { appRouter } from "./routers";

function context(userId: number): TrpcContext { return { user: { id: userId, openId: `advanced-${userId}`, name: "Pemilik", email: `pemilik${userId}@example.test`, loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

describe("kontrol lanjutan Kolaborasi Foto", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("mengulang hasil milik pengguna dari dua sumber privat dan mengganti latar tanpa mengubah lineage", async () => {
    mocks.getOwnedPhotoTransform.mockResolvedValue({ id: 81, userId: 9, recipe: "collaboration", status: "completed", sourceKey: "collaborations/9/source-a.jpg", sourceUrl: "/manus-storage/collaborations/9/source-a.jpg", secondarySourceKey: "collaborations/9/source-b.png", secondarySourceUrl: "/manus-storage/collaborations/9/source-b.png", collaborationTemplate: "couple", aspectRatio: "1:1", style: "editorial", collaborationLayout: null });
    mocks.getDailyPhotoQuota.mockResolvedValue({ exhausted: false, remaining: 3, dailyLimit: 5 });
    mocks.storageGetSignedUrl.mockResolvedValueOnce("https://signed.example/a").mockResolvedValueOnce("https://signed.example/b");
    mocks.getProcessingQueueStatus.mockResolvedValue({ position: 2 });
    mocks.createPhotoTransform.mockResolvedValue({ id: 82 });
    mocks.generateImage.mockResolvedValue({ url: "/manus-storage/generated/retry.png" });
    mocks.completePhotoTransform.mockResolvedValue({ id: 82, sourceUrl: "/manus-storage/collaborations/9/source-a.jpg", secondarySourceUrl: "/manus-storage/collaborations/9/source-b.png", resultUrl: "/manus-storage/generated/retry.png", status: "completed" });
    const result = await appRouter.createCaller(context(9)).photo.retryCollaboration({ transformId: 81, background: "garden", customInstruction: "Gunakan cahaya sore yang lembut." });
    expect(mocks.getOwnedPhotoTransform).toHaveBeenCalledWith(9, 81);
    expect(mocks.storageGetSignedUrl).toHaveBeenCalledWith("collaborations/9/source-a.jpg");
    expect(mocks.createPhotoTransform).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, retryOfTransformId: 81, sourceKey: "collaborations/9/source-a.jpg", secondarySourceKey: "collaborations/9/source-b.png", title: "Kolaborasi dua foto · latar baru" }));
    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({ quality: "high", originalImages: [{ url: "https://signed.example/a", mimeType: "image/jpeg" }, { url: "https://signed.example/b", mimeType: "image/png" }], prompt: expect.stringContaining("Replace only the background") }));
    expect(result).toMatchObject({ resultUrl: "/api/media/private/generated%2Fretry.png" });
  });

  it("menjalankan pemeriksaan kesiapan sementara tanpa memproses atau menyimpan sumber", async () => {
    const image = Buffer.from("temporary-face-readiness").toString("base64");
    mocks.assessCollaborationFaceReadiness.mockResolvedValue({ overall: "attention", first: { status: "ready", issues: [], guidance: "Foto A cukup jelas." }, second: { status: "attention", issues: ["blur"], guidance: "Gunakan foto B yang lebih tajam." }, notice: "Tidak menyimpan identitas." });
    const result = await appRouter.createCaller(context(9)).photo.collaborationFaceReadiness({ first: { fileName: "a.jpg", mimeType: "image/jpeg", sourceData: image }, second: { fileName: "b.jpg", mimeType: "image/jpeg", sourceData: image } });
    expect(mocks.assessCollaborationFaceReadiness).toHaveBeenCalledWith(expect.objectContaining({ sourceData: image }), expect.objectContaining({ sourceData: image }));
    expect(result).toMatchObject({ overall: "attention", second: { issues: ["blur"] } });
    expect(mocks.createPhotoTransform).not.toHaveBeenCalled();
  });
});
