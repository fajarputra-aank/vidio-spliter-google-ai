import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ listPhotoPromptFavorites: vi.fn(), createPhotoPromptFavorite: vi.fn(), deletePhotoPromptFavorite: vi.fn() }));
vi.mock("./db", () => ({ listPhotoPromptFavorites: mocks.listPhotoPromptFavorites, createPhotoPromptFavorite: mocks.createPhotoPromptFavorite, deletePhotoPromptFavorite: mocks.deletePhotoPromptFavorite }));
import { appRouter } from "./routers";

function ownerContext(): TrpcContext {
  return { user: { id: 91, openId: "prompt-owner", name: "Prompt Owner", email: "prompt@example.test", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("private prompt favorites", () => {
  it("always scopes list, create, and delete operations to the signed-in owner", async () => {
    mocks.listPhotoPromptFavorites.mockResolvedValue([]);
    mocks.createPhotoPromptFavorite.mockResolvedValue({ id: 3, userId: 91, instruction: "Pertahankan cahaya hangat.", createdAt: new Date() });
    mocks.deletePhotoPromptFavorite.mockResolvedValue({ success: true });
    const caller = appRouter.createCaller(ownerContext());

    await caller.promptFavorites.list();
    await caller.promptFavorites.create({ instruction: "Pertahankan cahaya hangat." });
    await caller.promptFavorites.delete({ favoriteId: 3 });

    expect(mocks.listPhotoPromptFavorites).toHaveBeenCalledWith(91);
    expect(mocks.createPhotoPromptFavorite).toHaveBeenCalledWith(91, "Pertahankan cahaya hangat.");
    expect(mocks.deletePhotoPromptFavorite).toHaveBeenCalledWith(91, 3);
  });
});
