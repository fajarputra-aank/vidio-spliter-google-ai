import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const HASH_PREFIX = "scrypt";
const PASSWORD_MIN_LENGTH = 12;
export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function validateRegistrationInput(name: string, email: string, password: string) {
  const normalizedName = name.trim().replace(/\s+/g, " ");
  const normalizedEmail = normalizeEmail(email);
  if (normalizedName.length < 2 || normalizedName.length > 80) throw new Error("Nama harus terdiri dari 2–80 karakter.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 320) throw new Error("Masukkan alamat email yang valid.");
  validatePassword(password);
  return { name: normalizedName, email: normalizedEmail };
}

export function validatePassword(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > 128) throw new Error("Kata sandi harus terdiri dari 12–128 karakter.");
}

export function hashSecurityToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createSecurityToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashSecurityToken(token) };
}

export function hashLoginEmail(email: string) {
  return hashSecurityToken(normalizeEmail(email));
}

export function nextLoginAttempt(existing: { failedCount: number; windowStartedAt: Date; lockedUntil: Date | null } | undefined, now = new Date()) {
  if (!existing) return { failedCount: 1, windowStartedAt: now, lockedUntil: null as Date | null };
  if (existing.lockedUntil && existing.lockedUntil > now) return { failedCount: existing.failedCount, windowStartedAt: existing.windowStartedAt, lockedUntil: existing.lockedUntil };
  const inWindow = now.getTime() - existing.windowStartedAt.getTime() < LOGIN_FAILURE_WINDOW_MS;
  const failedCount = inWindow ? existing.failedCount + 1 : 1;
  return { failedCount, windowStartedAt: inWindow ? existing.windowStartedAt : now, lockedUntil: failedCount >= LOGIN_FAILURE_LIMIT ? new Date(now.getTime() + LOGIN_LOCK_MS) : null as Date | null };
}

export async function hashPassword(password: string) {
  validatePassword(password);
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${HASH_PREFIX}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, serializedHash: string | null | undefined) {
  if (!serializedHash) return false;
  const [prefix, encodedSalt, encodedHash] = serializedHash.split("$");
  if (prefix !== HASH_PREFIX || !encodedSalt || !encodedHash) return false;
  try {
    const expected = Buffer.from(encodedHash, "base64url");
    const actual = (await scrypt(password, Buffer.from(encodedSalt, "base64url"), expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
