import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ listPhotoCaptionTemplates: vi.fn(), createPhotoCaptionTemplate: vi.fn(), deletePhotoCaptionTemplate: vi.fn() }));
vi.mock("./db", () => ({ listPhotoCaptionTemplates: mocks.listPhotoCaptionTemplates, createPhotoCaptionTemplate: mocks.createPhotoCaptionTemplate, deletePhotoCaptionTemplate: mocks.deletePhotoCaptionTemplate }));
import { appRouter } from "./routers";

function context(userId: number): TrpcContext {
  return { user: { id: userId, openId: `caption-${userId}`, name: "Pemilik", email: `pemilik${userId}@example.test`, loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("template caption favorit", () => {
  it("menulis, membaca, dan menghapus template melalui pemilik yang aktif", async () => {
    mocks.createPhotoCaptionTemplate.mockResolvedValue({ id: 1 }); mocks.listPhotoCaptionTemplates.mockResolvedValue([]); mocks.deletePhotoCaptionTemplate.mockResolvedValue(true);
    const caller = appRouter.createCaller(context(53));
    await caller.captionTemplates.create({ name: "Promo mingguan", caption: "Produk baru siap dilihat." }); await caller.captionTemplates.list(); await caller.captionTemplates.delete({ templateId: 1 });
    expect(mocks.createPhotoCaptionTemplate).toHaveBeenCalledWith(53, "Promo mingguan", "Produk baru siap dilihat."); expect(mocks.listPhotoCaptionTemplates).toHaveBeenCalledWith(53); expect(mocks.deletePhotoCaptionTemplate).toHaveBeenCalledWith(53, 1);
  });
});
