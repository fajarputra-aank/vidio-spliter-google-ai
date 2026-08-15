/**
 * Design reminder — Kamar Gelap Editorial: prompts keep the original subject
 * believable while translating it into a restrained, commercial photo direction.
 */
export const recipeIds = ["headshot", "product", "food", "social", "fashion", "interior", "restore", "night"] as const;
export const aspectRatioIds = ["1:1", "16:9", "9:16"] as const;
export const styleIds = ["editorial", "realistic", "anime", "cinematic", "vintage", "pastel", "minimal"] as const;

export type RecipeId = (typeof recipeIds)[number];
export type AspectRatioId = (typeof aspectRatioIds)[number];
export type StyleId = (typeof styleIds)[number];

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
  fashion: {
    title: "Kampanye fashion",
    prompt: "Transform this into a refined fashion campaign photograph. Preserve the person's exact identity, body proportions, outfit, accessories, pose, and skin tone. Use intentional editorial styling, a controlled studio or architectural setting, premium garment texture, and a confident full-length or half-length composition. Do not change the person. Do not add text, logos, alter the garment design, duplicate limbs, or add unrelated people.",
  },
  interior: {
    title: "Ruang & properti",
    prompt: "Transform this interior or property image into a bright architectural editorial photograph. Preserve the room layout, dimensions, furniture, materials, fixtures, windows, and perspective faithfully. Use balanced daylight, straight vertical lines, realistic textures, and a calm premium magazine finish. Do not add text, rooms, furniture, people, or impossible architectural features.",
  },
  restore: {
    title: "Pulihkan foto",
    prompt: "Restore and enhance this photograph. Preserve its exact subject, identity, composition, and historical character. Carefully reduce scratches, haze, color casts, and softness while retaining authentic texture and believable detail. Do not add text or invent missing people, logos, clothing, objects, or facial features.",
  },
  night: {
    title: "Malam sinematik",
    prompt: "Transform this image into a cinematic night editorial photograph. Preserve the main subject, identity, objects, and original composition. Use realistic low-light exposure, rich but controlled shadows, practical ambient light, and refined color contrast. Do not add text, logos, extra people, duplicated objects, or fantasy elements.",
  },
};

const aspectDirections: Record<AspectRatioId, string> = {
  "1:1": "Compose the final image in a balanced 1:1 square format, with the important subject fully visible and comfortable edge space.",
  "16:9": "Compose the final image in a cinematic 16:9 horizontal format, maintaining the important subject fully in frame with considered editorial negative space.",
  "9:16": "Compose the final image in a vertical 9:16 format for mobile social stories, keeping the important subject fully visible through the central safe area.",
};

const styleDirections: Record<StyleId, string> = {
  editorial: "Use a refined warm editorial-photo finish with controlled natural color and tactile film-like depth.",
  realistic: "Use faithful photorealism with natural texture, physically plausible light, accurate material detail, and no illustrative simplification.",
  anime: "Render as an original polished anime illustration with clean linework, expressive yet faithful proportions, cinematic cel shading, and an original visual language. Do not imitate a named artist or studio.",
  cinematic: "Use a cinematic photo grade with deliberate contrast, deep dimensional shadows, graceful highlights, and filmic color separation while retaining photorealism.",
  vintage: "Use a tasteful analog print character with restrained grain, faded warm tones, tactile paper texture, and believable archival color without damaging the subject.",
  pastel: "Use a soft pastel color treatment with airy light, gentle contrast, and clean contemporary commercial styling while preserving natural detail.",
  minimal: "Use a minimal high-key art direction with uncluttered negative space, restrained color, clear subject separation, and a polished commercial finish.",
};

export function buildTransformPrompt(
  recipeId: RecipeId,
  aspectRatio: AspectRatioId = "1:1",
  style: StyleId = "editorial"
) {
  return `${photoRecipes[recipeId].prompt} ${styleDirections[style]} ${aspectDirections[aspectRatio]}`;
}
