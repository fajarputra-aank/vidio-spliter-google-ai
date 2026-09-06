export type RecipePreviewInput = {
  name: string;
  description: string;
  category: string;
  label: string;
  prompt: string;
};

export function recipePreviewAlt(recipe: Pick<RecipePreviewInput, "name">) {
  return `Contoh hasil ${recipe.name}`;
}

export function recipePreviewDisclaimer() {
  return "Gambar ini adalah contoh arah visual. Hasil akhir akan mengikuti foto sumber, gaya AI, dan rasio yang kamu pilih.";
}

export function recipePreviewMeta(recipe: Pick<RecipePreviewInput, "category" | "label">) {
  return `${recipe.category} · ${recipe.label}`;
}
