import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ listPhotoRecipeFavorites: vi.fn(), createPhotoRecipeFavorite: vi.fn(), deletePhotoRecipeFavorite: vi.fn() }));
vi.mock("./db", () => ({ listPhotoRecipeFavorites: mocks.listPhotoRecipeFavorites, createPhotoRecipeFavorite: mocks.createPhotoRecipeFavorite, deletePhotoRecipeFavorite: mocks.deletePhotoRecipeFavorite }));

import { appRouter } from "./routers";

function ownerContext(): TrpcContext {
  return { user: { id: 118, openId: "recipe-owner", name: "Recipe Owner", email: "recipe@example.test", loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("favorit resep", () => {
  it("mencakup daftar, simpan, dan hapus yang semuanya dibatasi pemilik", async () => {
    mocks.listPhotoRecipeFavorites.mockResolvedValue([]);
    mocks.createPhotoRecipeFavorite.mockResolvedValue({ id: 8, userId: 118, recipeId: "ramadan_hampers", createdAt: new Date() });
    mocks.deletePhotoRecipeFavorite.mockResolvedValue({ success: true });
    const caller = appRouter.createCaller(ownerContext());

    await caller.recipeFavorites.list();
    await caller.recipeFavorites.create({ recipeId: "ramadan_hampers" });
    await caller.recipeFavorites.delete({ recipeId: "ramadan_hampers" });

    expect(mocks.listPhotoRecipeFavorites).toHaveBeenCalledWith(118);
    expect(mocks.createPhotoRecipeFavorite).toHaveBeenCalledWith(118, "ramadan_hampers");
    expect(mocks.deletePhotoRecipeFavorite).toHaveBeenCalledWith(118, "ramadan_hampers");
  });
});
