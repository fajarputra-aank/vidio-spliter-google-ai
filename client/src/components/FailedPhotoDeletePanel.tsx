import React from "react";
import { Trash2 } from "lucide-react";
import { DeletePhotoResultControl } from "@/components/DeletePhotoResultControl";

type FailedTransform = { id: number; title: string; createdAt: Date | string; errorMessage?: string | null };

export function FailedPhotoDeletePanel({ items, formatDate }: { items: FailedTransform[]; formatDate: (value: Date | string) => string }) {
  if (!items.length) return null;
  return <section className="failed-delete-desk" aria-label="Hapus transformasi gagal"><div className="failed-delete-heading"><div><span className="eyebrow">BERSIHKAN RIWAYAT GAGAL</span><h2>Hapus proses yang<br /><em>tidak selesai.</em></h2><p>Hanya proses yang gagal ditampilkan di sini. Menghapusnya tidak memengaruhi foto atau hasil lain yang berhasil.</p></div><span><Trash2 size={13} /> {items.length} proses gagal</span></div><div className="failed-delete-list">{items.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>{formatDate(item.createdAt)} · {item.errorMessage || "Transformasi tidak selesai."}</small></div><DeletePhotoResultControl transformId={item.id} className="failed-delete-trigger" /></article>)}</div></section>;
}
