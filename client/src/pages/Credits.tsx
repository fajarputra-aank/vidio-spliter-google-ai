import { useAuth } from "@/_core/hooks/useAuth";
import { finalizeManualTransfer, type ManualTransferOrder } from "../lib/manualTransferFlow";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Banknote, Check, ClipboardCopy, LoaderCircle, Paperclip, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type TransferProof = { mimeType: "image/jpeg" | "image/png" | "image/webp"; sourceData: string; name: string };
type SelectedPack = { id: "starter" | "studio" | "archive"; title: string; credits: number; unitAmount: number };

function money(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

async function readTransferProof(file: File): Promise<TransferProof> {
  const validMime = ["image/jpeg", "image/png", "image/webp"] as const;
  if (!validMime.includes(file.type as (typeof validMime)[number]) || file.size > 5_000_000) throw new Error("Gunakan gambar JPG, PNG, atau WEBP maksimal 5 MB.");
  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Bukti transfer tidak dapat dibaca.")); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); });
  return { mimeType: file.type as TransferProof["mimeType"], sourceData: dataUrl.split(",")[1] ?? "", name: file.name };
}

export default function Credits() {
  const { loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const balanceQuery = trpc.billing.balance.useQuery(undefined, { enabled: isAuthenticated });
  const packsQuery = trpc.billing.packs.useQuery();
  const utils = trpc.useUtils();
  const [selectedPack, setSelectedPack] = useState<SelectedPack | null>(null);
  const [proof, setProof] = useState<TransferProof | null>(null);
  const [localOrders, setLocalOrders] = useState<ManualTransferOrder[] | null>(null);
  const submitTransfer = trpc.billing.createManualOrder.useMutation({
    onSuccess: (order) => { void finalizeManualTransfer({ order, prependOrder: (nextOrder: ManualTransferOrder) => setLocalOrders((current) => [nextOrder, ...(current ?? balanceQuery.data?.manualOrders ?? [])]), invalidateBalance: () => utils.billing.balance.invalidate(), clearSelection: () => { setSelectedPack(null); setProof(null); } }); toast.success("Permintaan transfer dan bukti pembayaran dicatat. Kredit masuk setelah admin memverifikasi."); },
    onError: (error) => toast.error(error.message),
  });
  const orders = localOrders ?? balanceQuery.data?.manualOrders ?? [];
  const selectPack = (pack: SelectedPack) => { setSelectedPack(pack); setProof(null); };

  if (loading || !isAuthenticated || balanceQuery.isLoading) return <main className="credit-loading"><LoaderCircle className="spin-icon" size={24} /> Membuka lembar kredit...</main>;

  return <main className="credit-page">
    <header className="credit-header"><Link href="/profil"><ArrowLeft size={16} /> Kembali ke profil</Link><span className="credit-wordmark"><span className="aperture-mark" />Lensa Saku / kredit</span></header>
    <section className="credit-hero"><div><span className="eyebrow">CADANGAN FRAME / 01</span><h1>Jangan putus<br /><em>di tengah ide.</em></h1><p>Kuota harian tetap gratis. Kredit hanya dipakai bila kuota itu sudah habis, dan tidak kedaluwarsa selama akunmu aktif.</p></div><article className="credit-balance"><span><Sparkles size={15} /> KREDIT TERSISA</span><strong>{balanceQuery.data?.credits ?? 0}</strong><p>Frame tambahan siap dipakai.</p></article></section>
    <section className="credit-packs"><div className="credit-section-copy"><span className="eyebrow">PILIH PAKET / 02</span><h2>Isi ulang seperlunya.</h2><p>Transfer langsung ke rekening BCA. Kredit hanya diterbitkan setelah admin memverifikasi pembayaran dan bukti transfer.</p></div><div className="credit-pack-grid">{packsQuery.data?.map((pack, index) => <article className={index === 1 ? "is-featured" : ""} key={pack.id}><span>PACK / {String(index + 1).padStart(2, "0")}</span><h3>{pack.title}</h3><strong>{pack.credits}<small> kredit</small></strong><p>{money(pack.unitAmount)}</p><ul><li><Check size={13} /> Dipakai setelah kuota harian habis</li><li><Check size={13} /> Tidak kedaluwarsa</li><li><Check size={13} /> Bukti transfer diverifikasi admin</li></ul><button className="primary-action" onClick={() => selectPack(pack)}><Banknote size={16} /> Pilih transfer</button></article>)}</div></section>
    {selectedPack && <section className="transfer-desk"><div><span className="eyebrow">TRANSFER BCA / KONFIRMASI</span><h2>{selectedPack.title} · {money(selectedPack.unitAmount)}</h2><p>Transfer tepat sebesar nominal paket ke rekening berikut lalu lampirkan foto resi sebelum mengajukan konfirmasi.</p></div><article><span>BCA</span><strong>0132720728</strong><p>a.n. Fajar Nugoho Putraningprang</p><button onClick={() => { void navigator.clipboard?.writeText("0132720728"); toast.success("Nomor rekening disalin."); }}><ClipboardCopy size={14} /> Salin rekening</button></article><label className="transfer-proof-field"><Paperclip size={16} /><span><strong>{proof ? proof.name : "Unggah bukti transfer"}</strong><small>JPG, PNG, atau WEBP · maksimal 5 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { setProof(await readTransferProof(file)); } catch (error) { toast.error(error instanceof Error ? error.message : "Bukti transfer tidak valid."); event.target.value = ""; } }} /></label><footer><button className="secondary-action" onClick={() => { setSelectedPack(null); setProof(null); }}>Batal</button><button className="primary-action" disabled={submitTransfer.isPending || !proof} onClick={() => { if (proof) submitTransfer.mutate({ packId: selectedPack.id, proof: { mimeType: proof.mimeType, sourceData: proof.sourceData } }); }}>{submitTransfer.isPending ? <LoaderCircle className="spin-icon" size={16} /> : <Check size={16} />} Saya sudah transfer</button></footer></section>}
    <section className="credit-history"><span className="eyebrow">JEJAK PEMBELIAN</span>{orders.length ? <div>{orders.map((order) => <p key={order.id}><strong>{order.packId}</strong><span>+{order.credits} kredit · {money(order.amountIdr)} · {order.status === "pending" ? "menunggu verifikasi" : order.status === "approved" ? "disetujui" : "ditolak"} {order.proofUrl ? "· resi terlampir" : ""}</span></p>)}</div> : <p>Belum ada permintaan transfer pada akun ini.</p>}</section>
  </main>;
}
