import { Columns2 } from "lucide-react";
import { useState } from "react";
import { MediaImage } from "@/components/MediaImage";
import { trpc } from "@/lib/trpc";

export function CollaborationRetryComparison({ transformId }: { transformId: number }) {
  const [open, setOpen] = useState(false);
  const comparison = trpc.photo.collaborationComparison.useQuery({ transformId }, { enabled: open });
  return <section className="collaboration-retry-comparison"><button type="button" onClick={() => setOpen((value) => !value)}><Columns2 size={13} /> {open ? "Tutup perbandingan evaluasi" : "Bandingkan versi proses ulang"}</button>{open && comparison.data ? <><header><Columns2 size={13} /><span>Evaluasi privat proses ulang</span></header><div><figure><MediaImage src={comparison.data.before.resultUrl} alt={`Hasil sebelum: ${comparison.data.before.title}`} /><figcaption>VERSI SEBELUM · frame #{comparison.data.before.id}</figcaption></figure><figure><MediaImage src={comparison.data.after.resultUrl} alt={`Hasil sesudah: ${comparison.data.after.title}`} /><figcaption>VERSI SESUDAH · frame #{comparison.data.after.id}</figcaption></figure></div><small>Perbandingan ini hanya alat evaluasi privat. Hasil Kolaborasi utamamu tetap satu foto pasangan final.</small></> : open && comparison.isLoading ? <small>Menyiapkan perbandingan privat…</small> : null}</section>;
}
