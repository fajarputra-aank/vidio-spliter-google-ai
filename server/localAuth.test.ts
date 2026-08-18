import { describe, expect, it } from "vitest";
import { createSecurityToken, hashLoginEmail, hashPassword, hashSecurityToken, LOGIN_FAILURE_LIMIT, LOGIN_LOCK_MS, nextLoginAttempt, normalizeEmail, validateRegistrationInput, verifyPassword } from "./localAuth";

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

  it("creates opaque tokens while persisting only their stable hash", () => {
    const created = createSecurityToken();
    expect(created.token).toHaveLength(43);
    expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSecurityToken(created.token)).toBe(created.tokenHash);
    expect(hashLoginEmail(" USER@EXAMPLE.COM ")).toBe(hashLoginEmail("user@example.com"));
  });

  it("locks a repeated failed login after the configured short window", () => {
    const started = new Date("2026-08-18T00:00:00.000Z");
    let attempt = undefined as ReturnType<typeof nextLoginAttempt> | undefined;
    for (let count = 0; count < LOGIN_FAILURE_LIMIT; count += 1) attempt = nextLoginAttempt(attempt, new Date(started.getTime() + count * 1000));
    expect(attempt?.failedCount).toBe(LOGIN_FAILURE_LIMIT);
    expect(attempt?.lockedUntil?.getTime()).toBe(started.getTime() + (LOGIN_FAILURE_LIMIT - 1) * 1000 + LOGIN_LOCK_MS);
    const outsideWindow = nextLoginAttempt({ failedCount: 4, windowStartedAt: started, lockedUntil: null }, new Date(started.getTime() + 16 * 60 * 1000));
    expect(outsideWindow).toMatchObject({ failedCount: 1, lockedUntil: null });
  });
});
