import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import * as db from "./db";
import { aspectRatioIds, buildTransformPrompt, photoRecipes, recipeIds } from "./photoPrompts";
import { storagePut } from "./storage";

const imageInput = z.object({
  recipe: z.enum(recipeIds),
  aspectRatio: z.enum(aspectRatioIds),
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
    list: protectedProcedure.query(({ ctx }) => db.listPhotoTransforms(ctx.user.id)),
    quota: protectedProcedure.query(({ ctx }) => db.getDailyPhotoQuota(ctx.user.id)),
    transform: protectedProcedure.input(imageInput).mutation(async ({ ctx, input }) => {
      const quota = await db.getDailyPhotoQuota(ctx.user.id);
      if (quota.exhausted) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Kuota 5 transformasi untuk hari ini sudah habis. Coba lagi setelah kuota diperbarui." });
      }
      const sourceBuffer = Buffer.from(input.sourceData, "base64");
      if (!sourceBuffer.length || sourceBuffer.length > 5_500_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ukuran foto harus maksimal 5 MB." });
      }

      const source = await storagePut(
        `originals/${ctx.user.id}/${Date.now()}-${safeFileName(input.fileName)}`,
        sourceBuffer,
        input.mimeType
      );
      const transform = await db.createPhotoTransform({
        userId: ctx.user.id,
        recipe: input.recipe,
        aspectRatio: input.aspectRatio,
        title: photoRecipes[input.recipe].title,
        sourceKey: source.key,
        sourceUrl: source.url,
        status: "processing",
      });

      try {
        const result = await generateImage({
          prompt: buildTransformPrompt(input.recipe, input.aspectRatio),
          originalImages: [{ b64Json: input.sourceData, mimeType: input.mimeType }],
          quality: "medium",
        });
        if (!result.url) throw new Error("Layanan AI tidak mengembalikan gambar hasil.");
        return await db.completePhotoTransform(transform.id, result.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Transformasi AI gagal diproses.";
        await db.failPhotoTransform(transform.id, message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Transformasi belum berhasil. Coba lagi beberapa saat." });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
