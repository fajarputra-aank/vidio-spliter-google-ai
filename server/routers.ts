import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { adminProcedure, protectedProcedure, publicProcedure, router, signedInProcedure } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import * as db from "./db";
import { aspectRatioIds, buildTransformPrompt, photoRecipes, recipeIds, styleIds } from "./photoPrompts";
import { storageGetSignedUrl, storagePut } from "./storage";
import { creditPacks, getCreditPack } from "./creditProducts";
import { hasUnlimitedHdExports, hasUnlimitedTransforms } from "./accessPolicy";
import { recommendPhotoRecipe } from "./photoRecommendations";
import { createSecurityToken, hashLoginEmail, hashPassword, hashSecurityToken, normalizeEmail, validatePassword, validateRegistrationInput, verifyPassword } from "./localAuth";
import { sdk } from "./_core/sdk";
import { issueAccountEmail, sendAccountLockedEmail, sendNewDeviceLoginEmail, sendPasswordChangedEmail, sendSecuritySummaryEmail } from "./accountEmails";
import { registerActiveSession } from "./sessionMetadata";
import { aiQuotaRetryAt, aiQuotaRetryEstimate, toSafeTransformFailure } from "./transformFailureMessages";
import { assessCollaborationFaceReadiness } from "./collaborationFaceReadiness";
import sharp from "sharp";

const imageInput = z.object({
  recipe: z.enum(recipeIds),
  aspectRatio: z.enum(aspectRatioIds),
  style: z.enum(styleIds),
  fileName: z.string().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sourceData: z.string().min(16).max(8_000_000),
  customInstruction: z.string().trim().min(3).max(360).optional(),
  retryOfTransformId: z.number().int().positive().optional(),
  requestId: z.string().uuid().optional(),
});

const collaborationImageInput = z.object({ fileName: z.string().min(1).max(180), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), sourceData: z.string().min(16).max(8_000_000) });
const collaborationBrandLogoInput = z.object({ name: z.string().trim().min(2).max(48), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), sourceData: z.string().min(16).max(4_000_000) });
const collaborationTemplateIds = ["free", "couple", "product"] as const;
const collaborationBackgroundIds = ["keep", "studio-ivory", "soft-gray", "charcoal", "cafe", "garden", "office"] as const;
const collaborationLayoutInput = z.object({ firstX: z.number().min(-80).max(80), firstY: z.number().min(-80).max(80), firstScale: z.number().min(0.6).max(1.4), secondX: z.number().min(-80).max(80), secondY: z.number().min(-80).max(80), secondScale: z.number().min(0.6).max(1.4) });
const collaborationInput = z.object({ first: collaborationImageInput, second: collaborationImageInput, template: z.enum(collaborationTemplateIds).default("free"), aspectRatio: z.enum(aspectRatioIds), style: z.enum(styleIds), background: z.enum(collaborationBackgroundIds).default("keep"), brandBackgroundPresetId: z.number().int().positive().optional(), customInstruction: z.string().trim().min(3).max(360).optional(), inviteId: z.number().int().positive().optional(), layout: collaborationLayoutInput.optional(), requestId: z.string().uuid().optional() });
const collaborationRetryInput = z.object({ transformId: z.number().int().positive(), background: z.enum(collaborationBackgroundIds).default("keep"), brandBackgroundPresetId: z.number().int().positive().optional(), customInstruction: z.string().trim().min(3).max(360).optional(), requestId: z.string().uuid().optional() });

const seasonalCollectionFields = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,48}$/),
  name: z.string().trim().min(3).max(80),
  season: z.enum(["ramadan", "lebaran"]),
  description: z.string().trim().min(10).max(240),
  recipeIds: z.array(z.string().trim().min(1).max(64)).min(1).max(20),
  isActive: z.boolean().default(true),
  startsAt: z.date().nullable().optional().default(null),
  endsAt: z.date().nullable().optional().default(null),
});

const seasonalCollectionInput = seasonalCollectionFields.superRefine((input, ctx) => {
  input.recipeIds.forEach((recipeId, index) => {
    if (!recipeIds.includes(recipeId as (typeof recipeIds)[number])) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recipeIds", index], message: "Resep tidak termasuk katalog tervalidasi." });
  });
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "Tanggal berakhir harus setelah tanggal mulai." });
});

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120) || "photo";
}

function privateMediaUrl(value: string | null) {
  if (!value?.startsWith("/manus-storage/")) return value;
  return `/api/media/private/${encodeURIComponent(value.slice("/manus-storage/".length))}`;
}

async function storeCollaborationBrandLogo(userId: number, input: z.infer<typeof collaborationBrandLogoInput>) {
  const bytes = Buffer.from(input.sourceData, "base64");
  if (!bytes.length || bytes.length > 2_500_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Logo watermark maksimal 2,5 MB." });
  const normalized = await sharp(bytes, { failOn: "error" }).resize(640, 640, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const stored = await storagePut(`collaboration-brand-logos/${userId}/${Date.now()}-${safeFileName(input.name)}.png`, normalized, "image/png");
  return stored.key;
}

function withPrivatePhotoMedia<T extends { sourceUrl: string; secondarySourceUrl?: string | null; resultUrl: string | null; errorMessage?: string | null }>(record: T) {
  const errorMessage = record.errorMessage && !record.errorMessage.startsWith("Layanan AI sedang") && !record.errorMessage.startsWith("Transformasi belum berhasil")
    ? toSafeTransformFailure(new Error(record.errorMessage)).message
    : record.errorMessage;
  return { ...record, errorMessage, sourceUrl: privateMediaUrl(record.sourceUrl)!, secondarySourceUrl: privateMediaUrl(record.secondarySourceUrl ?? null), resultUrl: privateMediaUrl(record.resultUrl) };
}

function collaborationBackgroundDirection(background: (typeof collaborationBackgroundIds)[number]) {
  const directions: Record<(typeof collaborationBackgroundIds)[number], string> = { keep: "Retain the original environments where they are compatible with the merged composition.", "studio-ivory": "Replace only the background with a clean warm ivory editorial studio, using a natural grounded shadow.", "soft-gray": "Replace only the background with a calm soft-gray studio backdrop, with believable depth and grounded shadows.", charcoal: "Replace only the background with a refined charcoal editorial backdrop, preserving natural edge detail and realistic contact shadows.", cafe: "Replace only the background with a quiet warm café interior, without adding people, signs, readable text, logos, or props near the subjects.", garden: "Replace only the background with a soft natural garden setting, with realistic depth and no additional people or invented objects.", office: "Replace only the background with a clean understated office setting, without readable text, logos, screens, or added people." };
  return directions[background];
}

function buildCollaborationPrompt(template: (typeof collaborationTemplateIds)[number], aspectRatio: (typeof aspectRatioIds)[number], style: (typeof styleIds)[number], background: (typeof collaborationBackgroundIds)[number], customInstruction?: string, layout?: z.infer<typeof collaborationLayoutInput>) {
  const direction = template === "couple" ? "Create a warm, natural paired portrait with respectful physical spacing and no invented intimacy." : template === "product" ? "Create a clean commercial composition that shows both supplied products truthfully with consistent scale and clear labels." : "Create a flexible, coherent collaboration composition.";
  return `${direction} Use exactly the two supplied private photos. Produce ONE unified single full-frame final photo in one shared physical scene: both supplied subjects must appear naturally together in the same photograph, with coherent shared light, scale, shadow, perspective, and visual world. Never render a diptych, split screen, side-by-side panels, collage, contact sheet, before/after comparison, borders, separate frames, or two isolated scenes. Identity preservation is non-negotiable and has higher priority than style, background, composition, layout, or custom direction. Treat every visible person in each source as an immutable identity reference, not inspiration: preserve their exact facial geometry and proportions, skin tone and texture, eye shape and color, eyebrows, nose, mouth, jawline, hairline, hairstyle, age, expression, body proportions, and clothing. Do not face-swap, blend faces, morph identities, beautify or retouch facial features, change age, ethnicity, gender presentation, hairstyle, skin tone, or create a different face. Preserve both products, labels, and essential visual details truthfully. Place both contributions naturally into one believable shared composition. ${collaborationBackgroundDirection(background)} Change only the background; do not alter the main subjects, their faces, bodies, clothing, or products. Do not introduce additional people, duplicate subjects, invented products, text, logos, claims, or unrelated props. Keep the visual direction ${style} and compose for ${aspectRatio}. ${layout ? `Use this approximate private layout guidance to place the two subjects within the same single scene: first source x ${layout.firstX}, y ${layout.firstY}, scale ${layout.firstScale}; second source x ${layout.secondX}, y ${layout.secondY}, scale ${layout.secondScale}.` : ""} ${customInstruction ? `Apply this private direction only if it does not conflict with the single-photo, immutable identity, subject, and face-preservation rules: ${customInstruction}` : ""}`;
}

function collaborationMimeTypeFromKey(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function parseStoredCollaborationLayout(value: string | null) {
  if (!value) return undefined;
  try { const parsed = collaborationLayoutInput.safeParse(JSON.parse(value)); return parsed.success ? parsed.data : undefined; }
  catch { return undefined; }
}

async function resolveCollaborationBackground(role: "admin" | "user", fallback: (typeof collaborationBackgroundIds)[number], brandBackgroundPresetId?: number) {
  if (!brandBackgroundPresetId) return fallback;
  if (role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Preset latar brand hanya tersedia untuk administrator." });
  const preset = await db.getActiveCollaborationBrandBackgroundPreset(brandBackgroundPresetId);
  if (!preset) throw new TRPCError({ code: "BAD_REQUEST", message: "Preset latar brand tidak tersedia atau tidak aktif." });
  return preset.background as Exclude<(typeof collaborationBackgroundIds)[number], "keep">;
}

function withPrivateAlbumMedia<T extends { coverUrl: string | null; items: Array<{ resultUrl: string | null }> }>(album: T) {
  return { ...album, coverUrl: privateMediaUrl(album.coverUrl), items: album.items.map((item) => ({ ...item, resultUrl: privateMediaUrl(item.resultUrl) })) };
}

const brandImageInput = z.object({ mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), sourceData: z.string().min(16).max(5_000_000) });
const transferProofInput = z.object({ mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), sourceData: z.string().min(16).max(7_000_000) });

async function storeBrandImage(kind: "logo" | "icon", image: z.infer<typeof brandImageInput>) {
  const bytes = Buffer.from(image.sourceData, "base64");
  if (!bytes.length || bytes.length > 3_500_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Berkas brand harus berupa gambar maksimal 3 MB." });
  const extension = image.mimeType === "image/png" ? "png" : image.mimeType === "image/webp" ? "webp" : "jpg";
  const stored = await storagePut(`brand/${kind}-${Date.now()}.${extension}`, bytes, image.mimeType);
  return stored.url;
}

async function storeTransferProof(userId: number, image: z.infer<typeof transferProofInput>) {
  const bytes = Buffer.from(image.sourceData, "base64");
  if (!bytes.length || bytes.length > 5_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Bukti transfer harus berupa gambar maksimal 5 MB." });
  const extension = image.mimeType === "image/png" ? "png" : image.mimeType === "image/webp" ? "webp" : "jpg";
  const stored = await storagePut(`payment-proofs/${userId}/${Date.now()}.${extension}`, bytes, image.mimeType);
  return stored.url;
}

const activeTransformAborters = new Map<string, AbortController>();

function activeTransformKey(userId: number, requestId: string) {
  return `${userId}:${requestId}`;
}

function isTemporaryProviderFailure(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return false;
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|timeout|timed out|temporar|service unavailable|\b502\b|\b503\b|\b504\b/i.test(message);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    register: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().min(3).max(320), password: z.string().min(12).max(128) })).mutation(async ({ ctx, input }) => {
      let details: { name: string; email: string };
      try { details = validateRegistrationInput(input.name, input.email, input.password); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Data pendaftaran belum valid." }); }
      const user = await db.createLocalUser({ ...details, passwordHash: await hashPassword(input.password) });
      if (!user) throw new TRPCError({ code: "CONFLICT", message: "Email ini sudah terdaftar. Silakan masuk." });
      const sessionVersion = await db.getUserSessionVersion(user.id);
      const session = await registerActiveSession(user.id, sessionVersion, ctx.req);
      const token = await sdk.createSessionToken(user.id, { sessionVersion, sessionId: session.id });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 24 * 30 });
      let verificationSent = false;
      try { verificationSent = await issueAccountEmail(user, "email_verification"); } catch (error) { console.error("[Auth] Failed to send verification email", error); }
      return { user, verificationSent };
    }),
    login: publicProcedure.input(z.object({ email: z.string().trim().min(3).max(320), password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const emailHash = hashLoginEmail(email);
      const lockedUntil = await db.getLoginLock(emailHash);
      if (lockedUntil) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Terlalu banyak percobaan masuk. Coba lagi setelah 15 menit." });
      const user = await db.getUserByEmail(email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        const newLock = await db.recordFailedLogin(emailHash);
        if (newLock) {
          if (user?.passwordHash) {
            try { await db.recordUserSecurityEvent(user.id, "account_locked"); } catch (error) { console.error("[Auth] Failed to record account lock event", error); }
            try { await sendAccountLockedEmail(user); } catch (error) { console.error("[Auth] Failed to send account lock email", error); }
          }
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Terlalu banyak percobaan masuk. Coba lagi setelah 15 menit." });
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email atau kata sandi tidak sesuai." });
      }
      await db.clearFailedLogins(emailHash);
      const sessionVersion = await db.getUserSessionVersion(user.id);
      const session = await registerActiveSession(user.id, sessionVersion, ctx.req);
      const token = await sdk.createSessionToken(user.id, { sessionVersion, sessionId: session.id });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 24 * 30 });
      await db.touchLocalSignIn(user.id);
      try { await db.recordUserSecurityEvent(user.id, "login"); } catch (error) { console.error("[Auth] Failed to record login security event", error); }
      if (!session.isKnown) {
        try { await db.recordUserSecurityEvent(user.id, "new_device_login"); } catch (error) { console.error("[Auth] Failed to record new-device login event", error); }
        try { await db.createAccountActivityNotification(user.id, "Login baru terdeteksi", `${session.deviceLabel} di sekitar ${session.locationLabel}. Tinjau sesi aktif bila ini bukan kamu.`); } catch (error) { console.error("[Auth] Failed to create new-device notification", error); }
        try { await sendNewDeviceLoginEmail(user, session); } catch (error) { console.error("[Auth] Failed to send new-device login email", error); }
      }
      return { user };
    }),
    requestPasswordReset: publicProcedure.input(z.object({ email: z.string().trim().min(3).max(320) })).mutation(async ({ input }) => {
      const user = await db.getUserByEmail(normalizeEmail(input.email));
      if (user?.passwordHash) {
        try { await issueAccountEmail(user, "password_reset"); } catch (error) { console.error("[Auth] Failed to send password reset email", error); }
      }
      return { success: true } as const;
    }),
    resetPassword: publicProcedure.input(z.object({ token: z.string().trim().min(40).max(200), password: z.string().min(12).max(128) })).mutation(async ({ input }) => {
      try { validatePassword(input.password); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Kata sandi belum valid." }); }
      const user = await db.consumeAuthEmailToken(hashSecurityToken(input.token), "password_reset");
      if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "Tautan reset tidak valid atau sudah kedaluwarsa." });
      const updated = await db.updateLocalPassword(user.id, await hashPassword(input.password), false);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Akun tidak ditemukan." });
      await db.invalidateUserSessions(updated.id);
      try { await db.recordUserSecurityEvent(updated.id, "password_reset"); } catch (error) { console.error("[Auth] Failed to record password reset event", error); }
      let emailNoticeSent = false;
      try { emailNoticeSent = await sendPasswordChangedEmail(updated); } catch (error) { console.error("[Auth] Failed to send password-change email", error); }
      return { success: true, emailNoticeSent } as const;
    }),
    verifyEmail: publicProcedure.input(z.object({ token: z.string().trim().min(40).max(200) })).mutation(async ({ input }) => {
      const user = await db.consumeAuthEmailToken(hashSecurityToken(input.token), "email_verification");
      if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "Tautan verifikasi tidak valid atau sudah kedaluwarsa." });
      const updated = await db.markEmailVerified(user.id);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Akun tidak ditemukan." });
      return { user: updated };
    }),
    resendVerification: signedInProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.emailVerifiedAt) return { alreadyVerified: true, sent: false } as const;
      try { return { alreadyVerified: false, sent: await issueAccountEmail(ctx.user, "email_verification") } as const; } catch (error) { console.error("[Auth] Failed to resend verification email", error); throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Email verifikasi belum dapat dikirim. Coba lagi nanti." }); }
    }),
    changePassword: signedInProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), nextPassword: z.string().min(12).max(128) })).mutation(async ({ ctx, input }) => {
      if (!(await verifyPassword(input.currentPassword, ctx.user.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Kata sandi saat ini tidak sesuai." });
      try { validatePassword(input.nextPassword); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Kata sandi belum valid." }); }
      const user = await db.updateLocalPassword(ctx.user.id, await hashPassword(input.nextPassword), false);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Akun tidak ditemukan." });
      const sessionVersion = await db.invalidateUserSessions(user.id);
      const session = await registerActiveSession(user.id, sessionVersion, ctx.req);
      const refreshedSession = await sdk.createSessionToken(user.id, { sessionVersion, sessionId: session.id });
      ctx.res.cookie(COOKIE_NAME, refreshedSession, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 24 * 30 });
      try { await db.recordUserSecurityEvent(user.id, "password_changed"); } catch (error) { console.error("[Auth] Failed to record password change event", error); }
      let emailNoticeSent = false;
      try { emailNoticeSent = await sendPasswordChangedEmail(user); } catch (error) { console.error("[Auth] Failed to send password-change email", error); }
      return { user, emailNoticeSent };
    }),
    securityHistory: protectedProcedure.query(({ ctx }) => db.listUserSecurityEvents(ctx.user.id)),
    securitySummaryPreference: protectedProcedure.query(({ ctx }) => db.getUserSecuritySummaryPreference(ctx.user.id)),
    updateSecuritySummaryPreference: protectedProcedure.input(z.object({ frequency: z.enum(["disabled", "daily", "weekly"]) })).mutation(({ ctx, input }) => db.updateUserSecuritySummaryPreference(ctx.user.id, input.frequency)),
    sendSecuritySummary: protectedProcedure.mutation(async ({ ctx }) => {
      const events = await db.listRecentUserSecurityEvents(ctx.user.id, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      try {
        const sent = await sendSecuritySummaryEmail(ctx.user, events);
        if (!sent) throw new Error("Alamat email akun belum tersedia.");
        return { sent: true, activityCount: events.length } as const;
      } catch (error) {
        console.error("[Auth] Failed to send manual security summary", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Ringkasan keamanan belum dapat dikirim. Coba lagi nanti." });
      }
    }),
    activeSessions: protectedProcedure.query(async ({ ctx }) => (await db.listUserActiveSessions(ctx.user.id)).map(({ userId: _userId, ...session }) => ({ ...session, isCurrent: Boolean(ctx.sessionId && session.id === ctx.sessionId) }))),
    signOutSession: protectedProcedure.input(z.object({ sessionId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const revoked = await db.revokeUserActiveSession(ctx.user.id, input.sessionId);
      if (!revoked) throw new TRPCError({ code: "NOT_FOUND", message: "Sesi tidak ditemukan atau sudah berakhir." });
      try { await db.recordUserSecurityEvent(ctx.user.id, "session_signed_out"); } catch (error) { console.error("[Auth] Failed to record single session sign-out", error); }
      const signedOutCurrent = ctx.sessionId === input.sessionId;
      if (signedOutCurrent) ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true, signedOutCurrent } as const;
    }),
    signOutAllSessions: signedInProcedure.mutation(async ({ ctx }) => {
      await db.invalidateUserSessions(ctx.user.id);
      try { await db.recordUserSecurityEvent(ctx.user.id, "all_sessions_signed_out"); } catch (error) { console.error("[Auth] Failed to record session sign-out event", error); }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  brand: router({
    get: publicProcedure.query(() => db.getBrandSettings()),
  }),
  photo: router({
    list: protectedProcedure.input(z.object({ includeHidden: z.boolean().optional() }).optional()).query(async ({ ctx, input }) => (await db.listPhotoTransforms(ctx.user.id, input?.includeHidden ?? false)).map(withPrivatePhotoMedia)),
    setHidden: protectedProcedure.input(z.object({ transformId: z.number().int().positive(), isHidden: z.boolean() })).mutation(({ ctx, input }) => db.setPhotoTransformHidden(ctx.user.id, input.transformId, input.isHidden)),
    deletePhotoTransform: protectedProcedure.input(z.object({ transformId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const deleted = await db.deletePhotoTransform(ctx.user.id, input.transformId);
      if (!deleted.success) throw new TRPCError({ code: "NOT_FOUND", message: "Hasil foto tidak ditemukan atau bukan milikmu." });
      return deleted;
    }),
    trash: protectedProcedure.query(async ({ ctx }) => (await db.listTrashedPhotoTransforms(ctx.user.id)).map(withPrivatePhotoMedia)),
    moveToTrash: protectedProcedure.input(z.object({ transformIds: z.array(z.number().int().positive()).min(1).max(50).superRefine((ids, issue) => { if (new Set(ids).size !== ids.length) issue.addIssue({ code: z.ZodIssueCode.custom, message: "Foto tidak boleh dipilih lebih dari sekali." }); }) })).mutation(async ({ ctx, input }) => {
      const moved = await db.movePhotoTransformsToTrash(ctx.user.id, input.transformIds);
      if (!moved.trashedCount) throw new TRPCError({ code: "NOT_FOUND", message: "Tidak ada foto aktif milikmu yang dapat dipindahkan ke Sampah." });
      return moved;
    }),
    restoreFromTrash: protectedProcedure.input(z.object({ transformId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const restored = await db.restoreTrashedPhotoTransform(ctx.user.id, input.transformId);
      if (!restored.success) throw new TRPCError({ code: "NOT_FOUND", message: "Foto tidak ditemukan di Sampah atau masa pemulihannya telah berakhir." });
      return restored;
    }),
    emptyTrash: protectedProcedure.mutation(({ ctx }) => db.emptyPhotoTrash(ctx.user.id)),
    quota: protectedProcedure.query(async ({ ctx }) => ({ ...(await db.getDailyPhotoQuota(ctx.user.id)), isUnlimited: hasUnlimitedTransforms(ctx.user) })),
    queueStatus: protectedProcedure.query(() => db.getProcessingQueueStatus()),
    getById: protectedProcedure.input(z.object({ transformId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const transform = await db.getOwnedPhotoTransform(ctx.user.id, input.transformId);
      if (!transform) throw new TRPCError({ code: "NOT_FOUND", message: "Transformasi tidak ditemukan." });
      return withPrivatePhotoMedia(transform);
    }),
    collaborationInvites: protectedProcedure.query(({ ctx }) => db.listPhotoCollaborationInvites(ctx.user.id)),
    collaborationProjects: protectedProcedure.input(z.object({ template: z.enum(collaborationTemplateIds).optional(), status: z.enum(["processing", "completed", "failed", "cancelled"]).optional() }).optional()).query(async ({ ctx, input }) => (await db.listPhotoCollaborationProjects(ctx.user.id, input)).map((project) => ({ ...project, resultUrl: privateMediaUrl(project.resultUrl) }))),
    collaborationShareLinks: protectedProcedure.input(z.object({ transformId: z.number().int().positive() })).query(({ ctx, input }) => db.listPhotoCollaborationShareLinks(ctx.user.id, input.transformId)),
    collaborationShareLimit: protectedProcedure.query(async ({ ctx }) => ({ maxActiveLinks: (await db.getCollaborationShareRoleLimits())[ctx.user.role === "admin" ? "admin" : "user"] })),
    createCollaborationShareLink: protectedProcedure.input(z.object({ transformId: z.number().int().positive(), expiresInHours: z.union([z.literal(1), z.literal(24), z.literal(72)]), watermarkText: z.string().trim().max(72).optional(), watermarkLogoId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => { const { token, tokenHash } = createSecurityToken(); const role = ctx.user.role === "admin" ? "admin" : "user"; const link = await db.createPhotoCollaborationShareLink(ctx.user.id, role, input.transformId, tokenHash, new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000), input.watermarkText?.trim() || null, input.watermarkLogoId ?? null); return { id: link.id, token, expiresAt: link.expiresAt }; }),
    collaborationBrandLogos: protectedProcedure.query(async ({ ctx }) => db.listPhotoCollaborationBrandLogos(ctx.user.id)),
    uploadCollaborationBrandLogo: protectedProcedure.input(collaborationBrandLogoInput).mutation(async ({ ctx, input }) => db.createPhotoCollaborationBrandLogo(ctx.user.id, input.name, await storeCollaborationBrandLogo(ctx.user.id, input))),
    deleteCollaborationBrandLogo: protectedProcedure.input(z.object({ logoId: z.number().int().positive() })).mutation(async ({ ctx, input }) => db.deletePhotoCollaborationBrandLogo(ctx.user.id, input.logoId)),
    revokeCollaborationShareLink: protectedProcedure.input(z.object({ shareLinkId: z.number().int().positive() })).mutation(({ ctx, input }) => db.revokePhotoCollaborationShareLink(ctx.user.id, input.shareLinkId)),
    revokeAllCollaborationShareLinks: protectedProcedure.input(z.object({ transformId: z.number().int().positive() })).mutation(({ ctx, input }) => db.revokeAllActivePhotoCollaborationShareLinks(input.transformId, ctx.user.id)),
    collaborationSharePreview: publicProcedure.input(z.object({ token: z.string().min(32).max(100) })).query(async ({ input }) => { const shared = await db.getPhotoCollaborationShareByTokenHash(hashSecurityToken(input.token)); if (!shared) throw new TRPCError({ code: "NOT_FOUND", message: "Tautan berbagi tidak tersedia atau telah berakhir." }); return { title: shared.title, template: shared.template, aspectRatio: shared.aspectRatio, hasWatermark: Boolean(shared.watermarkText || shared.logoStorageKey), expiresAt: shared.expiresAt }; }),
    collaborationLayoutPresets: protectedProcedure.query(({ ctx }) => db.listPhotoCollaborationLayoutPresets(ctx.user.id)),
    createCollaborationLayoutPreset: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(48), layout: collaborationLayoutInput })).mutation(({ ctx, input }) => db.createPhotoCollaborationLayoutPreset(ctx.user.id, input.name, JSON.stringify(input.layout))),
    deleteCollaborationLayoutPreset: protectedProcedure.input(z.object({ presetId: z.number().int().positive() })).mutation(({ ctx, input }) => db.deletePhotoCollaborationLayoutPreset(ctx.user.id, input.presetId)),
    inviteToCollaboration: protectedProcedure.input(z.object({ email: z.string().trim().email().max(320), template: z.enum(collaborationTemplateIds), aspectRatio: z.enum(aspectRatioIds), style: z.enum(styleIds), note: z.string().trim().max(360).optional() })).mutation(({ ctx, input }) => db.createPhotoCollaborationInvite(ctx.user.id, normalizeEmail(input.email), input)),
    respondToCollaborationInvite: protectedProcedure.input(z.object({ inviteId: z.number().int().positive(), action: z.enum(["accepted", "declined"]) })).mutation(({ ctx, input }) => db.respondPhotoCollaborationInvite(ctx.user.id, input.inviteId, input.action)),
    cancelCollaborationInvite: protectedProcedure.input(z.object({ inviteId: z.number().int().positive() })).mutation(({ ctx, input }) => db.cancelPhotoCollaborationInvite(ctx.user.id, input.inviteId)),
    shareHistory: protectedProcedure.input(z.object({ transformId: z.number().int().positive(), platform: z.enum(["whatsapp", "instagram", "facebook", "tiktok", "other"]).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), captionQuery: z.string().trim().max(120).optional() })).query(({ ctx, input }) => db.listPhotoShareEvents(ctx.user.id, input.transformId, input)),
    combinedShareHistory: protectedProcedure.input(z.object({ transformIds: z.array(z.number().int().positive()).min(1).max(50).superRefine((ids, context) => { if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Transformasi tidak boleh dipilih lebih dari sekali." }); }), from: z.coerce.date().optional(), to: z.coerce.date().optional() })).query(({ ctx, input }) => db.listPhotoShareEventsForTransforms(ctx.user.id, input.transformIds, input)),
    recordShare: protectedProcedure.input(z.object({ transformId: z.number().int().positive(), platform: z.enum(["whatsapp", "instagram", "facebook", "tiktok", "other"]), caption: z.string().trim().min(1).max(500), watermarkText: z.string().trim().max(72).optional(), outcome: z.enum(["shared", "copied", "downloaded"]) })).mutation(({ ctx, input }) => db.recordPhotoShareEvent(ctx.user.id, { ...input, watermarkText: input.watermarkText ?? null })),
    aiQuotaStatus: protectedProcedure.query(() => ({ checkedAt: new Date(), retryEstimate: aiQuotaRetryEstimate(), status: "estimate_only" as const })),
    aiProviderCapacity: protectedProcedure.query(async () => db.getAiProviderCapacityStatus()),
    queueCollaborationProviderRetry: protectedProcedure.input(z.object({ sourceTransformId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const source = await db.getOwnedPhotoTransform(ctx.user.id, input.sourceTransformId);
      if (!source || source.recipe !== "collaboration" || source.status !== "failed" || !source.secondarySourceKey) throw new TRPCError({ code: "NOT_FOUND", message: "Kolaborasi gagal yang dapat dimasukkan ke antrean tidak ditemukan." });
      if (!/^(Kapasitas penyedia AI|Layanan AI sedang mencapai batas)/.test(source.errorMessage ?? "")) throw new TRPCError({ code: "BAD_REQUEST", message: "Antrean pemulihan hanya tersedia saat kapasitas penyedia AI sedang penuh." });
      const queued = await db.queueCollaborationProviderRetry(ctx.user.id, source.id, ctx.user.role === "admin" ? "admin" : "standard", aiQuotaRetryAt());
      return { id: queued.id, priority: queued.priority, nextAttemptAt: queued.nextAttemptAt, status: queued.status };
    }),
    cancelTransform: protectedProcedure.input(z.object({ requestId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const result = await db.cancelPhotoTransform(ctx.user.id, input.requestId);
      if (result.cancelled) activeTransformAborters.get(activeTransformKey(ctx.user.id, input.requestId))?.abort();
      return result;
    }),
    profile: protectedProcedure.query(async ({ ctx }) => ({
      user: { name: ctx.user.name, email: ctx.user.email, role: ctx.user.role, createdAt: ctx.user.createdAt },
      isUnlimitedTransforms: hasUnlimitedTransforms(ctx.user),
      ...(await db.getPhotoProfileSummary(ctx.user.id)),
    })),
    recommend: protectedProcedure.input(z.object({ mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), sourceData: z.string().min(16).max(8_000_000) })).mutation(async ({ input }) => {
      const sourceBuffer = Buffer.from(input.sourceData, "base64");
      if (!sourceBuffer.length || sourceBuffer.length > 5_500_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Ukuran foto harus maksimal 5 MB." });
      return recommendPhotoRecipe(input.sourceData, input.mimeType);
    }),
    hdExport: protectedProcedure.input(z.object({ transformId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (hasUnlimitedHdExports(ctx.user.role)) {
        const records = await db.listPhotoTransforms(ctx.user.id, true);
        const record = records.find((item) => item.id === input.transformId && item.status === "completed" && item.resultUrl);
        if (!record?.resultUrl) throw new TRPCError({ code: "NOT_FOUND", message: "Hasil HD belum tersedia." });
        return { resultUrl: privateMediaUrl(record.resultUrl)!, charged: false };
      }
      const result = await db.consumeHdExportCredit(ctx.user.id, input.transformId);
      if (!result.ok) throw new TRPCError({ code: result.reason === "no_credit" ? "TOO_MANY_REQUESTS" : "NOT_FOUND", message: result.reason === "no_credit" ? "Kredit tidak cukup untuk unduhan HD." : "Hasil HD belum tersedia." });
      return { resultUrl: privateMediaUrl(result.resultUrl)!, charged: true };
    }),
    transform: protectedProcedure.input(imageInput).mutation(async ({ ctx, input }) => {
      const sourceBuffer = Buffer.from(input.sourceData, "base64");
      if (!sourceBuffer.length || sourceBuffer.length > 5_500_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ukuran foto harus maksimal 5 MB." });
      }
      const quota = await db.getDailyPhotoQuota(ctx.user.id);
      let usedPurchasedCredit = false;
      let transformId: number | null = null;
      if (quota.exhausted && !hasUnlimitedTransforms(ctx.user)) {
        usedPurchasedCredit = await db.consumePurchasedCredit(ctx.user.id);
        if (!usedPurchasedCredit) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Kuota harian dan kredit tambahanmu sudah habis. Tambahkan kredit untuk lanjut meracik." });
      }
      if (input.retryOfTransformId) {
        const previous = await db.getOwnedPhotoTransform(ctx.user.id, input.retryOfTransformId);
        if (!previous || (previous.status !== "failed" && previous.status !== "cancelled")) throw new TRPCError({ code: "BAD_REQUEST", message: "Transformasi yang ingin diulang tidak tersedia." });
      }
      try {
        const source = await storagePut(`originals/${ctx.user.id}/${Date.now()}-${safeFileName(input.fileName)}`, sourceBuffer, input.mimeType);
        const queue = await db.getProcessingQueueStatus();
        const transform = await db.createPhotoTransform({ userId: ctx.user.id, recipe: input.recipe, aspectRatio: input.aspectRatio, style: input.style, title: photoRecipes[input.recipe].title, sourceKey: source.key, sourceUrl: source.url, retryOfTransformId: input.retryOfTransformId, requestId: input.requestId, retryInstruction: input.retryOfTransformId ? input.customInstruction ?? null : null, queuePosition: queue.position, status: "processing" });
        transformId = transform.id;
        const aborter = input.requestId ? new AbortController() : null;
        if (aborter && input.requestId) activeTransformAborters.set(activeTransformKey(ctx.user.id, input.requestId), aborter);
        const options = { prompt: buildTransformPrompt(input.recipe, input.aspectRatio, input.style, input.customInstruction), originalImages: [{ b64Json: input.sourceData, mimeType: input.mimeType }], quality: "medium", signal: aborter?.signal };
        let result;
        try {
          result = await generateImage(options);
        } catch (firstError) {
          if (!isTemporaryProviderFailure(firstError)) throw firstError;
          await db.markPhotoTransformAutoRetry(transform.id);
          result = await generateImage(options);
        }
        if (!result.url) throw new Error("Layanan AI tidak mengembalikan gambar hasil.");
        return withPrivatePhotoMedia(await db.completePhotoTransform(transform.id, result.url));
      } catch (error) {
        if (usedPurchasedCredit) await db.refundPurchasedCredit(ctx.user.id);
        const providerMessage = error instanceof Error ? error.message : "Transformasi AI gagal diproses.";
        const failure = toSafeTransformFailure(error);
        if (transformId) await db.failPhotoTransform(transformId, failure.message);
        console.error("[Photo] Transform failed", providerMessage);
        throw new TRPCError({ code: failure.code === "AI_QUOTA_EXHAUSTED" ? "TOO_MANY_REQUESTS" : "INTERNAL_SERVER_ERROR", message: failure.message });
      } finally {
        if (input.requestId) activeTransformAborters.delete(activeTransformKey(ctx.user.id, input.requestId));
      }
    }),
    collaborationFaceReadiness: protectedProcedure.input(z.object({ first: collaborationImageInput, second: collaborationImageInput })).mutation(async ({ input }) => {
      const first = Buffer.from(input.first.sourceData, "base64"); const second = Buffer.from(input.second.sourceData, "base64");
      if (!first.length || !second.length || first.length > 5_500_000 || second.length > 5_500_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Masing-masing foto pemeriksaan harus maksimal 5 MB." });
      return assessCollaborationFaceReadiness(input.first, input.second);
    }),
    collaborate: protectedProcedure.input(collaborationInput).mutation(async ({ ctx, input }) => {
      const firstBuffer = Buffer.from(input.first.sourceData, "base64"); const secondBuffer = Buffer.from(input.second.sourceData, "base64");
      if (!firstBuffer.length || !secondBuffer.length || firstBuffer.length > 5_500_000 || secondBuffer.length > 5_500_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Masing-masing foto kolaborasi harus maksimal 5 MB." });
      const resolvedBackground = await resolveCollaborationBackground(ctx.user.role === "admin" ? "admin" : "user", input.background, input.brandBackgroundPresetId);
      const acceptedInvite = input.inviteId ? await db.getAcceptedPhotoCollaborationInvite(ctx.user.id, input.inviteId) : null;
      if (input.inviteId && (!acceptedInvite || acceptedInvite.template !== input.template || acceptedInvite.aspectRatio !== input.aspectRatio || acceptedInvite.style !== input.style)) throw new TRPCError({ code: "FORBIDDEN", message: "Persetujuan kolaborator tidak tersedia untuk template, rasio, atau gaya ini." });
      const quota = await db.getDailyPhotoQuota(ctx.user.id); let usedPurchasedCredit = false; let transformId: number | null = null;
      if (quota.exhausted && !hasUnlimitedTransforms(ctx.user)) { usedPurchasedCredit = await db.consumePurchasedCredit(ctx.user.id); if (!usedPurchasedCredit) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Kuota harian dan kredit tambahanmu sudah habis. Tambahkan kredit untuk melanjutkan kolaborasi." }); }
      try {
        const now = Date.now();
        const [firstSource, secondSource] = await Promise.all([storagePut(`collaborations/${ctx.user.id}/${now}-a-${safeFileName(input.first.fileName)}`, firstBuffer, input.first.mimeType), storagePut(`collaborations/${ctx.user.id}/${now}-b-${safeFileName(input.second.fileName)}`, secondBuffer, input.second.mimeType)]);
        const queue = await db.getProcessingQueueStatus();
        const transform = await db.createPhotoTransform({ userId: ctx.user.id, recipe: "collaboration", aspectRatio: input.aspectRatio, style: input.style, title: "Kolaborasi dua foto", sourceKey: firstSource.key, sourceUrl: firstSource.url, secondarySourceKey: secondSource.key, secondarySourceUrl: secondSource.url, collaborationTemplate: input.template, collaborationInviteId: input.inviteId ?? null, collaborationLayout: input.layout ? JSON.stringify(input.layout) : null, requestId: input.requestId, queuePosition: queue.position, status: "processing" });
        transformId = transform.id; const aborter = input.requestId ? new AbortController() : null;
        if (acceptedInvite && input.inviteId) await db.markPhotoCollaborationInviteUsed(ctx.user.id, input.inviteId, transform.id);
        if (aborter && input.requestId) activeTransformAborters.set(activeTransformKey(ctx.user.id, input.requestId), aborter);
        const options = { prompt: buildCollaborationPrompt(input.template, input.aspectRatio, input.style, resolvedBackground, input.customInstruction, input.layout), originalImages: [{ b64Json: input.first.sourceData, mimeType: input.first.mimeType }, { b64Json: input.second.sourceData, mimeType: input.second.mimeType }], quality: "high" as const, signal: aborter?.signal };
        let result; try { result = await generateImage(options); } catch (firstError) { if (!isTemporaryProviderFailure(firstError)) throw firstError; await db.markPhotoTransformAutoRetry(transform.id); result = await generateImage(options); }
        if (!result.url) throw new Error("Layanan AI tidak mengembalikan gambar hasil.");
        await db.recordAiProviderCapacityStatus("available");
        const completed = await db.completePhotoTransform(transform.id, result.url);
        if (acceptedInvite) await db.createAccountActivityNotification(acceptedInvite.inviteeUserId, "Hasil Kolaborasi Foto selesai", "Kolaborasi Foto yang kamu setujui telah selesai diproses. Hasilnya tetap privat dan tidak dipublikasikan otomatis.");
        return withPrivatePhotoMedia(completed);
      } catch (error) {
        if (usedPurchasedCredit) await db.refundPurchasedCredit(ctx.user.id);
        const providerMessage = error instanceof Error ? error.message : "Kolaborasi foto gagal diproses."; const failure = toSafeTransformFailure(error);
        if (transformId) await db.failPhotoTransform(transformId, failure.message);
        if (failure.code === "AI_QUOTA_EXHAUSTED") await db.recordAiProviderCapacityStatus("unavailable", aiQuotaRetryAt());
        console.error("[Photo collaboration] Transform failed", providerMessage);
        throw new TRPCError({ code: failure.code === "AI_QUOTA_EXHAUSTED" ? "TOO_MANY_REQUESTS" : "INTERNAL_SERVER_ERROR", message: failure.message });
      } finally { if (input.requestId) activeTransformAborters.delete(activeTransformKey(ctx.user.id, input.requestId)); }
    }),
    retryCollaboration: protectedProcedure.input(collaborationRetryInput).mutation(async ({ ctx, input }) => {
      const previous = await db.getOwnedPhotoTransform(ctx.user.id, input.transformId);
      if (!previous || previous.recipe !== "collaboration" || previous.status !== "completed" || !previous.sourceKey || !previous.secondarySourceKey) throw new TRPCError({ code: "NOT_FOUND", message: "Hasil Kolaborasi yang dapat diulang tidak ditemukan." });
      const template = collaborationTemplateIds.includes(previous.collaborationTemplate as (typeof collaborationTemplateIds)[number]) ? previous.collaborationTemplate as (typeof collaborationTemplateIds)[number] : "free";
      const aspectRatio = aspectRatioIds.includes(previous.aspectRatio as (typeof aspectRatioIds)[number]) ? previous.aspectRatio as (typeof aspectRatioIds)[number] : "1:1";
      const style = styleIds.includes(previous.style as (typeof styleIds)[number]) ? previous.style as (typeof styleIds)[number] : "editorial";
      const resolvedBackground = await resolveCollaborationBackground(ctx.user.role === "admin" ? "admin" : "user", input.background, input.brandBackgroundPresetId);
      const quota = await db.getDailyPhotoQuota(ctx.user.id); let usedPurchasedCredit = false; let transformId: number | null = null;
      if (quota.exhausted && !hasUnlimitedTransforms(ctx.user)) { usedPurchasedCredit = await db.consumePurchasedCredit(ctx.user.id); if (!usedPurchasedCredit) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Kuota harian dan kredit tambahanmu sudah habis. Tambahkan kredit untuk melanjutkan Kolaborasi." }); }
      try {
        const [firstUrl, secondUrl] = await Promise.all([storageGetSignedUrl(previous.sourceKey), storageGetSignedUrl(previous.secondarySourceKey)]);
        const queue = await db.getProcessingQueueStatus();
        const transform = await db.createPhotoTransform({ userId: ctx.user.id, recipe: "collaboration", aspectRatio, style, title: resolvedBackground === "keep" ? "Kolaborasi dua foto · ulang proses" : "Kolaborasi dua foto · latar baru", sourceKey: previous.sourceKey, sourceUrl: previous.sourceUrl, secondarySourceKey: previous.secondarySourceKey, secondarySourceUrl: previous.secondarySourceUrl, collaborationTemplate: template, collaborationInviteId: null, collaborationLayout: previous.collaborationLayout, retryOfTransformId: previous.id, retryInstruction: input.customInstruction?.trim() || null, requestId: input.requestId, queuePosition: queue.position, status: "processing" });
        transformId = transform.id; const aborter = input.requestId ? new AbortController() : null;
        if (aborter && input.requestId) activeTransformAborters.set(activeTransformKey(ctx.user.id, input.requestId), aborter);
        const options = { prompt: buildCollaborationPrompt(template, aspectRatio, style, resolvedBackground, input.customInstruction, parseStoredCollaborationLayout(previous.collaborationLayout)), originalImages: [{ url: firstUrl, mimeType: collaborationMimeTypeFromKey(previous.sourceKey) }, { url: secondUrl, mimeType: collaborationMimeTypeFromKey(previous.secondarySourceKey) }], quality: "high" as const, signal: aborter?.signal };
        let result; try { result = await generateImage(options); } catch (firstError) { if (!isTemporaryProviderFailure(firstError)) throw firstError; await db.markPhotoTransformAutoRetry(transform.id); result = await generateImage(options); }
        if (!result.url) throw new Error("Layanan AI tidak mengembalikan gambar hasil.");
        return withPrivatePhotoMedia(await db.completePhotoTransform(transform.id, result.url));
      } catch (error) {
        if (usedPurchasedCredit) await db.refundPurchasedCredit(ctx.user.id);
        const providerMessage = error instanceof Error ? error.message : "Proses ulang Kolaborasi gagal."; const failure = toSafeTransformFailure(error);
        if (transformId) await db.failPhotoTransform(transformId, failure.message);
        console.error("[Photo collaboration retry] Transform failed", providerMessage);
        throw new TRPCError({ code: failure.code === "AI_QUOTA_EXHAUSTED" ? "TOO_MANY_REQUESTS" : "INTERNAL_SERVER_ERROR", message: failure.message });
      } finally { if (input.requestId) activeTransformAborters.delete(activeTransformKey(ctx.user.id, input.requestId)); }
    }),
    collaborationComparison: protectedProcedure.input(z.object({ transformId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const comparison = await db.getPhotoCollaborationComparison(ctx.user.id, input.transformId);
      if (!comparison) return null;
      return { before: { ...comparison.before, resultUrl: privateMediaUrl(comparison.before.resultUrl)! }, after: { ...comparison.after, resultUrl: privateMediaUrl(comparison.after.resultUrl)! } };
    }),
    reportCollaborationResult: protectedProcedure.input(z.object({ transformId: z.number().int().positive(), reason: z.enum(["face_mismatch", "subject_changed", "background_issue", "other"]), details: z.string().trim().max(320).optional() })).mutation(({ ctx, input }) => db.createPhotoCollaborationResultReport(ctx.user.id, input)),
  }),
  promptFavorites: router({
    list: protectedProcedure.query(({ ctx }) => db.listPhotoPromptFavorites(ctx.user.id)),
    create: protectedProcedure.input(z.object({ instruction: z.string().trim().min(3).max(360) })).mutation(({ ctx, input }) => db.createPhotoPromptFavorite(ctx.user.id, input.instruction)),
    delete: protectedProcedure.input(z.object({ favoriteId: z.number().int().positive() })).mutation(({ ctx, input }) => db.deletePhotoPromptFavorite(ctx.user.id, input.favoriteId)),
  }),
  captionTemplates: router({
    list: protectedProcedure.query(({ ctx }) => db.listPhotoCaptionTemplates(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(60), caption: z.string().trim().min(3).max(500) })).mutation(({ ctx, input }) => db.createPhotoCaptionTemplate(ctx.user.id, input.name, input.caption)),
    delete: protectedProcedure.input(z.object({ templateId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const deleted = await db.deletePhotoCaptionTemplate(ctx.user.id, input.templateId);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Template caption tidak ditemukan." });
      return { deleted: true } as const;
    }),
  }),
  watermarkPresets: router({
    list: protectedProcedure.query(({ ctx }) => db.listPhotoWatermarkPresets(ctx.user.id)),
    global: publicProcedure.query(() => db.listGlobalWatermarkPresets()),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(60), text: z.string().trim().min(1).max(72), position: z.enum(["top-left", "top-right", "center", "bottom-left", "bottom-right"]), size: z.number().int().min(2).max(10), font: z.enum(["sans", "serif", "mono"]) })).mutation(({ ctx, input }) => db.createPhotoWatermarkPreset(ctx.user.id, input)),
    delete: protectedProcedure.input(z.object({ presetId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const deleted = await db.deletePhotoWatermarkPreset(ctx.user.id, input.presetId);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Preset watermark tidak ditemukan." });
      return { deleted: true } as const;
    }),
  }),
  recipeFavorites: router({
    list: protectedProcedure.query(({ ctx }) => db.listPhotoRecipeFavorites(ctx.user.id)),
    create: protectedProcedure.input(z.object({ recipeId: z.enum(recipeIds) })).mutation(({ ctx, input }) => db.createPhotoRecipeFavorite(ctx.user.id, input.recipeId)),
    delete: protectedProcedure.input(z.object({ recipeId: z.enum(recipeIds) })).mutation(({ ctx, input }) => db.deletePhotoRecipeFavorite(ctx.user.id, input.recipeId)),
  }),
  recipeCatalog: router({
    popularity: publicProcedure.query(() => db.getRecipePopularity()),
    personalUsage: protectedProcedure.query(({ ctx }) => db.getRecipePopularity(ctx.user.id)),
    seasonalCollections: publicProcedure.query(() => db.listActiveSeasonalRecipeCollections()),
    definitions: publicProcedure.query(() => recipeIds.map((id) => ({ id, title: photoRecipes[id].title }))),
  }),
  billing: router({
    packs: publicProcedure.query(() => Object.values(creditPacks)),
    balance: protectedProcedure.query(async ({ ctx }) => ({ credits: await db.getCreditBalance(ctx.user.id), purchases: await db.listCreditPurchases(ctx.user.id), manualOrders: await db.listManualCreditOrders(ctx.user.id) })),
    createManualOrder: protectedProcedure.input(z.object({ packId: z.enum(["starter", "studio", "archive"]), proof: transferProofInput })).mutation(async ({ ctx, input }) => {
      const pack = getCreditPack(input.packId);
      if (!pack) throw new TRPCError({ code: "NOT_FOUND", message: "Paket kredit tidak ditemukan." });
      return db.createManualCreditOrder(ctx.user.id, pack, await storeTransferProof(ctx.user.id, input.proof));
    }),
  }),
  community: router({
    list: publicProcedure.query(({ ctx }) => db.listCommunityPosts(ctx.user?.id)),
    publish: protectedProcedure.input(z.object({ transformId: z.number().int().positive(), caption: z.string().trim().max(240).optional() })).mutation(({ ctx, input }) => db.publishCommunityPost(ctx.user.id, input.transformId, input.caption)),
    unpublish: protectedProcedure.input(z.object({ postId: z.number().int().positive() })).mutation(({ ctx, input }) => db.unpublishCommunityPost(ctx.user.id, input.postId)),
    delete: protectedProcedure.input(z.object({ postId: z.number().int().positive() })).mutation(({ ctx, input }) => db.deleteCommunityPost(ctx.user.id, input.postId)),
    toggleLike: protectedProcedure.input(z.object({ postId: z.number().int().positive() })).mutation(({ ctx, input }) => db.toggleCommunityLike(ctx.user.id, input.postId)),
    report: protectedProcedure.input(z.object({ postId: z.number().int().positive(), reason: z.enum(["inappropriate", "spam", "copyright", "other"]), details: z.string().trim().max(320).optional() })).mutation(({ ctx, input }) => db.createCommunityReport(ctx.user.id, input)),
  }),
  albums: router({
    list: protectedProcedure.query(async ({ ctx }) => (await db.listPhotoAlbums(ctx.user.id)).map(withPrivateAlbumMedia)),
    listArchived: protectedProcedure.query(async ({ ctx }) => (await db.listArchivedPhotoAlbums(ctx.user.id)).map(withPrivateAlbumMedia)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(80) })).mutation(({ ctx, input }) => db.createPhotoAlbum(ctx.user.id, input.name)),
    rename: protectedProcedure.input(z.object({ albumId: z.number().int().positive(), name: z.string().trim().min(1).max(80) })).mutation(({ ctx, input }) => db.renamePhotoAlbum(ctx.user.id, input.albumId, input.name)),
    delete: protectedProcedure.input(z.object({ albumId: z.number().int().positive() })).mutation(({ ctx, input }) => db.deletePhotoAlbum(ctx.user.id, input.albumId)),
    setArchived: protectedProcedure.input(z.object({ albumId: z.number().int().positive(), isArchived: z.boolean() })).mutation(({ ctx, input }) => db.setPhotoAlbumArchived(ctx.user.id, input.albumId, input.isArchived)),
    touch: protectedProcedure.input(z.object({ albumId: z.number().int().positive() })).mutation(({ ctx, input }) => db.touchPhotoAlbum(ctx.user.id, input.albumId)),
    addTransform: protectedProcedure.input(z.object({ albumId: z.number().int().positive(), transformId: z.number().int().positive() })).mutation(({ ctx, input }) => db.addTransformToAlbum(ctx.user.id, input.albumId, input.transformId)),
    addTransforms: protectedProcedure.input(z.object({ albumId: z.number().int().positive(), transformIds: z.array(z.number().int().positive()).min(1).max(50) })).mutation(({ ctx, input }) => db.addTransformsToAlbum(ctx.user.id, input.albumId, input.transformIds)),
    removeTransform: protectedProcedure.input(z.object({ albumId: z.number().int().positive(), transformId: z.number().int().positive() })).mutation(({ ctx, input }) => db.removeTransformFromAlbum(ctx.user.id, input.albumId, input.transformId)),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => db.listUserNotifications(ctx.user.id)),
    detail: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).query(({ ctx, input }) => db.getUserNotificationDetail(ctx.user.id, input.notificationId)),
    preferences: protectedProcedure.query(({ ctx }) => db.getUserNotificationPreferences(ctx.user.id)),
    updatePreferences: protectedProcedure.input(z.object({ communityModeration: z.boolean(), accountActivity: z.boolean(), productUpdates: z.boolean() })).mutation(({ ctx, input }) => db.updateUserNotificationPreferences(ctx.user.id, input)),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(({ ctx, input }) => db.markUserNotificationRead(ctx.user.id, input.notificationId)),
    markAllRead: protectedProcedure.mutation(({ ctx }) => db.markAllUserNotificationsRead(ctx.user.id)),
  }),
  admin: router({
    dashboard: adminProcedure.query(() => db.getAdminDashboard()),
    trpcTransportTrend: adminProcedure.query(() => db.getTrpcTransportMetricTrend()),
    collaborationShareRoleLimits: adminProcedure.query(() => db.getCollaborationShareRoleLimits()),
    updateCollaborationShareRoleLimit: adminProcedure.input(z.object({ role: z.enum(["user", "admin"]), maxActiveLinks: z.number().int().min(0).max(100).nullable() })).mutation(({ input }) => db.updateCollaborationShareRoleLimit(input.role, input.maxActiveLinks)),
    activeCollaborationShareLinks: adminProcedure.query(() => db.listAdminActivePhotoCollaborationShareLinks()),
    revokeAllActiveCollaborationShareLinks: adminProcedure.input(z.object({ transformId: z.number().int().positive() })).mutation(({ input }) => db.revokeAllActivePhotoCollaborationShareLinks(input.transformId)),
    unlimitedAccessList: adminProcedure.input(z.object({ search: z.string().trim().max(320).optional(), access: z.enum(["all", "unlimited", "standard"]).default("all") }).optional()).query(({ input }) => db.listUnlimitedTransformUsers(input)),
    setUnlimitedAccess: adminProcedure.input(z.object({ email: z.string().trim().email().max(320), enabled: z.boolean() })).mutation(({ ctx, input }) => db.setUnlimitedTransformsByAdmin(ctx.user.id, input.email, input.enabled)),
    setUserRole: adminProcedure.input(z.object({ email: z.string().trim().email().max(320), role: z.enum(["user", "admin"]) })).mutation(({ ctx, input }) => db.setUserRoleByEmail(ctx.user.id, input.email, input.role)),
    accessAudits: adminProcedure.query(() => db.listAdminAccessAudits()),
    updateBrand: adminProcedure.input(z.object({ logo: brandImageInput.optional(), icon: brandImageInput.optional() }).refine((input) => input.logo || input.icon, { message: "Pilih logo atau ikon yang akan diperbarui." })).mutation(async ({ ctx, input }) => db.updateBrandSettings(ctx.user.id, { logoUrl: input.logo ? await storeBrandImage("logo", input.logo) : undefined, iconUrl: input.icon ? await storeBrandImage("icon", input.icon) : undefined })),
    collaborationResultReports: adminProcedure.query(() => db.listAdminPhotoCollaborationResultReports()),
    collaborationBrandBackgroundPresets: adminProcedure.query(() => db.listCollaborationBrandBackgroundPresets()),
    createCollaborationBrandBackgroundPreset: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(60), background: z.enum(["studio-ivory", "soft-gray", "charcoal", "cafe", "garden", "office"]), isActive: z.boolean().default(true) })).mutation(({ input }) => db.createCollaborationBrandBackgroundPreset(input)),
    updateCollaborationBrandBackgroundPreset: adminProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(60), background: z.enum(["studio-ivory", "soft-gray", "charcoal", "cafe", "garden", "office"]), isActive: z.boolean() })).mutation(({ input }) => { const { id, ...values } = input; return db.updateCollaborationBrandBackgroundPreset(id, values); }),
    globalWatermarkPresets: adminProcedure.query(() => db.listGlobalWatermarkPresets(false)),
    createGlobalWatermarkPreset: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(60), text: z.string().trim().min(1).max(72), position: z.enum(["top-left", "top-right", "center", "bottom-left", "bottom-right"]), size: z.number().int().min(2).max(10), font: z.enum(["sans", "serif", "mono"]), isActive: z.boolean().default(true) })).mutation(({ ctx, input }) => db.createGlobalWatermarkPreset(ctx.user.id, input)),
    updateGlobalWatermarkPreset: adminProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(60), text: z.string().trim().min(1).max(72), position: z.enum(["top-left", "top-right", "center", "bottom-left", "bottom-right"]), size: z.number().int().min(2).max(10), font: z.enum(["sans", "serif", "mono"]), isActive: z.boolean() })).mutation(({ ctx, input }) => { const { id, ...values } = input; return db.updateGlobalWatermarkPreset(ctx.user.id, id, values); }),
    reorderGlobalWatermarkPresets: adminProcedure.input(z.object({ presetIds: z.array(z.number().int().positive()).min(1).max(50).superRefine((ids, context) => { if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "ID preset tidak boleh berulang." }); }) })).mutation(({ ctx, input }) => db.reorderGlobalWatermarkPresets(ctx.user.id, input.presetIds)),
    globalWatermarkPresetAudits: adminProcedure.input(z.object({ search: z.string().trim().max(120).optional(), action: z.enum(["all", "created", "updated", "reordered"]).default("all") }).optional()).query(({ input }) => db.listGlobalWatermarkPresetAudits(input)),
    globalWatermarkPresetAuditSummary: adminProcedure.input(z.object({ search: z.string().trim().max(120).optional(), action: z.enum(["all", "created", "updated", "reordered"]).default("all") }).optional()).query(({ input }) => db.summarizeGlobalWatermarkPresetAudits(input)),
    seasonalCollections: adminProcedure.query(async () => ({ collections: await db.listAdminSeasonalRecipeCollections(), serverNow: new Date() })),
    createSeasonalCollection: adminProcedure.input(seasonalCollectionInput).mutation(({ input }) => db.createSeasonalRecipeCollection(input)),
    updateSeasonalCollection: adminProcedure.input(z.object({ id: z.number().int().positive() }).and(seasonalCollectionInput)).mutation(({ input }) => db.updateSeasonalRecipeCollection(input.id, input)),
    duplicateSeasonalCollection: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => db.duplicateSeasonalRecipeCollection(input.id)),
    manualCreditOrders: adminProcedure.input(z.object({ search: z.string().trim().max(320).optional(), status: z.enum(["all", "pending", "approved", "rejected"]).default("all") }).optional()).query(({ input }) => db.listAdminManualCreditOrders(input)),
    reviewManualCreditOrder: adminProcedure.input(z.object({ orderId: z.number().int().positive(), action: z.enum(["approve", "reject"]) })).mutation(({ ctx, input }) => db.reviewManualCreditOrder(input.orderId, ctx.user.id, input.action)),
    moderationList: adminProcedure.query(() => db.listCommunityPosts()),
    moderateDeletePost: adminProcedure.input(z.object({ postId: z.number().int().positive() })).mutation(({ input }) => db.moderateDeleteCommunityPost(input.postId)),
    reports: adminProcedure.query(() => db.listAdminCommunityReports()),
    resolveReport: adminProcedure.input(z.object({ reportId: z.number().int().positive(), action: z.enum(["dismiss", "remove_public"]) })).mutation(({ input }) => db.resolveCommunityReport(input.reportId, input.action)),
  }),
});

export type AppRouter = typeof appRouter;
