import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ recordPhotoShareEvent: vi.fn(), listPhotoShareEvents: vi.fn(), listPhotoShareEventsForTransforms: vi.fn() }));
vi.mock("./db", () => ({ recordPhotoShareEvent: mocks.recordPhotoShareEvent, listPhotoShareEvents: mocks.listPhotoShareEvents, listPhotoShareEventsForTransforms: mocks.listPhotoShareEventsForTransforms }));
import { appRouter } from "./routers";

function context(userId: number): TrpcContext {
  return { user: { id: userId, openId: `share-${userId}`, name: "Pemilik", email: `pemilik${userId}@example.test`, loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("riwayat berbagi hasil", () => {
  it("mencatat dan membaca aktivitas hanya melalui identitas pemilik aktif", async () => {
    mocks.recordPhotoShareEvent.mockResolvedValue({ id: 1 });
    mocks.listPhotoShareEvents.mockResolvedValue([]);
    const caller = appRouter.createCaller(context(71));
    await caller.photo.recordShare({ transformId: 9, platform: "instagram", caption: "Hasil katalog", watermarkText: "@tokosaya", outcome: "shared" });
    await caller.photo.shareHistory({ transformId: 9 });
    expect(mocks.recordPhotoShareEvent).toHaveBeenCalledWith(71, expect.objectContaining({ transformId: 9, platform: "instagram", watermarkText: "@tokosaya" }));
    expect(mocks.listPhotoShareEvents).toHaveBeenCalledWith(71, 9, { transformId: 9 });
  });

  it("meneruskan pencarian caption tanpa melepas batas pemilik dan transformasi", async () => {
    mocks.listPhotoShareEvents.mockResolvedValue([]);
    await appRouter.createCaller(context(72)).photo.shareHistory({ transformId: 19, captionQuery: "  promo akhir pekan  ", platform: "instagram" });
    expect(mocks.listPhotoShareEvents).toHaveBeenCalledWith(72, 19, { transformId: 19, captionQuery: "promo akhir pekan", platform: "instagram" });
  });

  it("mengambil ekspor gabungan hanya dengan identitas pemilik dan transformasi yang dipilihnya", async () => {
    mocks.listPhotoShareEventsForTransforms.mockResolvedValue([]);
    await appRouter.createCaller(context(73)).photo.combinedShareHistory({ transformIds: [21, 24, 29], from: new Date("2026-08-01T00:00:00.000Z"), to: new Date("2026-08-31T23:59:59.999Z") });
    expect(mocks.listPhotoShareEventsForTransforms).toHaveBeenCalledWith(73, [21, 24, 29], expect.objectContaining({ transformIds: [21, 24, 29], from: expect.any(Date), to: expect.any(Date) }));
  });
});
