import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import * as db from "./db";
import { aspectRatioIds, buildTransformPrompt, photoRecipes, recipeIds, styleIds } from "./photoPrompts";
import { storagePut } from "./storage";
import { creditPacks, getCreditPack } from "./creditProducts";
import { getStripe } from "./stripe";
import { hasUnlimitedTransforms } from "./accessPolicy";

const imageInput = z.object({
  recipe: z.enum(recipeIds),
  aspectRatio: z.enum(aspectRatioIds),
  style: z.enum(styleIds),
  fileName: z.string().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sourceData: z.string().min(16).max(8_000_000),
});

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120) || "photo";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  photo: router({
    list: protectedProcedure.input(z.object({ includeHidden: z.boolean().optional() }).optional()).query(({ ctx, input }) => db.listPhotoTransforms(ctx.user.id, input?.includeHidden ?? false)),
    setHidden: protectedProcedure.input(z.object({ transformId: z.number().int().positive(), isHidden: z.boolean() })).mutation(({ ctx, input }) => db.setPhotoTransformHidden(ctx.user.id, input.transformId, input.isHidden)),
    quota: protectedProcedure.query(async ({ ctx }) => ({ ...(await db.getDailyPhotoQuota(ctx.user.id)), isUnlimited: hasUnlimitedTransforms(ctx.user.role) })),
    profile: protectedProcedure.query(async ({ ctx }) => ({
      user: { name: ctx.user.name, email: ctx.user.email, role: ctx.user.role, createdAt: ctx.user.createdAt },
      ...(await db.getPhotoProfileSummary(ctx.user.id)),
    })),
    hdExport: protectedProcedure.input(z.object({ transformId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (hasUnlimitedTransforms(ctx.user.role)) {
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
      if (quota.exhausted && !hasUnlimitedTransforms(ctx.user.role)) {
        usedPurchasedCredit = await db.consumePurchasedCredit(ctx.user.id);
        if (!usedPurchasedCredit) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Kuota harian dan kredit tambahanmu sudah habis. Tambahkan kredit untuk lanjut meracik." });
      }
      try {
        const source = await storagePut(`originals/${ctx.user.id}/${Date.now()}-${safeFileName(input.fileName)}`, sourceBuffer, input.mimeType);
        const transform = await db.createPhotoTransform({ userId: ctx.user.id, recipe: input.recipe, aspectRatio: input.aspectRatio, style: input.style, title: photoRecipes[input.recipe].title, sourceKey: source.key, sourceUrl: source.url, status: "processing" });
        transformId = transform.id;
        const result = await generateImage({
          prompt: buildTransformPrompt(input.recipe, input.aspectRatio, input.style),
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
  billing: router({
    packs: publicProcedure.query(() => Object.values(creditPacks)),
    balance: protectedProcedure.query(async ({ ctx }) => ({ credits: await db.getCreditBalance(ctx.user.id), purchases: await db.listCreditPurchases(ctx.user.id) })),
    checkout: protectedProcedure.input(z.object({ packId: z.enum(["starter", "studio", "archive"]) })).mutation(async ({ ctx, input }) => {
      const pack = getCreditPack(input.packId);
      if (!pack) throw new TRPCError({ code: "NOT_FOUND", message: "Paket kredit tidak ditemukan." });
      const origin = (ctx.req.headers.origin as string | undefined) ?? `${ctx.req.protocol}://${ctx.req.get("host")}`;
      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        client_reference_id: String(ctx.user.id),
        customer_email: ctx.user.email ?? undefined,
        allow_promotion_codes: true,
        success_url: `${origin}/profil?checkout=success`,
        cancel_url: `${origin}/profil?checkout=cancelled`,
        metadata: { user_id: String(ctx.user.id), pack_id: pack.id, customer_email: ctx.user.email ?? "", customer_name: ctx.user.name ?? "" },
        line_items: [{ price_data: { currency: pack.currency, product_data: { name: `${pack.title} — ${pack.credits} Kredit Lensa Saku` }, unit_amount: pack.unitAmount }, quantity: 1 }],
      });
      if (!session.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Checkout belum dapat dibuat." });
      return { checkoutUrl: session.url };
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
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(80) })).mutation(({ ctx, input }) => db.createPhotoAlbum(ctx.user.id, input.name)),
    addTransform: protectedProcedure.input(z.object({ albumId: z.number().int().positive(), transformId: z.number().int().positive() })).mutation(({ ctx, input }) => db.addTransformToAlbum(ctx.user.id, input.albumId, input.transformId)),
    removeTransform: protectedProcedure.input(z.object({ albumId: z.number().int().positive(), transformId: z.number().int().positive() })).mutation(({ ctx, input }) => db.removeTransformFromAlbum(ctx.user.id, input.albumId, input.transformId)),
  }),
  admin: router({
    dashboard: adminProcedure.query(() => db.getAdminDashboard()),
    moderationList: adminProcedure.query(() => db.listCommunityPosts()),
    moderateDeletePost: adminProcedure.input(z.object({ postId: z.number().int().positive() })).mutation(({ input }) => db.moderateDeleteCommunityPost(input.postId)),
    reports: adminProcedure.query(() => db.listAdminCommunityReports()),
    resolveReport: adminProcedure.input(z.object({ reportId: z.number().int().positive(), action: z.enum(["dismiss", "remove_public"]) })).mutation(({ input }) => db.resolveCommunityReport(input.reportId, input.action)),
  }),
});

export type AppRouter = typeof appRouter;
