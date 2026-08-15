export const remixRecipeIds = ["headshot", "product", "food", "social", "fashion", "interior", "restore", "night"] as const;
export const remixStyleIds = ["editorial", "realistic", "anime", "cinematic", "vintage", "pastel", "minimal"] as const;
export const remixAspectIds = ["1:1", "16:9", "9:16"] as const;

export type RemixRecipeId = (typeof remixRecipeIds)[number];
export type RemixStyleId = (typeof remixStyleIds)[number];
export type RemixAspectId = (typeof remixAspectIds)[number];
export type RemixPreset = { recipe: RemixRecipeId; style: RemixStyleId; aspect: RemixAspectId };

function includes<T extends readonly string[]>(values: T, value: string | null): value is T[number] {
  return Boolean(value && values.includes(value));
}

/** Extracts only an allow-listed visual preset. URLs never carry source or result images. */
export function readRemixPreset(search: string): RemixPreset | null {
  const params = new URLSearchParams(search);
  const recipe = params.get("remixRecipe");
  const style = params.get("remixStyle");
  const aspect = params.get("remixAspect");
  if (!includes(remixRecipeIds, recipe) || !includes(remixStyleIds, style) || !includes(remixAspectIds, aspect)) return null;
  return { recipe, style, aspect };
}
