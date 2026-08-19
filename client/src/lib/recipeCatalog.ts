export type RecipeCollectionFilter = "all" | "favorites" | "ramadan" | "lebaran" | `collection:${string}`;
export type RecipeSort = "curated" | "frequent" | "popular";

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
