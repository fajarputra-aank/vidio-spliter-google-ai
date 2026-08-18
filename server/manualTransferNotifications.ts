export function getManualTransferNotification(action: "approve" | "reject", credits: number) {
  return action === "approve"
    ? { title: "Transfer BCA disetujui", content: `${credits} kredit telah ditambahkan setelah bukti transfer diverifikasi.` }
    : { title: "Transfer BCA ditolak", content: "Bukti transfer belum dapat diverifikasi. Silakan hubungi admin bila diperlukan." };
}
