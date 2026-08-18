import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { adminProcedure, protectedProcedure, publicProcedure, router, signedInProcedure } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import * as db from "./db";
import { aspectRatioIds, buildTransformPrompt, photoRecipes, recipeIds, styleIds } from "./photoPrompts";
import { storagePut } from "./storage";
import { creditPacks, getCreditPack } from "./creditProducts";
import { hasUnlimitedHdExports, hasUnlimitedTransforms } from "./accessPolicy";
import { recommendPhotoRecipe } from "./photoRecommendations";
import { hashLoginEmail, hashPassword, hashSecurityToken, normalizeEmail, validatePassword, validateRegistrationInput, verifyPassword } from "./localAuth";
import { sdk } from "./_core/sdk";
import { issueAccountEmail, sendAccountLockedEmail, sendPasswordChangedEmail } from "./accountEmails";
import { registerActiveSession } from "./sessionMetadata";

const imageInput = z.object({
  recipe: z.enum(recipeIds),
  aspectRatio: z.enum(aspectRatioIds),
  style: z.enum(styleIds),
  fileName: z.string().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sourceData: z.string().min(16).max(8_000_000),
  customInstruction: z.string().trim().min(3).max(360).optional(),
});

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120) || "photo";
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
      const sessionId = await registerActiveSession(user.id, sessionVersion, ctx.req);
      const token = await sdk.createSessionToken(user.id, { sessionVersion, sessionId });
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
      const sessionId = await registerActiveSession(user.id, sessionVersion, ctx.req);
      const token = await sdk.createSessionToken(user.id, { sessionVersion, sessionId });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 24 * 30 });
      await db.touchLocalSignIn(user.id);
      try { await db.recordUserSecurityEvent(user.id, "login"); } catch (error) { console.error("[Auth] Failed to record login security event", error); }
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
      const sessionId = await registerActiveSession(user.id, sessionVersion, ctx.req);
      const refreshedSession = await sdk.createSessionToken(user.id, { sessionVersion, sessionId });
      ctx.res.cookie(COOKIE_NAME, refreshedSession, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 24 * 30 });
      try { await db.recordUserSecurityEvent(user.id, "password_changed"); } catch (error) { console.error("[Auth] Failed to record password change event", error); }
      let emailNoticeSent = false;
      try { emailNoticeSent = await sendPasswordChangedEmail(user); } catch (error) { console.error("[Auth] Failed to send password-change email", error); }
      return { user, emailNoticeSent };
    }),
    securityHistory: protectedProcedure.query(({ ctx }) => db.listUserSecurityEvents(ctx.user.id)),
    activeSessions: protectedProcedure.query(async ({ ctx }) => (await db.listUserActiveSessions(ctx.user.id)).map(({ userId: _userId, ...session }) => ({ ...session, isCurrent: Boolean(ctx.sessionId && session.id === ctx.sessionId) }))),
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
    list: protectedProcedure.input(z.object({ includeHidden: z.boolean().optional() }).optional()).query(({ ctx, input }) => db.listPhotoTransforms(ctx.user.id, input?.includeHidden ?? false)),
    setHidden: protectedProcedure.input(z.object({ transformId: z.number().int().positive(), isHidden: z.boolean() })).mutation(({ ctx, input }) => db.setPhotoTransformHidden(ctx.user.id, input.transformId, input.isHidden)),
    quota: protectedProcedure.query(async ({ ctx }) => ({ ...(await db.getDailyPhotoQuota(ctx.user.id)), isUnlimited: hasUnlimitedTransforms(ctx.user) })),
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
        return { resultUrl: record.resultUrl, charged: false };
      }
      const result = await db.consumeHdExportCredit(ctx.user.id, input.transformId);
      if (!result.ok) throw new TRPCError({ code: result.reason === "no_credit" ? "TOO_MANY_REQUESTS" : "NOT_FOUND", message: result.reason === "no_credit" ? "Kredit tidak cukup untuk unduhan HD." : "Hasil HD belum tersedia." });
      return { resultUrl: result.resultUrl, charged: true };
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
      try {
        const source = await storagePut(`originals/${ctx.user.id}/${Date.now()}-${safeFileName(input.fileName)}`, sourceBuffer, input.mimeType);
        const transform = await db.createPhotoTransform({ userId: ctx.user.id, recipe: input.recipe, aspectRatio: input.aspectRatio, style: input.style, title: photoRecipes[input.recipe].title, sourceKey: source.key, sourceUrl: source.url, status: "processing" });
        transformId = transform.id;
        const result = await generateImage({
          prompt: buildTransformPrompt(input.recipe, input.aspectRatio, input.style, input.customInstruction),
          originalImages: [{ b64Json: input.sourceData, mimeType: input.mimeType }],
          quality: "medium",
        });
        if (!result.url) throw new Error("Layanan AI tidak mengembalikan gambar hasil.");
        return await db.completePhotoTransform(transform.id, result.url);
      } catch (error) {
        if (usedPurchasedCredit) await db.refundPurchasedCredit(ctx.user.id);
        const message = error instanceof Error ? error.message : "Transformasi AI gagal diproses.";
        if (transformId) await db.failPhotoTransform(transformId, message);
        console.error("[Photo] Transform failed", message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Transformasi belum berhasil. Coba lagi beberapa saat." });
      }
    }),
  }),
  promptFavorites: router({
    list: protectedProcedure.query(({ ctx }) => db.listPhotoPromptFavorites(ctx.user.id)),
    create: protectedProcedure.input(z.object({ instruction: z.string().trim().min(3).max(360) })).mutation(({ ctx, input }) => db.createPhotoPromptFavorite(ctx.user.id, input.instruction)),
    delete: protectedProcedure.input(z.object({ favoriteId: z.number().int().positive() })).mutation(({ ctx, input }) => db.deletePhotoPromptFavorite(ctx.user.id, input.favoriteId)),
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
    list: protectedProcedure.query(({ ctx }) => db.listPhotoAlbums(ctx.user.id)),
    listArchived: protectedProcedure.query(({ ctx }) => db.listArchivedPhotoAlbums(ctx.user.id)),
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
    unlimitedAccessList: adminProcedure.input(z.object({ search: z.string().trim().max(320).optional(), access: z.enum(["all", "unlimited", "standard"]).default("all") }).optional()).query(({ input }) => db.listUnlimitedTransformUsers(input)),
    setUnlimitedAccess: adminProcedure.input(z.object({ email: z.string().trim().email().max(320), enabled: z.boolean() })).mutation(({ ctx, input }) => db.setUnlimitedTransformsByAdmin(ctx.user.id, input.email, input.enabled)),
    setUserRole: adminProcedure.input(z.object({ email: z.string().trim().email().max(320), role: z.enum(["user", "admin"]) })).mutation(({ ctx, input }) => db.setUserRoleByEmail(ctx.user.id, input.email, input.role)),
    accessAudits: adminProcedure.query(() => db.listAdminAccessAudits()),
    updateBrand: adminProcedure.input(z.object({ logo: brandImageInput.optional(), icon: brandImageInput.optional() }).refine((input) => input.logo || input.icon, { message: "Pilih logo atau ikon yang akan diperbarui." })).mutation(async ({ ctx, input }) => db.updateBrandSettings(ctx.user.id, { logoUrl: input.logo ? await storeBrandImage("logo", input.logo) : undefined, iconUrl: input.icon ? await storeBrandImage("icon", input.icon) : undefined })),
    manualCreditOrders: adminProcedure.input(z.object({ search: z.string().trim().max(320).optional(), status: z.enum(["all", "pending", "approved", "rejected"]).default("all") }).optional()).query(({ input }) => db.listAdminManualCreditOrders(input)),
    reviewManualCreditOrder: adminProcedure.input(z.object({ orderId: z.number().int().positive(), action: z.enum(["approve", "reject"]) })).mutation(({ ctx, input }) => db.reviewManualCreditOrder(input.orderId, ctx.user.id, input.action)),
    moderationList: adminProcedure.query(() => db.listCommunityPosts()),
    moderateDeletePost: adminProcedure.input(z.object({ postId: z.number().int().positive() })).mutation(({ input }) => db.moderateDeleteCommunityPost(input.postId)),
    reports: adminProcedure.query(() => db.listAdminCommunityReports()),
    resolveReport: adminProcedure.input(z.object({ reportId: z.number().int().positive(), action: z.enum(["dismiss", "remove_public"]) })).mutation(({ input }) => db.resolveCommunityReport(input.reportId, input.action)),
  }),
});

export type AppRouter = typeof appRouter;
