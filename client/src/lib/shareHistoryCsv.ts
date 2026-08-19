type ShareHistoryRow = { id: number; transformId: number; platform: string; caption: string; watermarkText: string | null; outcome: string; createdAt: Date | string };

const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function formatShareHistoryCsv(rows: ShareHistoryRow[]) {
  const header = ["ID", "ID transformasi", "Platform", "Caption", "Watermark", "Hasil tindakan", "Waktu"].map(quote).join(",");
  return [header, ...rows.map((row) => [row.id, row.transformId, row.platform, row.caption, row.watermarkText, row.outcome, new Date(row.createdAt).toISOString()].map(quote).join(","))].join("\r\n");
}

export function downloadShareHistoryCsv(rows: ShareHistoryRow[], transformId: number) {
  const blob = new Blob(["\ufeff", formatShareHistoryCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `lensa-saku-riwayat-berbagi-${transformId}.csv`; link.click(); URL.revokeObjectURL(url);
}
