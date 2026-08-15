import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Check, CreditCard, LoaderCircle, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(value / 100);
}

export default function Credits() {
  const { loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const balanceQuery = trpc.billing.balance.useQuery(undefined, { enabled: isAuthenticated });
  const packsQuery = trpc.billing.packs.useQuery();
  const checkout = trpc.billing.checkout.useMutation({
    onSuccess: ({ checkoutUrl }) => {
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      toast.message("Checkout Stripe dibuka di tab baru. Kredit akan masuk setelah pembayaran dikonfirmasi.");
    },
    onError: (error) => toast.error(error.message),
  });

  if (loading || !isAuthenticated || balanceQuery.isLoading) return <main className="credit-loading"><LoaderCircle className="spin-icon" size={24} /> Membuka lembar kredit...</main>;

  return <main className="credit-page"><header className="credit-header"><Link href="/profil"><ArrowLeft size={16} /> Kembali ke profil</Link><span className="credit-wordmark"><span className="aperture-mark" />Lensa Saku / kredit</span></header><section className="credit-hero"><div><span className="eyebrow">CADANGAN FRAME / 01</span><h1>Jangan putus<br /><em>di tengah ide.</em></h1><p>Kuota harian tetap gratis. Kredit hanya dipakai bila kuota itu sudah habis, dan tidak kedaluwarsa selama akunmu aktif.</p></div><article className="credit-balance"><span><Sparkles size={15} /> KREDIT TERSISA</span><strong>{balanceQuery.data?.credits ?? 0}</strong><p>Frame tambahan siap dipakai.</p></article></section><section className="credit-packs"><div className="credit-section-copy"><span className="eyebrow">PILIH PAKET / 02</span><h2>Isi ulang seperlunya.</h2><p>Pembayaran diproses melalui checkout Stripe. Kredit ditambahkan hanya sesudah konfirmasi pembayaran server-side.</p></div><div className="credit-pack-grid">{packsQuery.data?.map((pack, index) => <article className={index === 1 ? "is-featured" : ""} key={pack.id}><span>PACK / {String(index + 1).padStart(2, "0")}</span><h3>{pack.title}</h3><strong>{pack.credits}<small> kredit</small></strong><p>{money(pack.unitAmount, pack.currency)}</p><ul><li><Check size={13} /> Dipakai setelah kuota harian habis</li><li><Check size={13} /> Tidak kedaluwarsa</li><li><Check size={13} /> Riwayat transaksi di profil</li></ul><button className="primary-action" disabled={checkout.isPending} onClick={() => checkout.mutate({ packId: pack.id })}>{checkout.isPending ? <LoaderCircle className="spin-icon" size={16} /> : <CreditCard size={16} />} Beli kredit</button></article>)}</div></section><section className="credit-history"><span className="eyebrow">JEJAK PEMBELIAN</span>{balanceQuery.data?.purchases.length ? <div>{balanceQuery.data.purchases.map((purchase) => <p key={purchase.id}><strong>{purchase.packId}</strong><span>+{purchase.credits} kredit · {new Date(purchase.createdAt).toLocaleDateString("id-ID")}</span></p>)}</div> : <p>Belum ada pembelian kredit pada akun ini.</p>}</section></main>;
}
