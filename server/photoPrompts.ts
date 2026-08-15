/**
 * Design reminder — Kamar Gelap Editorial: prompts keep the original subject
 * believable while translating it into a restrained, commercial photo direction.
 */
export const recipeIds = ["headshot", "product", "food", "social"] as const;
export const aspectRatioIds = ["1:1", "16:9", "9:16"] as const;

export type RecipeId = (typeof recipeIds)[number];
export type AspectRatioId = (typeof aspectRatioIds)[number];

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

const aspectDirections: Record<AspectRatioId, string> = {
  "1:1": "Compose the final image in a balanced 1:1 square format, with the important subject fully visible and comfortable edge space.",
  "16:9": "Compose the final image in a cinematic 16:9 horizontal format, maintaining the important subject fully in frame with considered editorial negative space.",
  "9:16": "Compose the final image in a vertical 9:16 format for mobile social stories, keeping the important subject fully visible through the central safe area.",
};

export function buildTransformPrompt(recipeId: RecipeId, aspectRatio: AspectRatioId = "1:1") {
  return `${photoRecipes[recipeId].prompt} ${aspectDirections[aspectRatio]}`;
}
