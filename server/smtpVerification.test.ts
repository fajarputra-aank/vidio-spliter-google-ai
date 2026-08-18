import { describe, expect, it } from "vitest";
import { getSmtpConfig, verifySmtpConnection } from "./smtp";

describe("SMTP credentials", () => {
  it("has a complete configuration and can authenticate with the configured SMTP provider", async () => {
    expect(getSmtpConfig()).toMatchObject({ host: "smtp.gmail.com", port: 587 });
    await expect(verifySmtpConnection()).resolves.toBe(true);
  }, 20_000);
});
