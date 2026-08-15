export function selectAlternativeRecipe<T extends string>(currentRecipe: T, recommendedRecipes: T[], availableRecipes: T[]) {
  return recommendedRecipes.find((recipe) => recipe !== currentRecipe) ?? availableRecipes.find((recipe) => recipe !== currentRecipe) ?? null;
}
