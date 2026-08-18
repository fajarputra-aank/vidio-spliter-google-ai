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

export async function sendPasswordChangedEmail(user: Pick<User, "email">) {
  if (!user.email) return false;
  await sendSecurityEmail({
    to: user.email,
    subject: "Kata sandi Lensa Saku telah diubah",
    heading: "Kata sandimu sudah diperbarui.",
    copy: "Kami mencatat perubahan kata sandi pada akunmu. Jika kamu tidak melakukannya, segera atur ulang kata sandi dan hubungi pengelola Lensa Saku.",
    actionLabel: "Tinjau keamanan akun",
    actionUrl: new URL("/pengaturan/profil", APP_ORIGIN).toString(),
  });
  return true;
}

export async function sendAccountLockedEmail(user: Pick<User, "email">) {
  if (!user.email) return false;
  await sendSecurityEmail({
    to: user.email,
    subject: "Akun Lensa Saku dikunci sementara",
    heading: "Kami mengunci akunmu sementara.",
    copy: "Terlalu banyak percobaan masuk gagal terdeteksi. Akun akan dapat dicoba lagi dalam 15 menit. Jika ini bukan kamu, ubah kata sandi setelah dapat masuk kembali.",
    actionLabel: "Amankan akun",
    actionUrl: new URL("/lupa-kata-sandi", APP_ORIGIN).toString(),
  });
  return true;
}

export async function sendNewDeviceLoginEmail(user: Pick<User, "email">, session: { deviceLabel: string; locationLabel: string }) {
  if (!user.email) return false;
  await sendSecurityEmail({
    to: user.email,
    subject: "Login baru terdeteksi di Lensa Saku",
    heading: "Kami mendeteksi perangkat atau lokasi baru.",
    copy: `Login baru terdeteksi dari ${session.deviceLabel} di sekitar ${session.locationLabel}. Jika ini bukan kamu, keluarkan perangkat tersebut atau ubah kata sandi segera.`,
    actionLabel: "Tinjau sesi aktif",
    actionUrl: new URL("/pengaturan/profil", APP_ORIGIN).toString(),
  });
  return true;
}

const securityEventLabels: Record<string, string> = {
  login: "Login berhasil",
  password_changed: "Kata sandi diubah",
  password_reset: "Kata sandi diatur ulang",
  account_locked: "Akun dikunci sementara",
  all_sessions_signed_out: "Semua perangkat dikeluarkan",
  session_signed_out: "Sesi perangkat dikeluarkan",
  new_device_login: "Login dari perangkat atau lokasi baru",
};

export async function sendSecuritySummaryEmail(user: Pick<User, "email">, events: Array<{ kind: string; createdAt: Date }>) {
  if (!user.email) return false;
  const activities = events.length ? events.slice(0, 12).map((event) => `${securityEventLabels[event.kind] ?? "Aktivitas keamanan"} · ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(event.createdAt)}`).join("\n") : "Tidak ada aktivitas keamanan yang tercatat dalam 7 hari terakhir.";
  await sendSecurityEmail({
    to: user.email,
    subject: "Ringkasan keamanan Lensa Saku",
    heading: "Ringkasan keamanan 7 hari terakhir.",
    copy: `Berikut aktivitas keamanan pada akunmu:\n\n${activities}`,
    actionLabel: "Tinjau keamanan akun",
    actionUrl: new URL("/pengaturan/profil", APP_ORIGIN).toString(),
  });
  return true;
}
