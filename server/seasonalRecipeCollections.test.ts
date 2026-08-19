import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getRecipePopularity: vi.fn(), listActiveSeasonalRecipeCollections: vi.fn(), listAdminSeasonalRecipeCollections: vi.fn(), createSeasonalRecipeCollection: vi.fn(), updateSeasonalRecipeCollection: vi.fn() }));
vi.mock("./db", () => ({ getRecipePopularity: mocks.getRecipePopularity, listActiveSeasonalRecipeCollections: mocks.listActiveSeasonalRecipeCollections, listAdminSeasonalRecipeCollections: mocks.listAdminSeasonalRecipeCollections, createSeasonalRecipeCollection: mocks.createSeasonalRecipeCollection, updateSeasonalRecipeCollection: mocks.updateSeasonalRecipeCollection }));

import { appRouter } from "./routers";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: role === "admin" ? 501 : 502, openId: `${role}-seasonal`, name: role, email: `${role}@example.test`, loginMethod: "local", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("koleksi resep musiman", () => {
  it("menjaga statistik agregat dan koleksi aktif tanpa data pengguna", async () => {
    mocks.getRecipePopularity.mockResolvedValue([{ recipeId: "ramadan_hampers", uses: 4 }]);
    mocks.listActiveSeasonalRecipeCollections.mockResolvedValue([]);
    const caller = appRouter.createCaller({ ...context("user"), user: null });
    await caller.recipeCatalog.popularity();
    await caller.recipeCatalog.seasonalCollections();
    expect(mocks.getRecipePopularity).toHaveBeenCalledWith();
    expect(mocks.listActiveSeasonalRecipeCollections).toHaveBeenCalledWith();
  });

  it("membatasi tulis koleksi pada administrator dan meneruskan hanya input tervalidasi", async () => {
    mocks.createSeasonalRecipeCollection.mockResolvedValue({ id: 1 });
    const admin = appRouter.createCaller(context("admin"));
    await admin.admin.createSeasonalCollection({ slug: "hampers-ramadan", name: "Hampers Ramadan", season: "ramadan", description: "Pilihan hamper yang rapi untuk katalog promosi toko.", recipeIds: ["ramadan_hampers"], isActive: true });
    expect(mocks.createSeasonalRecipeCollection).toHaveBeenCalledWith(expect.objectContaining({ slug: "hampers-ramadan", recipeIds: ["ramadan_hampers"] }));
    await expect(appRouter.createCaller(context("user")).admin.createSeasonalCollection({ slug: "hampers-ramadan", name: "Hampers Ramadan", season: "ramadan", description: "Pilihan hamper yang rapi untuk katalog promosi toko.", recipeIds: ["ramadan_hampers"], isActive: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("menolak jadwal koleksi dengan waktu akhir sebelum waktu mulai", async () => {
    const admin = appRouter.createCaller(context("admin"));
    await expect(admin.admin.createSeasonalCollection({ slug: "promo-terbatas", name: "Promo Terbatas", season: "lebaran", description: "Koleksi promosi Lebaran yang hanya tampil pada rentang tertentu.", recipeIds: ["lebaran_promo"], isActive: true, startsAt: new Date("2026-04-01T09:00:00Z"), endsAt: new Date("2026-04-01T08:00:00Z") })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createSeasonalRecipeCollection).not.toHaveBeenCalledWith(expect.objectContaining({ slug: "promo-terbatas" }));
  });
});
