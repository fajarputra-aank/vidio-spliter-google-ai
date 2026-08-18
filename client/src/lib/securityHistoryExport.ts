export type SecurityHistoryExportEvent = { kind: string; createdAt: Date | string };

const labels: Record<string, string> = {
  login: "Login berhasil",
  password_changed: "Kata sandi diubah",
  password_reset: "Kata sandi diatur ulang",
  account_locked: "Akun dikunci sementara",
  all_sessions_signed_out: "Semua perangkat dikeluarkan",
  session_signed_out: "Sesi perangkat dikeluarkan",
  new_device_login: "Login perangkat atau lokasi baru",
};

export function securityEventLabel(kind: string) {
  return labels[kind] ?? "Aktivitas keamanan";
}

export function formatSecurityEventDate(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildSecurityHistoryCsv(events: SecurityHistoryExportEvent[]) {
  const rows = ["Waktu,Jenis aktivitas", ...events.map((event) => `${escapeCsv(formatSecurityEventDate(event.createdAt))},${escapeCsv(securityEventLabel(event.kind))}`)];
  return `\uFEFF${rows.join("\r\n")}`;
}

function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function downloadSecurityHistoryCsv(events: SecurityHistoryExportEvent[]) {
  saveBlob(new Blob([buildSecurityHistoryCsv(events)], { type: "text/csv;charset=utf-8" }), "riwayat-keamanan-lensa-saku.csv");
}

export async function downloadSecurityHistoryPdf(events: SecurityHistoryExportEvent[]) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Riwayat Keamanan Lensa Saku", 48, 56);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Ekspor privat — tidak memuat kata sandi, alamat IP, atau koordinat.", 48, 76);
  let y = 106;
  for (const event of events) {
    if (y > 760) { pdf.addPage(); y = 56; }
    pdf.setFont("helvetica", "bold");
    pdf.text(securityEventLabel(event.kind), 48, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(formatSecurityEventDate(event.createdAt), 48, y + 15);
    y += 38;
  }
  if (!events.length) pdf.text("Belum ada aktivitas keamanan yang tercatat.", 48, y);
  pdf.save("riwayat-keamanan-lensa-saku.pdf");
}
