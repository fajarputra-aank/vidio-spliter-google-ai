import { generateImage } from "./_core/imageGeneration";
import * as db from "./db";
import { storageGetSignedUrl } from "./storage";
import { aiQuotaRetryAt, toSafeTransformFailure } from "./transformFailureMessages";

const templateIds = ["free", "couple", "product"] as const;
const ratioIds = ["1:1", "16:9", "9:16"] as const;
const styleIds = ["editorial", "realistic", "cinematic"] as const;

function mimeTypeFromKey(key: string) { return key.toLowerCase().endsWith(".png") ? "image/png" : key.toLowerCase().endsWith(".webp") ? "image/webp" : "image/jpeg"; }
function safeValue<T extends readonly string[]>(value: string | null, allowed: T, fallback: T[number]) { return allowed.includes(value as T[number]) ? value as T[number] : fallback; }
function recoveryPrompt(template: (typeof templateIds)[number], ratio: (typeof ratioIds)[number], style: (typeof styleIds)[number], customInstruction?: string | null) {
  const direction = template === "couple" ? "Create a respectful paired portrait with natural spacing." : template === "product" ? "Create a truthful commercial composition showing both supplied products and labels." : "Create a coherent collaboration composition.";
  return `${direction} Use exactly the two supplied private photos. Produce ONE unified single full-frame final photo in one shared physical scene; never render a diptych, split screen, panels, collage, borders, or separate frames. Identity preservation is non-negotiable: preserve each face, skin tone, hairstyle, age, body, clothing, product, and label exactly. Do not face-swap, blend faces, morph identities, beautify faces, change age, or invent people, products, text, logos, claims, or unrelated props. Keep compatible original environments and compose for ${ratio} in ${style} direction. ${customInstruction ? `Apply this private direction only when compatible with these preservation rules: ${customInstruction}` : ""}`;
}

export async function runCollaborationProviderRecoverySweep(now = new Date()) {
  const due = await db.listDueCollaborationProviderRetries(now);
  let completed = 0; let deferred = 0; let skipped = 0;
  for (const queued of due) {
    if (!(await db.claimCollaborationProviderRetry(queued.id))) { skipped++; continue; }
    const source = await db.getOwnedPhotoTransform(queued.userId, queued.sourceTransformId);
    if (!source || source.recipe !== "collaboration" || source.status !== "failed" || !source.sourceKey || !source.secondarySourceKey) { await db.finishCollaborationProviderRetry(queued.id, null); skipped++; continue; }
    const template = safeValue(source.collaborationTemplate, templateIds, "free");
    const aspectRatio = safeValue(source.aspectRatio, ratioIds, "1:1");
    const style = safeValue(source.style, styleIds, "editorial");
    let retryId: number | null = null;
    try {
      const [firstUrl, secondUrl] = await Promise.all([storageGetSignedUrl(source.sourceKey), storageGetSignedUrl(source.secondarySourceKey)]);
      const processing = await db.getProcessingQueueStatus();
      const retry = await db.createPhotoTransform({ userId: source.userId, recipe: "collaboration", aspectRatio, style, title: "Kolaborasi dua foto · pemulihan antrean", sourceKey: source.sourceKey, sourceUrl: source.sourceUrl, secondarySourceKey: source.secondarySourceKey, secondarySourceUrl: source.secondarySourceUrl, collaborationTemplate: template, collaborationInviteId: null, collaborationLayout: source.collaborationLayout, retryOfTransformId: source.id, retryInstruction: source.retryInstruction, queuePosition: processing.position, status: "processing" });
      retryId = retry.id;
      const result = await generateImage({ prompt: recoveryPrompt(template, aspectRatio, style, source.retryInstruction), originalImages: [{ url: firstUrl, mimeType: mimeTypeFromKey(source.sourceKey) }, { url: secondUrl, mimeType: mimeTypeFromKey(source.secondarySourceKey) }], quality: "high" });
      if (!result.url) throw new Error("Layanan AI tidak mengembalikan gambar hasil.");
      await db.recordAiProviderCapacityStatus("available");
      await db.completePhotoTransform(retry.id, result.url);
      await db.createAccountActivityNotification(source.userId, "Kapasitas AI pulih · Kolaborasi diproses", "Kapasitas penyedia AI kembali tersedia. Satu Kolaborasi dari antrean pemulihan sudah selesai dan tetap privat.");
      await db.finishCollaborationProviderRetry(queued.id, retry.id, true);
      completed++;
    } catch (error) {
      const failure = toSafeTransformFailure(error);
      if (retryId) await db.failPhotoTransform(retryId, failure.message);
      if (failure.code === "AI_QUOTA_EXHAUSTED") {
        const retryAt = aiQuotaRetryAt(now);
        await db.recordAiProviderCapacityStatus("unavailable", retryAt);
        await db.deferCollaborationProviderRetry(queued.id, retryAt);
        deferred++;
        break;
      }
      await db.finishCollaborationProviderRetry(queued.id, retryId);
      skipped++;
    }
  }
  return { checked: due.length, completed, deferred, skipped };
}
