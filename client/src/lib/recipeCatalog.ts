export type RecipeCollectionFilter = "all" | "favorites" | "ramadan" | "lebaran";

export type RecipeCatalogItem = {
  id: string;
  name: string;
  category: string;
  label: string;
  description: string;
  season?: "ramadan" | "lebaran";
};

const normalized = (value: string) => value.trim().toLocaleLowerCase("id-ID");

export function filterRecipeCatalog<T extends RecipeCatalogItem>(recipes: T[], options: { query: string; category: string; collection: RecipeCollectionFilter; favoriteIds: Set<string> }) {
  const query = normalized(options.query);
  return recipes.filter((recipe) => {
    if (options.category !== "Semua" && recipe.category !== options.category) return false;
    if (options.collection === "favorites" && !options.favoriteIds.has(recipe.id)) return false;
    if ((options.collection === "ramadan" || options.collection === "lebaran") && recipe.season !== options.collection) return false;
    if (!query) return true;
    return normalized(`${recipe.name} ${recipe.category} ${recipe.label} ${recipe.description}`).includes(query);
  });
}
