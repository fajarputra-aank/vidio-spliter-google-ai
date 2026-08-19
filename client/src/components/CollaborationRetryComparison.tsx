import { Columns2 } from "lucide-react";
import { MediaImage } from "@/components/MediaImage";
import { trpc } from "@/lib/trpc";

export function CollaborationRetryComparison({ transformId }: { transformId: number }) {
  const comparison = trpc.photo.collaborationComparison.useQuery({ transformId });
  if (!comparison.data) return null;
  return <section className="collaboration-retry-comparison"><header><Columns2 size={13} /><span>Perbandingan proses ulang</span></header><div><figure><MediaImage src={comparison.data.before.resultUrl} alt={`Hasil sebelum: ${comparison.data.before.title}`} /><figcaption>SEBELUM · frame #{comparison.data.before.id}</figcaption></figure><figure><MediaImage src={comparison.data.after.resultUrl} alt={`Hasil sesudah: ${comparison.data.after.title}`} /><figcaption>SESUDAH · frame #{comparison.data.after.id}</figcaption></figure></div><small>Kedua frame hanya ditampilkan melalui akses privat pemilik.</small></section>;
}
