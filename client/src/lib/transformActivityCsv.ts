export type TransformActivityCsvInput = {
  id: number;
  title: string;
  recipe: string;
  style: string;
  aspectRatio: string;
  status: "processing" | "completed" | "failed" | "cancelled";
  createdAt: Date | string;
  completedAt: Date | string | null;
  queuePosition: number | null;
  providerAttemptCount: number;
  autoRetryAt: Date | string | null;
  retryOfTransformId: number | null;
  retryInstruction: string | null;
};

type CsvRow = [string, string, string];

const csvEscape = (value: string | number | null | undefined) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function formatTimestamp(value: Date | string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

export function buildTransformActivityCsv(transform: TransformActivityCsvInput) {
  const rows: CsvRow[] = [
    ["Aktivitas", "Waktu", "Detail metadata"],
    ["Transformasi dibuat", formatTimestamp(transform.createdAt), `ID #${transform.id} · ${transform.title} · resep ${transform.recipe} · gaya ${transform.style} · rasio ${transform.aspectRatio}`],
  ];

  if (transform.queuePosition) rows.push(["Posisi antrean awal", formatTimestamp(transform.createdAt), `Perkiraan giliran #${transform.queuePosition}`]);
  if (transform.retryOfTransformId) rows.push(["Percobaan ulang manual", formatTimestamp(transform.createdAt), `Melanjutkan transformasi #${transform.retryOfTransformId}${transform.retryInstruction ? ` · catatan: ${transform.retryInstruction}` : ""}`]);
  if (transform.autoRetryAt) rows.push(["Percobaan ulang otomatis", formatTimestamp(transform.autoRetryAt), "Sistem mencoba ulang sekali setelah gangguan layanan sementara."]);
  if (transform.status === "completed") rows.push(["Transformasi selesai", formatTimestamp(transform.completedAt), `Selesai setelah ${transform.providerAttemptCount} percobaan layanan.`]);
  if (transform.status === "failed") rows.push(["Transformasi gagal", formatTimestamp(transform.completedAt), `Berakhir setelah ${transform.providerAttemptCount} percobaan layanan.`]);
  if (transform.status === "cancelled") rows.push(["Transformasi dibatalkan", formatTimestamp(transform.completedAt), "Proses dihentikan pemilik sebelum selesai."]);

  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}\r\n`;
}

export function downloadTransformActivityCsv(transform: TransformActivityCsvInput) {
  const blob = new Blob([buildTransformActivityCsv(transform)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aktivitas-transformasi-${transform.id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
