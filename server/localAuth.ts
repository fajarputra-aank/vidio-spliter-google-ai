import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const HASH_PREFIX = "scrypt";
const PASSWORD_MIN_LENGTH = 12;

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
