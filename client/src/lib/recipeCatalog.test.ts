import { describe, expect, it } from "vitest";
import { filterRecipeCatalog, recommendPersonalRecipes, sortRecipeCatalog } from "./recipeCatalog";

const recipes = [
  { id: "product", name: "Produk katalog", category: "Produk", label: "Jualan", description: "Produk bersih untuk etalase." },
  { id: "ramadan_iftar", name: "Menu berbuka", category: "Musiman", label: "Ramadan", description: "Menu hangat saat berbuka.", season: "ramadan" as const },
  { id: "lebaran_promo", name: "Promo Lebaran", category: "Musiman", label: "Lebaran", description: "Produk hadiah dan promo toko.", season: "lebaran" as const },
];

describe("filter katalog resep", () => {
  it("menggabungkan pencarian kata kunci dan filter kategori", () => {
    expect(filterRecipeCatalog(recipes, { query: "etalase", category: "Produk", collection: "all", favoriteIds: new Set() }).map((item) => item.id)).toEqual(["product"]);
  });

  it("menampilkan koleksi musiman dan favorit secara privat di client", () => {
    expect(filterRecipeCatalog(recipes, { query: "", category: "Semua", collection: "ramadan", favoriteIds: new Set() }).map((item) => item.id)).toEqual(["ramadan_iftar"]);
    expect(filterRecipeCatalog(recipes, { query: "", category: "Semua", collection: "favorites", favoriteIds: new Set(["lebaran_promo"]) }).map((item) => item.id)).toEqual(["lebaran_promo"]);
  });

  it("mengurutkan penggunaan dan memfilter koleksi admin yang aktif", () => {
    expect(sortRecipeCatalog(recipes, "popular", [{ recipeId: "lebaran_promo", uses: 8 }, { recipeId: "product", uses: 2 }]).map((item) => item.id)).toEqual(["lebaran_promo", "product", "ramadan_iftar"]);
    expect(filterRecipeCatalog(recipes, { query: "", category: "Semua", collection: "collection:hampers", favoriteIds: new Set(), collectionRecipeIds: new Map([["collection:hampers", new Set(["lebaran_promo"])]] ) }).map((item) => item.id)).toEqual(["lebaran_promo"]);
  });

  it("memberi rekomendasi yang mengutamakan hubungan dengan favorit pengguna", () => {
    const result = recommendPersonalRecipes(recipes, new Set(["ramadan_iftar"]), [], [{ recipeId: "lebaran_promo", uses: 9 }]);
    expect(result[0]?.recipe.id).toBe("lebaran_promo");
    expect(result[0]?.reason).toContain("musiman");
  });
});
