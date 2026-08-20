import { describe, expect, it } from "vitest";
import { aiQuotaRetryEstimate, toSafeTransformFailure } from "./transformFailureMessages";

describe("toSafeTransformFailure", () => {
  it("does not expose a provider quota error to the gallery", () => {
    expect(toSafeTransformFailure(new Error('Image generation request failed (400): {"code":"failed_precondition","message":"your account has hit a usage exhausted"}'), new Date("2026-08-19T02:00:00.000Z"))).toEqual({
      code: "AI_QUOTA_EXHAUSTED",
      message: "Kapasitas penyedia AI sedang penuh hari ini. Akses Kolaborasi tanpa batas di Lensa Saku tetap aktif; kapasitas eksternal ini tidak dapat dilewati dari aplikasi. Foto sumbermu sudah tersimpan aman. Perkiraan dapat dicoba kembali sekitar 20 Agu 2026, 07:00 WIB; waktu pembaruan penyedia dapat berubah.",
    });
  });

  it("uses a safe fallback for unexpected provider errors", () => {
    expect(toSafeTransformFailure(new Error("upstream diagnostic token=private"))).toEqual({
      code: "TRANSFORM_UNAVAILABLE",
      message: "Transformasi belum berhasil diproses. Foto sumbermu tetap aman di riwayat; coba lagi beberapa saat.",
    });
  });

  it("uses the following UTC day as an estimate in Western Indonesia time", () => {
    expect(aiQuotaRetryEstimate(new Date("2026-08-19T02:00:00.000Z"))).toBe("20 Agu 2026, 07:00");
  });
});
