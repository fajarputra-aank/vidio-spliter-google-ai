import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireSignedInUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const signedInProcedure = t.procedure.use(requireSignedInUser);

const requirePasswordChangeCompletion = t.middleware(async opts => {
  if (!opts.ctx.user || opts.ctx.user.mustChangePassword) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ganti kata sandi sementara sebelum memakai studio." });
  }
  return opts.next();
});

const requireVerifiedEmail = t.middleware(async opts => {
  if (!opts.ctx.user || opts.ctx.user.emailVerifiedAt === null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Verifikasi email sebelum memakai studio." });
  }
  return opts.next();
});

export const protectedProcedure = signedInProcedure.use(requirePasswordChangeCompletion).use(requireVerifiedEmail);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin' || ctx.user.mustChangePassword || ctx.user.emailVerifiedAt === null) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
