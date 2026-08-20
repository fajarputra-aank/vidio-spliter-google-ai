import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listDue: vi.fn(), claim: vi.fn(), getOwned: vi.fn(), getProcessing: vi.fn(), create: vi.fn(), recordCapacity: vi.fn(), complete: vi.fn(), notify: vi.fn(), finish: vi.fn(), defer: vi.fn(), fail: vi.fn(), signedUrl: vi.fn(), generate: vi.fn(),
}));

vi.mock("./db", () => ({
  listDueCollaborationProviderRetries: mocks.listDue, claimCollaborationProviderRetry: mocks.claim, getOwnedPhotoTransform: mocks.getOwned, getProcessingQueueStatus: mocks.getProcessing, createPhotoTransform: mocks.create, recordAiProviderCapacityStatus: mocks.recordCapacity, completePhotoTransform: mocks.complete, createAccountActivityNotification: mocks.notify, finishCollaborationProviderRetry: mocks.finish, deferCollaborationProviderRetry: mocks.defer, failPhotoTransform: mocks.fail,
}));
vi.mock("./storage", () => ({ storageGetSignedUrl: mocks.signedUrl }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: mocks.generate }));

import { runCollaborationProviderRecoverySweep } from "./collaborationProviderRecovery";

const source = (userId: number, id: number) => ({ id, userId, recipe: "collaboration", status: "failed", sourceKey: `collaborations/${userId}/a.jpg`, sourceUrl: `/manus-storage/collaborations/${userId}/a.jpg`, secondarySourceKey: `collaborations/${userId}/b.jpg`, secondarySourceUrl: `/manus-storage/collaborations/${userId}/b.jpg`, collaborationTemplate: "couple", aspectRatio: "1:1", style: "editorial", collaborationLayout: null, retryInstruction: null });

describe("runCollaborationProviderRecoverySweep", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.claim.mockResolvedValue(true); mocks.getProcessing.mockResolvedValue({ position: 1 }); mocks.signedUrl.mockResolvedValue("https://signed.example/source"); mocks.create.mockResolvedValueOnce({ id: 901 }).mockResolvedValueOnce({ id: 902 }); mocks.complete.mockResolvedValue({}); mocks.generate.mockResolvedValue({ url: "/manus-storage/results/recovered.jpg" });
  });

  it("memproses antrean admin lebih dahulu dan memberi tahu pemilik setelah hasil siap", async () => {
    mocks.listDue.mockResolvedValue([{ id: 1, userId: 11, sourceTransformId: 101, priority: "admin" }, { id: 2, userId: 12, sourceTransformId: 102, priority: "standard" }]);
    mocks.getOwned.mockImplementation(async (userId: number, transformId: number) => source(userId, transformId));
    await expect(runCollaborationProviderRecoverySweep(new Date("2026-08-21T00:02:00.000Z"))).resolves.toEqual({ checked: 2, completed: 2, deferred: 0, skipped: 0 });
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ userId: 11, retryOfTransformId: 101 });
    expect(mocks.recordCapacity).toHaveBeenCalledWith("available");
    expect(mocks.notify).toHaveBeenCalledWith(11, "Kapasitas AI pulih · Kolaborasi diproses", expect.stringContaining("kembali tersedia"));
    expect(mocks.finish).toHaveBeenCalledWith(1, 901, true);
  });

  it("menunda entry pertama ketika kapasitas penyedia masih penuh tanpa mencoba entry berikutnya", async () => {
    mocks.listDue.mockResolvedValue([{ id: 1, userId: 11, sourceTransformId: 101, priority: "admin" }, { id: 2, userId: 12, sourceTransformId: 102, priority: "standard" }]);
    mocks.getOwned.mockResolvedValue(source(11, 101));
    mocks.generate.mockRejectedValue(new Error("usage exhausted"));
    await expect(runCollaborationProviderRecoverySweep(new Date("2026-08-21T00:02:00.000Z"))).resolves.toEqual({ checked: 2, completed: 0, deferred: 1, skipped: 0 });
    expect(mocks.defer).toHaveBeenCalledWith(1, new Date("2026-08-22T00:00:00.000Z"));
    expect(mocks.generate).toHaveBeenCalledOnce();
  });
});
