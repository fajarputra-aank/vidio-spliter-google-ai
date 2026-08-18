import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, validateRegistrationInput, verifyPassword } from "./localAuth";

describe("local authentication helpers", () => {
  it("normalizes email and accepts a valid local registration", () => {
    expect(validateRegistrationInput("  Fajar   Putra ", " FAJAR@EXAMPLE.COM ", "kata-sandi-yang-aman")).toEqual({ name: "Fajar Putra", email: "fajar@example.com" });
    expect(normalizeEmail(" User@Example.COM ")).toBe("user@example.com");
  });

  it("rejects passwords shorter than the application policy", () => {
    expect(() => validateRegistrationInput("Fajar", "fajar@example.com", "kurangaman")).toThrow("12–128");
  });

  it("stores only a salted derived password and verifies it safely", async () => {
    const first = await hashPassword("kata-sandi-yang-aman");
    const second = await hashPassword("kata-sandi-yang-aman");
    expect(first).toMatch(/^scrypt\$/);
    expect(first).not.toBe(second);
    await expect(verifyPassword("kata-sandi-yang-aman", first)).resolves.toBe(true);
    await expect(verifyPassword("kata-sandi-salah", first)).resolves.toBe(false);
  });
});
