import { describe, expect, it } from "vitest";
import { describeDevice, formatCoarseLocation, isPublicIp } from "./sessionMetadata";

describe("session metadata", () => {
  it("derives a compact device label without retaining the raw user agent", () => {
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari/604.1")).toBe("iPhone · Safari");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0")).toBe("Windows · Chrome");
  });

  it("allows only public network addresses and keeps location at city/country precision", () => {
    expect(isPublicIp("192.168.1.2")).toBe(false);
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(formatCoarseLocation({ city: "Jakarta", country: "Indonesia" })).toBe("Jakarta, Indonesia");
    expect(formatCoarseLocation({ success: false })).toBe("Lokasi jaringan tidak tersedia");
  });
});
