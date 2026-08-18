import { describe, expect, it } from "vitest";
import { buildAccountActionUrl } from "./accountEmails";

describe("account security email links", () => {
  it("creates an absolute HTTPS link with a single encoded token", () => {
    const url = new URL(buildAccountActionUrl("/reset-kata-sandi", "opaque_token-123"));
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toBe("/reset-kata-sandi");
    expect(url.searchParams.get("token")).toBe("opaque_token-123");
  });
});
