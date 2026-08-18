import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { finalizeManualTransfer, type ManualTransferOrder } from "../lib/manualTransferFlow";
import { ArrowLeft, Banknote, Check, ClipboardCopy, LoaderCircle, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState } from "react";

function money(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export default function Credits() {
  const { loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const balanceQuery = trpc.billing.balance.useQuery(undefined, { enabled: isAuthenticated });
  const packsQuery = trpc.billing.packs.useQuery();
  const utils = trpc.useUtils();
  const [selectedPack, setSelectedPack] = useState<{ id: "starter" | "studio" | "archive"; title: string; credits: number; unitAmount: number } | null>(null);
  const [localOrders, setLocalOrders] = useState<ManualTransferOrder[] | null>(null);
  const submitTransfer = trpc.billing.createManualOrder.useMutation({ onSuccess: (order) => { void finalizeManualTransfer({ order, prependOrder: (nextOrder: ManualTransferOrder) => setLocalOrders((current) => [nextOrder, ...(current ?? balanceQuery.data?.manualOrders ?? [])]), invalidateBalance: () => utils.billing.balance.invalidate(), clearSelection: () => setSelectedPack(null) }); toast.success("Permintaan transfer dicatat. Kredit masuk setelah admin memverifikasi transfer BCA."); }, onError: (error) => toast.error(error.message) });

  if (loading || !isAuthenticated || balanceQuery.isLoading) return <main className="credit-loading"><LoaderCircle className="spin-icon" size={24} /> Membuka lembar kredit...</main>;

  const orders = localOrders ?? balanceQuery.data?.manualOrders ?? [];
  return <main className="credit-page"><header className="credit-header"><Link href="/profil"><ArrowLeft size={16} /> Kembali ke profil</Link><span className="credit-wordmark"><span className="aperture-mark" />Lensa Saku / kredit</span></header><section className="credit-hero"><div><span className="eyebrow">CADANGAN FRAME / 01</span><h1>Jangan putus<br /><em>di tengah ide.</em></h1><p>Kuota harian tetap gratis. Kredit hanya dipakai bila kuota itu sudah habis, dan tidak kedaluwarsa selama akunmu aktif.</p></div><article className="credit-balance"><span><Sparkles size={15} /> KREDIT TERSISA</span><strong>{balanceQuery.data?.credits ?? 0}</strong><p>Frame tambahan siap dipakai.</p></article></section><section className="credit-packs"><div className="credit-section-copy"><span className="eyebrow">PILIH PAKET / 02</span><h2>Isi ulang seperlunya.</h2><p>Transfer langsung ke rekening BCA. Kredit hanya diterbitkan setelah admin memverifikasi pembayaran.</p></div><div className="credit-pack-grid">{packsQuery.data?.map((pack, index) => <article className={index === 1 ? "is-featured" : ""} key={pack.id}><span>PACK / {String(index + 1).padStart(2, "0")}</span><h3>{pack.title}</h3><strong>{pack.credits}<small> kredit</small></strong><p>{money(pack.unitAmount)}</p><ul><li><Check size={13} /> Dipakai setelah kuota harian habis</li><li><Check size={13} /> Tidak kedaluwarsa</li><li><Check size={13} /> Verifikasi transfer oleh admin</li></ul><button className="primary-action" onClick={() => setSelectedPack(pack)}><Banknote size={16} /> Pilih transfer</button></article>)}</div></section>{selectedPack && <section className="transfer-desk"><div><span className="eyebrow">TRANSFER BCA / KONFIRMASI</span><h2>{selectedPack.title} · {money(selectedPack.unitAmount)}</h2><p>Transfer tepat sebesar nominal paket ke rekening berikut, lalu ajukan konfirmasi. Kredit tidak diterbitkan otomatis.</p></div><article><span>BCA</span><strong>0132720728</strong><p>a.n. Fajar Nugoho Putraningprang</p><button onClick={() => { void navigator.clipboard?.writeText("0132720728"); toast.success("Nomor rekening disalin."); }}><ClipboardCopy size={14} /> Salin rekening</button></article><footer><button className="secondary-action" onClick={() => setSelectedPack(null)}>Batal</button><button className="primary-action" disabled={submitTransfer.isPending} onClick={() => submitTransfer.mutate({ packId: selectedPack.id })}>{submitTransfer.isPending ? <LoaderCircle className="spin-icon" size={16} /> : <Check size={16} />} Saya sudah transfer</button></footer></section>}<section className="credit-history"><span className="eyebrow">JEJAK PEMBELIAN</span>{orders.length ? <div>{orders.map((order) => <p key={order.id}><strong>{order.packId}</strong><span>+{order.credits} kredit · {money(order.amountIdr)} · {order.status === "pending" ? "menunggu verifikasi" : order.status === "approved" ? "disetujui" : "ditolak"}</span></p>)}</div> : <p>Belum ada permintaan transfer pada akun ini.</p>}</section></main>;
}
