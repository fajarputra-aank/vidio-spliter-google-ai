import { downloadShareHistoryCsv } from "@/lib/shareHistoryCsv";
import { trpc } from "@/lib/trpc";
import { FileDown, LoaderCircle } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

export function CombinedShareHistoryExport({ transformIds }: { transformIds: number[] }) {
  const input = useMemo(() => ({ transformIds }), [transformIds]);
  const history = trpc.photo.combinedShareHistory.useQuery(input, { enabled: transformIds.length > 0 });
  const exportCsv = () => { if (!history.data?.length) return; downloadShareHistoryCsv(history.data, 0, "riwayat-berbagi-gabungan"); toast.success(`${history.data.length} aktivitas dari ${transformIds.length} frame diekspor sebagai CSV.`); };
  return <section className="combined-share-export" aria-labelledby="combined-share-export-title"><div><span className="eyebrow">EKSPOR PRIVAT / 05</span><h2 id="combined-share-export-title">Riwayat berbagi gabungan.</h2><p>Pilih satu atau lebih frame pada riwayat foto di atas, lalu unduh hanya aktivitas berbagi dari frame milikmu yang dipilih.</p></div><div className="combined-share-export-action"><strong>{transformIds.length} frame dipilih</strong>{history.isLoading ? <span><LoaderCircle className="spin-icon" size={14} /> Menyiapkan riwayat…</span> : <button type="button" disabled={!history.data?.length} onClick={exportCsv}><FileDown size={14} /> Ekspor CSV gabungan</button>}{transformIds.length > 0 && !history.isLoading && !history.data?.length && <small>Belum ada aktivitas berbagi pada frame pilihan.</small>}</div></section>;
}
