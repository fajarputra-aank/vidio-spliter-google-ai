import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDailyPhotoQuota: vi.fn(),
  consumePurchasedCredit: vi.fn(),
  refundPurchasedCredit: vi.fn(),
  createPhotoTransform: vi.fn(),
  completePhotoTransform: vi.fn(),
  failPhotoTransform: vi.fn(),
  getOwnedPhotoTransform: vi.fn(),
  storagePut: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock("./db", () => ({
  getDailyPhotoQuota: mocks.getDailyPhotoQuota,
  consumePurchasedCredit: mocks.consumePurchasedCredit,
  refundPurchasedCredit: mocks.refundPurchasedCredit,
  createPhotoTransform: mocks.createPhotoTransform,
  completePhotoTransform: mocks.completePhotoTransform,
  failPhotoTransform: mocks.failPhotoTransform,
  getOwnedPhotoTransform: mocks.getOwnedPhotoTransform,
}));

vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: mocks.generateImage }));

import { appRouter } from "./routers";

function adminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      name: "Admin",
      email: "admin@example.test",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function specialAccessContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "special-user",
      name: "Special Access",
      email: "special@example.test",
      loginMethod: "manus",
      role: "user",
      unlimitedTransforms: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin photo transforms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDailyPhotoQuota.mockResolvedValue({ exhausted: true, remaining: 0, dailyLimit: 5 });
    mocks.storagePut.mockResolvedValue({ key: "originals/1/source.png", url: "/manus-storage/originals/1/source.png" });
    mocks.createPhotoTransform.mockResolvedValue({ id: 42 });
    mocks.generateImage.mockResolvedValue({ url: "/manus-storage/results/admin.png" });
    mocks.completePhotoTransform.mockResolvedValue({ id: 42, resultUrl: "/manus-storage/results/admin.png", status: "completed" });
    mocks.getOwnedPhotoTransform.mockResolvedValue({ id: 11, status: "failed" });
  });

  it("bypasses an exhausted daily quota without consuming purchased credit", async () => {
    const caller = appRouter.createCaller(adminContext());
    const sourceData = Buffer.from("a small image payload for test").toString("base64");

    const result = await caller.photo.transform({
      recipe: "headshot",
      aspectRatio: "1:1",
      style: "editorial",
      fileName: "profile.png",
      mimeType: "image/png",
      sourceData,
    });

    expect(mocks.consumePurchasedCredit).not.toHaveBeenCalled();
    expect(mocks.generateImage).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ id: 42, status: "completed" });
  });

  it("lets a flagged regular user bypass the exhausted transform quota without becoming an admin", async () => {
    const caller = appRouter.createCaller(specialAccessContext());
    const sourceData = Buffer.from("a small image payload for special access").toString("base64");

    await caller.photo.transform({ recipe: "headshot", aspectRatio: "1:1", style: "editorial", fileName: "profile.png", mimeType: "image/png", sourceData });

    expect(mocks.consumePurchasedCredit).not.toHaveBeenCalled();
    expect(mocks.generateImage).toHaveBeenCalledOnce();
  });

  it("records an owner-scoped retry relationship for a failed transform", async () => {
    const caller = appRouter.createCaller(adminContext());
    const sourceData = Buffer.from("retry image payload").toString("base64");

    await caller.photo.transform({ recipe: "headshot", aspectRatio: "1:1", style: "editorial", fileName: "retry.png", mimeType: "image/png", sourceData, retryOfTransformId: 11 });

    expect(mocks.getOwnedPhotoTransform).toHaveBeenCalledWith(1, 11);
    expect(mocks.createPhotoTransform).toHaveBeenCalledWith(expect.objectContaining({ retryOfTransformId: 11, userId: 1 }));
  });
});
