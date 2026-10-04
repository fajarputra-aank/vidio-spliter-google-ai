import { describe, expect, it } from "vitest";
import { getSmtpConfig, verifySmtpConnection } from "./smtp";

describe("SMTP credentials", () => {
  it("has a complete configuration and can authenticate with the configured SMTP provider", async () => {
    expect(getSmtpConfig()).toMatchObject({ host: "smtp.gmail.com", port: 587 });
    // GitHub Actions validates the shape with CI-only placeholders. A live SMTP
    // handshake is opt-in because it requires a real provider credential.
    if (process.env.CI === "true" && process.env.SMTP_LIVE_TEST !== "true") return;
    await expect(verifySmtpConnection()).resolves.toBe(true);
  }, 20_000);
});
