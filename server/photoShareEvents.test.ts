import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ recordPhotoShareEvent: vi.fn(), listPhotoShareEvents: vi.fn() }));
vi.mock("./db", () => ({ recordPhotoShareEvent: mocks.recordPhotoShareEvent, listPhotoShareEvents: mocks.listPhotoShareEvents }));
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
});
