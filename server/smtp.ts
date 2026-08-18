import nodemailer from "nodemailer";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

export function getSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig {
  const host = env.SMTP_HOST?.trim();
  const port = Number(env.SMTP_PORT);
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.trim();
  const from = env.SMTP_FROM?.trim();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass || !from) {
    throw new Error("Konfigurasi SMTP belum lengkap.");
  }
  return { host, port, user, pass, from };
}

export function createSmtpTransport(config = getSmtpConfig()) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    requireTLS: config.port !== 465,
  });
}

export async function verifySmtpConnection(): Promise<true> {
  await createSmtpTransport().verify();
  return true;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function sendSecurityEmail(input: { to: string; subject: string; heading: string; copy: string; actionLabel: string; actionUrl: string }) {
  const config = getSmtpConfig();
  const safeHeading = escapeHtml(input.heading);
  const safeCopy = escapeHtml(input.copy);
  const safeActionLabel = escapeHtml(input.actionLabel);
  const safeActionUrl = escapeHtml(input.actionUrl);
  await createSmtpTransport(config).sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    text: `${input.heading}\n\n${input.copy}\n\n${input.actionLabel}: ${input.actionUrl}\n\nJika Anda tidak meminta email ini, abaikan saja.`,
    html: `<main style="font-family:Arial,sans-serif;color:#1b1b18;max-width:560px;margin:0 auto;padding:28px"><p style="color:#8b5740;font-size:12px;letter-spacing:1.4px;font-weight:700">LENSA SAKU · KEAMANAN AKUN</p><h1 style="font-family:Georgia,serif;font-weight:400">${safeHeading}</h1><p style="line-height:1.6">${safeCopy}</p><p style="margin:26px 0"><a href="${safeActionUrl}" style="display:inline-block;padding:14px 18px;background:#ef8f2f;color:#261a10;text-decoration:none;font-weight:700">${safeActionLabel}</a></p><p style="font-size:12px;color:#6c655b;line-height:1.55">Jika Anda tidak meminta email ini, abaikan saja.</p></main>`,
  });
}
