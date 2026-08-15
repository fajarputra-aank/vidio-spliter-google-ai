import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDailyPhotoQuota: vi.fn(),
  consumePurchasedCredit: vi.fn(),
  refundPurchasedCredit: vi.fn(),
  createPhotoTransform: vi.fn(),
  completePhotoTransform: vi.fn(),
  failPhotoTransform: vi.fn(),
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

describe("admin photo transforms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDailyPhotoQuota.mockResolvedValue({ exhausted: true, remaining: 0, dailyLimit: 5 });
    mocks.storagePut.mockResolvedValue({ key: "originals/1/source.png", url: "/manus-storage/originals/1/source.png" });
    mocks.createPhotoTransform.mockResolvedValue({ id: 42 });
    mocks.generateImage.mockResolvedValue({ url: "/manus-storage/results/admin.png" });
    mocks.completePhotoTransform.mockResolvedValue({ id: 42, resultUrl: "/manus-storage/results/admin.png", status: "completed" });
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
});
