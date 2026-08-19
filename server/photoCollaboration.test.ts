import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getDailyPhotoQuota: vi.fn(), consumePurchasedCredit: vi.fn(), refundPurchasedCredit: vi.fn(), getProcessingQueueStatus: vi.fn(), createPhotoTransform: vi.fn(), completePhotoTransform: vi.fn(), failPhotoTransform: vi.fn(), markPhotoTransformAutoRetry: vi.fn(), storagePut: vi.fn(), generateImage: vi.fn() }));
vi.mock("./db", () => ({ getDailyPhotoQuota: mocks.getDailyPhotoQuota, consumePurchasedCredit: mocks.consumePurchasedCredit, refundPurchasedCredit: mocks.refundPurchasedCredit, getProcessingQueueStatus: mocks.getProcessingQueueStatus, createPhotoTransform: mocks.createPhotoTransform, completePhotoTransform: mocks.completePhotoTransform, failPhotoTransform: mocks.failPhotoTransform, markPhotoTransformAutoRetry: mocks.markPhotoTransformAutoRetry }));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: mocks.generateImage }));
import { appRouter } from "./routers";

function context(userId: number): TrpcContext { return { user: { id: userId, openId: `collab-${userId}`, name: "Pemilik", email: `pemilik${userId}@example.test`, loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

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
});
