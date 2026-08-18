import type { User } from "../drizzle/schema";
import * as db from "./db";
import { createSecurityToken } from "./localAuth";
import { sendSecurityEmail } from "./smtp";

const APP_ORIGIN = "https://mantrafoto-zglha5ua.manus.space";
const PURPOSE_CONFIG = {
  email_verification: { path: "/verifikasi-email", ttlMs: 24 * 60 * 60 * 1000, subject: "Verifikasi email Lensa Saku", heading: "Verifikasi alamat emailmu.", copy: "Konfirmasikan alamat email ini untuk membuka studio privat Lensa Saku.", actionLabel: "Verifikasi email" },
  password_reset: { path: "/reset-kata-sandi", ttlMs: 20 * 60 * 1000, subject: "Atur ulang kata sandi Lensa Saku", heading: "Atur ulang kata sandimu.", copy: "Gunakan tautan ini untuk membuat kata sandi baru. Tautan akan kedaluwarsa dalam 20 menit.", actionLabel: "Atur ulang kata sandi" },
} as const;

export type AccountEmailPurpose = keyof typeof PURPOSE_CONFIG;

export function buildAccountActionUrl(path: string, token: string) {
  const url = new URL(path, APP_ORIGIN);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function issueAccountEmail(user: Pick<User, "id" | "email">, purpose: AccountEmailPurpose) {
  if (!user.email) return false;
  const config = PURPOSE_CONFIG[purpose];
  const { token, tokenHash } = createSecurityToken();
  const created = await db.createAuthEmailToken({ userId: user.id, purpose, tokenHash, expiresAt: new Date(Date.now() + config.ttlMs) });
  if (!created) return false;
  await sendSecurityEmail({ to: user.email, subject: config.subject, heading: config.heading, copy: config.copy, actionLabel: config.actionLabel, actionUrl: buildAccountActionUrl(config.path, token) });
  return true;
}
