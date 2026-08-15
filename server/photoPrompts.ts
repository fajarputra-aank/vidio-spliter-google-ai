/**
 * Kamar Gelap Editorial: each prompt directs a transformation while preserving
 * the uploaded subject, product, labels, and documented scene.
 */
export const recipeIds = ["headshot", "beauty", "background", "product", "food", "social", "fashion", "interior", "light", "restore", "detail", "travel", "night", "sketch"] as const;
export const aspectRatioIds = ["1:1", "16:9", "9:16"] as const;
export const styleIds = ["editorial", "realistic", "anime", "cinematic", "vintage", "pastel", "minimal", "monochrome", "neon", "watercolor"] as const;

export type RecipeId = (typeof recipeIds)[number];
export type AspectRatioId = (typeof aspectRatioIds)[number];
export type StyleId = (typeof styleIds)[number];

export const photoRecipes: Record<RecipeId, { title: string; prompt: string }> = {
  headshot: { title: "Headshot rapi", prompt: "Transform this into a polished professional editorial headshot. Preserve the person's exact identity, facial features, age, skin tone, hairstyle, pose, and clothing. Use soft sculpted studio lighting, a warm ivory or muted charcoal background, clean natural color, realistic skin texture, and premium Indonesian business editorial photography. Do not add text, logos, extra people, distorted anatomy, or artificial beauty-filter skin." },
  beauty: { title: "Retouch natural", prompt: "Refine this portrait with a natural editorial retouch. Preserve the person's exact identity, age, facial structure, skin tone, hairstyle, expression, pose, and clothing. Balance uneven light, reduce temporary distractions subtly, retain real skin texture, and keep an honest human appearance. Do not add text, logos, artificial skin, extra people, altered facial features, changed body shape, or altered anatomy." },
  background: { title: "Latar studio bersih", prompt: "Create a clean premium studio-background version of this image. Preserve the exact main person or product, identity, pose, object shape, labels, colors, clothing, and framing. Replace only distracting surroundings with a believable warm ivory, soft gray, or charcoal editorial studio background and natural grounded shadow. Do not add text, logos, extra objects, people, duplicate products, or altered labels." },
  product: { title: "Produk katalog", prompt: "Transform this into a refined commercial product catalog photograph. Preserve the product's exact shape, materials, labels, colors, dimensions, and branding. Use a warm ivory studio surface, soft directional light, controlled charcoal shadow, premium editorial styling, and a clean composition with generous negative space. Do not add text, new labels, logos, people, duplicate products, or invented product features." },
  food: { title: "Menu menggoda", prompt: "Transform this food photograph into a premium modern restaurant campaign image. Preserve the dish, ingredients, plating, tableware, and serving size faithfully. Enhance natural appetite appeal with warm window light, rich but realistic color, refined charcoal shadows, and a clear editorial composition. Do not add text, logos, hands, extra dishes, impossible ingredients, or plastic-looking food." },
  social: { title: "Konten sosial", prompt: "Transform this into a clean, high-impact social media editorial image. Preserve the central subject, identity, objects, and composition faithfully. Use lively but natural color, crisp contrast, warm paper-like light, and a premium creative-studio finish with uncluttered negative space. Do not add text, captions, logos, extra limbs, extra people, or unrelated objects." },
  fashion: { title: "Kampanye fashion", prompt: "Transform this into a refined fashion campaign photograph. Preserve the person's exact identity, body proportions, outfit, accessories, pose, and skin tone. Use intentional editorial styling, a controlled studio or architectural setting, premium garment texture, and a confident full-length or half-length composition. Do not add text, logos, altered garment design, duplicate limbs, or unrelated people." },
  interior: { title: "Ruang & properti", prompt: "Transform this interior or property image into a bright architectural editorial photograph. Preserve the room layout, dimensions, furniture, materials, fixtures, windows, and perspective faithfully. Use balanced daylight, straight vertical lines, realistic textures, and a calm premium magazine finish. Do not add text, rooms, furniture, people, or impossible architectural features." },
  light: { title: "Cahaya seimbang", prompt: "Correct and enhance the exposure of this photograph with balanced natural light. Preserve the exact subject, identity, objects, colors, composition, material detail, and atmosphere. Recover believable highlight and shadow detail, neutralize unwanted color casts, and create a clean premium editorial finish. Do not add text, logos, people, objects, invented details, or change the documented time of day." },
  restore: { title: "Pulihkan foto", prompt: "Restore and enhance this photograph. Preserve its exact subject, identity, composition, and historical character. Carefully reduce scratches, haze, color casts, and softness while retaining authentic texture and believable detail. Do not add text, missing people, logos, clothing, objects, or facial features that were not visible." },
  detail: { title: "Detail lebih tajam", prompt: "Enhance this photograph with carefully improved clarity, texture, and perceived detail. Preserve its exact subject, identity, composition, labels, colors, and original character. Reduce mild blur and noise naturally, retain realistic grain where appropriate, and avoid over-sharpened edges. Do not add text, missing objects, faces, logos, features, or altered readable labels." },
  travel: { title: "Perjalanan berkesan", prompt: "Transform this travel or outdoor photograph into a refined destination editorial image. Preserve the exact people, landmarks, landscape, weather cues, architecture, objects, and original composition. Use balanced natural atmosphere, clear depth, elegant color, and believable local light. Do not add text, landmarks, people, logos, impossible scenery, or change the documented location." },
  night: { title: "Malam sinematik", prompt: "Transform this image into a cinematic night editorial photograph. Preserve the main subject, identity, objects, and original composition. Use realistic low-light exposure, rich but controlled shadows, practical ambient light, and refined color contrast. Do not add text, logos, extra people, duplicated objects, or fantasy elements." },
  sketch: { title: "Sketsa editorial", prompt: "Transform this into an original editorial sketch illustration. Preserve the exact main subject, identity, pose, objects, composition, and readable labels. Use refined hand-drawn linework, restrained paper texture, and a contemporary original visual language. Do not add text, logos, people, objects, altered anatomy, unrelated scenery, or imitate a named artist or studio." },
};

const aspectDirections: Record<AspectRatioId, string> = {
  "1:1": "Compose the final image in a balanced 1:1 square format, with the important subject fully visible and comfortable edge space.",
  "16:9": "Compose the final image in a cinematic 16:9 horizontal format, maintaining the important subject fully in frame with considered editorial negative space.",
  "9:16": "Compose the final image in a vertical 9:16 format for mobile social stories, keeping the important subject fully visible through the central safe area.",
};

const styleDirections: Record<StyleId, string> = {
  editorial: "Use a refined warm editorial-photo finish with controlled natural color and tactile film-like depth.",
  realistic: "Use faithful photorealism with natural texture, physically plausible light, accurate material detail, and no illustrative simplification.",
  anime: "Use an original polished anime illustration with clean linework, expressive yet faithful proportions, cinematic cel shading, and an original visual language. Do not imitate a named artist or studio.",
  cinematic: "Use a cinematic photo grade with deliberate contrast, deep dimensional shadows, graceful highlights, and filmic color separation while retaining photorealism.",
  vintage: "Use a tasteful analog print character with restrained grain, faded warm tones, tactile paper texture, and believable archival color without damaging the subject.",
  pastel: "Use a soft pastel color treatment with airy light, gentle contrast, and clean contemporary commercial styling while preserving natural detail.",
  minimal: "Use a minimal high-key art direction with uncluttered negative space, restrained color, clear subject separation, and a polished commercial finish.",
  monochrome: "Use a high-contrast black-and-white editorial treatment with nuanced grayscale, preserved texture, and no artificial color accents.",
  neon: "Use a controlled contemporary neon-night color grade with physically plausible practical light, clean contrast, and retained photorealism.",
  watercolor: "Use an original contemporary watercolor illustration with faithful forms, transparent pigment texture, and no imitation of a named artist.",
};

export function buildTransformPrompt(recipeId: RecipeId, aspectRatio: AspectRatioId = "1:1", style: StyleId = "editorial", customInstruction?: string) {
  const instruction = customInstruction?.trim().replace(/[\u0000-\u001F]+/g, " ").slice(0, 360);
  const direction = instruction ? `Optional user direction, apply only when compatible with the preservation rules: ${instruction}` : "";
  const guard = "Non-negotiable: preserve the original main subject, identity, composition, and readable labels. Do not add text, logos, extra people, duplicate objects, or unrelated details.";
  return `${photoRecipes[recipeId].prompt} ${styleDirections[style]} ${aspectDirections[aspectRatio]} ${direction} ${guard}`.trim();
}
