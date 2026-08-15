/**
 * Design reminder — Kamar Gelap Editorial: prompts keep the original subject
 * believable while translating it into a restrained, commercial photo direction.
 */
export const recipeIds = ["headshot", "product", "food", "social"] as const;

export type RecipeId = (typeof recipeIds)[number];

export const photoRecipes: Record<RecipeId, { title: string; prompt: string }> = {
  headshot: {
    title: "Headshot rapi",
    prompt: "Transform this into a polished professional editorial headshot. Preserve the person's exact identity, facial features, age, skin tone, hairstyle, pose, and clothing. Use soft sculpted studio lighting, a warm ivory or muted charcoal background, clean natural color, realistic skin texture, and premium Indonesian business editorial photography. Do not add text, logos, extra people, distorted anatomy, or artificial beauty-filter skin.",
  },
  product: {
    title: "Produk katalog",
    prompt: "Transform this into a refined commercial product catalog photograph. Preserve the product's exact shape, materials, labels, colors, dimensions, and branding. Use a warm ivory studio surface, soft directional light, controlled charcoal shadow, premium editorial styling, and a clean composition with generous negative space. Do not add text, new labels, logos, people, or duplicate products. Do not invent product features or alter any readable label.",
  },
  food: {
    title: "Menu menggoda",
    prompt: "Transform this food photograph into a premium modern restaurant campaign image. Preserve the dish, ingredients, plating, tableware, and serving size faithfully. Enhance natural appetite appeal with warm window light, rich but realistic color, refined charcoal shadows, and a clear editorial composition. Do not add text, logos, hands, extra dishes, impossible ingredients, or plastic-looking food.",
  },
  social: {
    title: "Konten sosial",
    prompt: "Transform this into a clean, high-impact social media editorial image. Preserve the central subject, identity, objects, and composition faithfully. Use lively but natural color, crisp contrast, warm paper-like light, and a premium creative-studio finish with uncluttered negative space. Do not add text, captions, logos, extra limbs, extra people, or unrelated objects.",
  },
};

export function buildTransformPrompt(recipeId: RecipeId) {
  return photoRecipes[recipeId].prompt;
}
