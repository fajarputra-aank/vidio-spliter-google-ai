export type TransformFailure = {
  code: "AI_QUOTA_EXHAUSTED" | "TRANSFORM_UNAVAILABLE";
  message: string;
};

export function aiQuotaRetryEstimate(now = new Date()) {
  const nextUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(nextUtcMidnight).replace(".", ":");
}

export function toSafeTransformFailure(error: unknown, now = new Date()): TransformFailure {
  const source = error instanceof Error ? error.message : String(error ?? "");
  if (/usage exhausted|failed_precondition|rate limit|quota/i.test(source)) {
    return {
      code: "AI_QUOTA_EXHAUSTED",
      message: `Kapasitas penyedia AI sedang penuh hari ini. Akses Kolaborasi tanpa batas di Lensa Saku tetap aktif; kapasitas eksternal ini tidak dapat dilewati dari aplikasi. Foto sumbermu sudah tersimpan aman. Perkiraan dapat dicoba kembali sekitar ${aiQuotaRetryEstimate(now)} WIB; waktu pembaruan penyedia dapat berubah.`,
    };
  }
  return {
    code: "TRANSFORM_UNAVAILABLE",
    message: "Transformasi belum berhasil diproses. Foto sumbermu tetap aman di riwayat; coba lagi beberapa saat.",
  };
}
