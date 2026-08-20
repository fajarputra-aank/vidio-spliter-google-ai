import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getDailyPhotoQuota: vi.fn(), consumePurchasedCredit: vi.fn(), refundPurchasedCredit: vi.fn(), getProcessingQueueStatus: vi.fn(), createPhotoTransform: vi.fn(), completePhotoTransform: vi.fn(), failPhotoTransform: vi.fn(), markPhotoTransformAutoRetry: vi.fn(), recordAiProviderCapacityStatus: vi.fn(), getOwnedPhotoTransform: vi.fn(), queueCollaborationProviderRetry: vi.fn(), storagePut: vi.fn(), generateImage: vi.fn() }));
vi.mock("./db", () => ({ getDailyPhotoQuota: mocks.getDailyPhotoQuota, consumePurchasedCredit: mocks.consumePurchasedCredit, refundPurchasedCredit: mocks.refundPurchasedCredit, getProcessingQueueStatus: mocks.getProcessingQueueStatus, createPhotoTransform: mocks.createPhotoTransform, completePhotoTransform: mocks.completePhotoTransform, failPhotoTransform: mocks.failPhotoTransform, markPhotoTransformAutoRetry: mocks.markPhotoTransformAutoRetry, recordAiProviderCapacityStatus: mocks.recordAiProviderCapacityStatus, getOwnedPhotoTransform: mocks.getOwnedPhotoTransform, queueCollaborationProviderRetry: mocks.queueCollaborationProviderRetry }));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: mocks.generateImage }));
import { appRouter } from "./routers";

function context(userId: number, role: "user" | "admin" = "user"): TrpcContext { return { user: { id: userId, openId: `collab-${userId}`, name: "Pemilik", email: `pemilik${userId}@example.test`, loginMethod: "local", role, unlimitedTransforms: role === "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

describe("Kolaborasi Foto", () => {
  it("menyimpan dua sumber privat dan mengirim keduanya pada kualitas tinggi dengan aturan preservasi wajah", async () => {
    mocks.getDailyPhotoQuota.mockResolvedValue({ exhausted: false, remaining: 4, dailyLimit: 5 });
    mocks.storagePut.mockResolvedValueOnce({ key: "collaborations/7/a.jpg", url: "/manus-storage/collaborations/7/a.jpg" }).mockResolvedValueOnce({ key: "collaborations/7/b.jpg", url: "/manus-storage/collaborations/7/b.jpg" });
    mocks.getProcessingQueueStatus.mockResolvedValue({ position: 1 });
    mocks.createPhotoTransform.mockResolvedValue({ id: 44 });
    mocks.generateImage.mockResolvedValue({ url: "/manus-storage/results/collaboration.jpg" });
    mocks.completePhotoTransform.mockResolvedValue({ id: 44, sourceUrl: "/manus-storage/collaborations/7/a.jpg", secondarySourceUrl: "/manus-storage/collaborations/7/b.jpg", resultUrl: "/manus-storage/results/collaboration.jpg", status: "completed" });
    const image = Buffer.from("two-photo-collaboration-payload").toString("base64");
    const result = await appRouter.createCaller(context(7)).photo.collaborate({ first: { fileName: "a.jpg", mimeType: "image/jpeg", sourceData: image }, second: { fileName: "b.png", mimeType: "image/png", sourceData: image }, aspectRatio: "1:1", style: "editorial", customInstruction: "Satukan dalam suasana hangat." });
    expect(mocks.getDailyPhotoQuota).toHaveBeenCalledWith(7);
    expect(mocks.storagePut).toHaveBeenCalledTimes(2);
    expect(mocks.createPhotoTransform).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, recipe: "collaboration", secondarySourceKey: "collaborations/7/b.jpg" }));
    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({ originalImages: [{ b64Json: image, mimeType: "image/jpeg" }, { b64Json: image, mimeType: "image/png" }], quality: "high", prompt: expect.stringContaining("Identity preservation is non-negotiable") }));
    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining("Do not face-swap, blend faces, morph identities") }));
    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining("ONE unified single full-frame final photo") }));
    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining("Never render a diptych") }));
    expect(result).toMatchObject({ resultUrl: "/api/media/private/results%2Fcollaboration.jpg", secondarySourceUrl: "/api/media/private/collaborations%2F7%2Fb.jpg" });
  });

  it("membiarkan administrator memproses Kolaborasi saat kuota aplikasi habis tanpa memakai kredit", async () => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getDailyPhotoQuota.mockResolvedValue({ exhausted: true, remaining: 0, dailyLimit: 5 });
    mocks.storagePut.mockResolvedValueOnce({ key: "collaborations/8/a.jpg", url: "/manus-storage/collaborations/8/a.jpg" }).mockResolvedValueOnce({ key: "collaborations/8/b.jpg", url: "/manus-storage/collaborations/8/b.jpg" });
    mocks.getProcessingQueueStatus.mockResolvedValue({ position: 1 });
    mocks.createPhotoTransform.mockResolvedValue({ id: 45 });
    mocks.generateImage.mockResolvedValue({ url: "/manus-storage/results/admin-collaboration.jpg" });
    mocks.completePhotoTransform.mockResolvedValue({ id: 45, sourceUrl: "/manus-storage/collaborations/8/a.jpg", secondarySourceUrl: "/manus-storage/collaborations/8/b.jpg", resultUrl: "/manus-storage/results/admin-collaboration.jpg", status: "completed" });
    const image = Buffer.from("administrator-collaboration-payload").toString("base64");
    await expect(appRouter.createCaller(context(8, "admin")).photo.collaborate({ first: { fileName: "a.jpg", mimeType: "image/jpeg", sourceData: image }, second: { fileName: "b.jpg", mimeType: "image/jpeg", sourceData: image }, aspectRatio: "1:1", style: "editorial" })).resolves.toMatchObject({ id: 45, status: "completed" });
    expect(mocks.consumePurchasedCredit).not.toHaveBeenCalled();
    expect(mocks.generateImage).toHaveBeenCalledOnce();
  });

  it("mendaftarkan Kolaborasi gagal milik administrator ke antrean prioritas tanpa menerima ID milik pengguna lain", async () => {
    mocks.getOwnedPhotoTransform.mockResolvedValue({ id: 51, userId: 8, recipe: "collaboration", status: "failed", secondarySourceKey: "collaborations/8/b.jpg", errorMessage: "Kapasitas penyedia AI sedang penuh hari ini." });
    mocks.queueCollaborationProviderRetry.mockResolvedValue({ id: 9, priority: "admin", status: "queued", nextAttemptAt: new Date("2026-08-21T00:00:00.000Z") });
    await expect(appRouter.createCaller(context(8, "admin")).photo.queueCollaborationProviderRetry({ sourceTransformId: 51 })).resolves.toMatchObject({ id: 9, priority: "admin", status: "queued" });
    expect(mocks.getOwnedPhotoTransform).toHaveBeenCalledWith(8, 51);
    expect(mocks.queueCollaborationProviderRetry).toHaveBeenCalledWith(8, 51, "admin", expect.any(Date));
  });
});
