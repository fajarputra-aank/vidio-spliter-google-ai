export type RecipeCollectionFilter = "all" | "favorites" | "ramadan" | "lebaran" | `collection:${string}`;
export type RecipeSort = "curated" | "frequent" | "popular";
export type RecipeGoal = "Semua tujuan" | "Profil & orang" | "Jualan & produk" | "Konten & sosial" | "Ruang & usaha" | "Perbaikan" | "Kreatif";
export type RecipePresetStyle = "editorial" | "realistic" | "anime" | "cinematic" | "vintage" | "pastel" | "minimal" | "monochrome" | "neon" | "watercolor" | "clean" | "luxury" | "soft_light" | "vibrant" | "matte";
export type RecipePreset = { style: RecipePresetStyle; aspect: "1:1" | "16:9" | "9:16"; label: string };

export const recipeGoals: RecipeGoal[] = ["Semua tujuan", "Profil & orang", "Jualan & produk", "Konten & sosial", "Ruang & usaha", "Perbaikan", "Kreatif"];

const goalByCategory: Record<string, Exclude<RecipeGoal, "Semua tujuan">> = {
  Potret: "Profil & orang", Produk: "Jualan & produk", Makanan: "Jualan & produk", Fashion: "Jualan & produk", Musiman: "Jualan & produk",
  Sosial: "Konten & sosial", Ruang: "Ruang & usaha", Restorasi: "Perbaikan", Dokumen: "Perbaikan", Kreatif: "Kreatif",
};

export const recipePresets: Record<string, RecipePreset> = {
  headshot: { style: "soft_light", aspect: "1:1", label: "profil lembut" }, personal_brand: { style: "editorial", aspect: "1:1", label: "personal brand" }, couple_portrait: { style: "soft_light", aspect: "1:1", label: "potret pasangan" },
  product_white: { style: "clean", aspect: "1:1", label: "etalase e-commerce" }, product: { style: "luxury", aspect: "1:1", label: "produk premium" }, marketplace: { style: "clean", aspect: "1:1", label: "marketplace terang" },
  coffee: { style: "matte", aspect: "1:1", label: "kafe hangat" }, reels_cover: { style: "vibrant", aspect: "9:16", label: "cover vertikal" }, thumbnail_clean: { style: "vibrant", aspect: "16:9", label: "cover konten" },
  listing: { style: "clean", aspect: "16:9", label: "listing properti" }, hotel_room: { style: "soft_light", aspect: "16:9", label: "hospitalitas terang" }, document: { style: "clean", aspect: "1:1", label: "dokumen presisi" },
  receipt_clean: { style: "clean", aspect: "1:1", label: "bukti transaksi" }, night: { style: "cinematic", aspect: "1:1", label: "malam sinematik" }, color_pop: { style: "vibrant", aspect: "1:1", label: "warna modern" }, comic_ink: { style: "anime", aspect: "1:1", label: "ilustrasi tinta" },
};

export type RecipeCatalogItem = {
  id: string;
  name: string;
  category: string;
  label: string;
  description: string;
  season?: "ramadan" | "lebaran";
};

const normalized = (value: string) => value.trim().toLocaleLowerCase("id-ID");

export function filterRecipeCatalog<T extends RecipeCatalogItem>(recipes: T[], options: { query: string; category: string; collection: RecipeCollectionFilter; favoriteIds: Set<string>; collectionRecipeIds?: Map<string, Set<string>> }) {
  const query = normalized(options.query);
  return recipes.filter((recipe) => {
    if (options.category !== "Semua" && recipe.category !== options.category) return false;
    if (options.collection === "favorites" && !options.favoriteIds.has(recipe.id)) return false;
    if ((options.collection === "ramadan" || options.collection === "lebaran") && recipe.season !== options.collection) return false;
    if (options.collection.startsWith("collection:") && !options.collectionRecipeIds?.get(options.collection)?.has(recipe.id)) return false;
    if (!query) return true;
    return normalized(`${recipe.name} ${recipe.category} ${recipe.label} ${recipe.description}`).includes(query);
  });
}

export function filterRecipeGoal<T extends RecipeCatalogItem>(recipes: T[], goal: RecipeGoal) {
  return goal === "Semua tujuan" ? recipes : recipes.filter((recipe) => goalByCategory[recipe.category] === goal);
}

function usageMap(rows: Array<{ recipeId: string; uses: number }>) {
  return new Map(rows.map((row) => [row.recipeId, row.uses]));
}

export function sortRecipeCatalog<T extends RecipeCatalogItem>(recipes: T[], sort: RecipeSort, usage: Array<{ recipeId: string; uses: number }>) {
  if (sort === "curated") return recipes;
  const ranks = usageMap(usage);
  return recipes.map((recipe, index) => ({ recipe, index })).sort((a, b) => (ranks.get(b.recipe.id) ?? 0) - (ranks.get(a.recipe.id) ?? 0) || a.index - b.index).map(({ recipe }) => recipe);
}

export function recommendPersonalRecipes<T extends RecipeCatalogItem>(recipes: T[], favoriteIds: Set<string>, personalUsage: Array<{ recipeId: string; uses: number }>, popularity: Array<{ recipeId: string; uses: number }>, limit = 3) {
  if (!favoriteIds.size) return [] as Array<{ recipe: T; reason: string }>;
  const favorites = recipes.filter((recipe) => favoriteIds.has(recipe.id));
  const favoriteCategories = new Set(favorites.map((recipe) => recipe.category));
  const favoriteSeasons = new Set(favorites.map((recipe) => recipe.season).filter(Boolean));
  const personalRanks = usageMap(personalUsage);
  const popularRanks = usageMap(popularity);
  return recipes.filter((recipe) => !favoriteIds.has(recipe.id)).map((recipe, index) => {
    const sameCategory = favoriteCategories.has(recipe.category);
    const sameSeason = recipe.season ? favoriteSeasons.has(recipe.season) : false;
    const seasonalAffinity = recipe.category === "Musiman" && favoriteCategories.has("Musiman");
    const score = (sameCategory ? 100 : 0) + (sameSeason ? 40 : 0) + (seasonalAffinity ? 20 : 0) + Math.min(personalRanks.get(recipe.id) ?? 0, 20) * 2 + Math.min(popularRanks.get(recipe.id) ?? 0, 20);
    const reason = sameSeason || seasonalAffinity ? "Selaras dengan favorit musimanmu." : sameCategory ? "Selaras dengan kategori resep favoritmu." : "Pelengkap dari kebiasaan meracikmu.";
    return { recipe, reason, score, index };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map(({ recipe, reason }) => ({ recipe, reason }));
}
