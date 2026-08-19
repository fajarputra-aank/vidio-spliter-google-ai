import { describe, expect, it } from "vitest";
import { toSafeTransformFailure } from "./transformFailureMessages";

describe("toSafeTransformFailure", () => {
  it("does not expose a provider quota error to the gallery", () => {
    expect(toSafeTransformFailure(new Error('Image generation request failed (400): {"code":"failed_precondition","message":"your account has hit a usage exhausted"}'))).toEqual({
      code: "AI_QUOTA_EXHAUSTED",
      message: "Layanan AI sedang mencapai batas penggunaan hari ini. Foto sumbermu sudah tersimpan aman; silakan coba kembali setelah kuota tersedia.",
    });
  });

  it("uses a safe fallback for unexpected provider errors", () => {
    expect(toSafeTransformFailure(new Error("upstream diagnostic token=private"))).toEqual({
      code: "TRANSFORM_UNAVAILABLE",
      message: "Transformasi belum berhasil diproses. Foto sumbermu tetap aman di riwayat; coba lagi beberapa saat.",
    });
  });
});
