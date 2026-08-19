export type TransformFailure = {
  code: "AI_QUOTA_EXHAUSTED" | "TRANSFORM_UNAVAILABLE";
  message: string;
};

export function toSafeTransformFailure(error: unknown): TransformFailure {
  const source = error instanceof Error ? error.message : String(error ?? "");
  if (/usage exhausted|failed_precondition|rate limit|quota/i.test(source)) {
    return {
      code: "AI_QUOTA_EXHAUSTED",
      message: "Layanan AI sedang mencapai batas penggunaan hari ini. Foto sumbermu sudah tersimpan aman; silakan coba kembali setelah kuota tersedia.",
    };
  }
  return {
    code: "TRANSFORM_UNAVAILABLE",
    message: "Transformasi belum berhasil diproses. Foto sumbermu tetap aman di riwayat; coba lagi beberapa saat.",
  };
}
