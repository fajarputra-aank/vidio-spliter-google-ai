import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { ResultEditor } from "@/components/ResultEditor";
import { useAuth } from "@/_core/hooks/useAuth";
import { shareImageUrl } from "@/lib/share";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CalendarDays, CreditCard, Download, EyeOff, Globe2, Images, LoaderCircle, LogOut, Share2, ShieldCheck, Upload, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function downloadImage(url: string, title: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lensa-saku-${title.toLowerCase().replace(/\s+/g, "-")}.png`;
  anchor.click();
}

export default function Profile() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth({ redirectOnUnauthenticated: true });
  const profileQuery = trpc.photo.profile.useQuery(undefined, { enabled: isAuthenticated });
  const [showHidden, setShowHidden] = useState(false);
  const historyInput = useMemo(() => ({ includeHidden: showHidden }), [showHidden]);
  const historyQuery = trpc.photo.list.useQuery(historyInput, { enabled: isAuthenticated });
  const publish = trpc.community.publish.useMutation({ onSuccess: () => toast.success("Frame sudah diterbitkan ke ruang komunitas."), onError: (error) => toast.error(error.message) });
  const setHidden = trpc.photo.setHidden.useMutation({ onSuccess: (_, input) => { toast.success(input.isHidden ? "Frame disembunyikan dari riwayat utama." : "Frame dikembalikan ke riwayat utama."); void historyQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const completed = useMemo(() => (historyQuery.data ?? []).filter((item) => item.status === "completed" && item.resultUrl), [historyQuery.data]);
  const selected = completed.find((item) => item.id === selectedId) ?? completed[0];

  async function share(url: string, title: string) {
    try {
      const outcome = await shareImageUrl(url, title, window.location.origin, navigator);
      toast.success(outcome === "native" ? "Pilihan berbagi sudah dibuka." : "Tautan hasil sudah disalin.");
    } catch {
      toast.error("Tautan belum dapat dibagikan. Coba unduh hasilnya.");
    }
  }

  if (authLoading || !isAuthenticated || profileQuery.isLoading) {
    return <main className="profile-loading proof-loading"><span className="aperture-mark" /><span className="eyebrow">ARSIP PRIBADI / MEMUAT</span><LoaderCircle className="spin-icon" size={25} /> Membuka lembar profilmu...</main>;
  }

  const quota = profileQuery.data?.quota;

  return (
    <main className="profile-page">
      <header className="profile-header"><Link href="/" className="profile-back"><ArrowLeft size={16} /> Kembali ke studio</Link><div className="profile-wordmark"><span className="aperture-mark" /><strong>Lensa Saku</strong><small>PROFIL / ARSIP</small></div><button className="profile-logout" onClick={() => void logout()}><LogOut size={15} /> Keluar</button></header>
      <section className="profile-hero"><div className="profile-identity"><span className="profile-avatar">{user?.name?.slice(0, 1).toUpperCase() ?? "A"}</span><div><span className="eyebrow">LEMBAR IDENTITAS / 01</span><h1>{user?.name || "Kreator Lensa Saku"}</h1><p>{user?.email || "Akun studio pribadi"}</p><div className="profile-quick-links"><Link href="/kredit"><CreditCard size={14} /> Tambah kredit</Link><Link href="/komunitas"><Globe2 size={14} /> Ruang komunitas</Link>{user?.role === "admin" && <Link href="/admin"><ShieldCheck size={14} /> Dashboard admin</Link>}</div></div></div><div className="profile-day"><CalendarDays size={17} /><span>ARSIP HARI INI</span><strong>{new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date())}</strong></div></section>
      <section className="profile-stats" aria-label="Ringkasan akun"><article><span><UserRound size={15} /> STATUS AKUN</span><strong>{profileQuery.data?.user.role === "admin" ? "Admin" : "Pribadi"}</strong><p>{profileQuery.data?.user.role === "admin" ? "Akses studio tanpa batas aktif." : "Setiap frame hanya terlihat di akunmu."}</p></article><article className={quota?.exhausted && profileQuery.data?.user.role !== "admin" ? "is-exhausted" : ""}><span>{profileQuery.data?.user.role === "admin" ? "AKSES STUDIO" : "KUOTA HARI INI"}</span><strong>{profileQuery.data?.user.role === "admin" ? "∞" : quota ? `${quota.remaining} / ${quota.dailyLimit}` : "—"}</strong><p>{profileQuery.data?.user.role === "admin" ? "Transformasi tanpa batas untuk administrator." : quota?.exhausted ? "Kuota hari ini telah terpakai." : "Transformasi masih tersedia."}</p></article><article><span><CreditCard size={15} /> KREDIT CADANGAN</span><strong>{profileQuery.data?.credits ?? 0}</strong><p>Dipakai otomatis setelah kuota habis.</p></article><article><span><Images size={15} /> TOTAL FRAME</span><strong>{profileQuery.data?.totalTransforms ?? 0}</strong><p>Rekam jejak transformasi pribadimu.</p></article></section>
      <section className="profile-history"><div className="profile-section-heading"><div><span className="eyebrow">LEMBAR BUKTI / 02</span><h2>Riwayat foto.</h2></div><div className="history-heading-actions"><p>Pilih frame untuk membandingkan sumber dan hasil. Unduh, terbitkan, atau tambahkan lapisan sebelum menyimpan.</p><button className={showHidden ? "is-active" : ""} onClick={() => setShowHidden(!showHidden)}><EyeOff size={14} /> {showHidden ? "Tampilkan utama" : "Arsip tersembunyi"}</button></div></div>{historyQuery.isLoading ? <div className="profile-empty"><LoaderCircle className="spin-icon" size={21} /> Membuka arsip...</div> : historyQuery.isError ? <div className="profile-empty"><strong>Arsip belum bisa dibuka.</strong><button className="secondary-action" onClick={() => void historyQuery.refetch()}>Muat ulang</button></div> : selected ? <div className="profile-proof-grid"><div className="profile-comparison"><BeforeAfterSlider before={selected.sourceUrl} after={selected.resultUrl ?? selected.sourceUrl} aspectRatio={selected.aspectRatio} /><div className="profile-proof-caption"><span>{selected.style.toUpperCase()} · {selected.aspectRatio}{selected.isHidden ? " · TERSEMBUNYI" : ""}</span><strong>{selected.title}</strong><p>{formatDate(selected.createdAt)}</p></div><div className="profile-proof-actions"><button className="download-action" onClick={() => downloadImage(selected.resultUrl ?? selected.sourceUrl, selected.title)}><Download size={15} /> Unduh asli</button><button className="share-action" onClick={() => void share(selected.resultUrl ?? selected.sourceUrl, selected.title)}><Share2 size={15} /> Bagikan</button><button className="publish-action" disabled={publish.isPending} onClick={() => publish.mutate({ transformId: selected.id })}><Upload size={15} /> Terbitkan</button><button className="privacy-action" disabled={setHidden.isPending} onClick={() => setHidden.mutate({ transformId: selected.id, isHidden: !selected.isHidden })}><EyeOff size={15} /> {selected.isHidden ? "Tampilkan riwayat" : "Sembunyikan riwayat"}</button></div><ResultEditor imageUrl={selected.resultUrl ?? selected.sourceUrl} title={selected.title} transformId={selected.id} /></div><div className="profile-filmstrip">{completed.map((item, index) => <button key={item.id} className={item.id === selected.id ? "is-selected" : ""} onClick={() => setSelectedId(item.id)}><img src={item.resultUrl ?? item.sourceUrl} alt={`Hasil ${item.title}`} /><span>F-{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong><small>{item.style} · {item.aspectRatio}</small></button>)}</div></div> : <div className="profile-empty"><span>00 / 00</span><strong>{showHidden ? "Belum ada frame tersembunyi." : "Belum ada hasil siap dibandingkan."}</strong><p>{showHidden ? "Frame yang kamu sembunyikan akan muncul di arsip ini." : "Mulai dari studio untuk menambahkan frame pertamamu."}</p>{!showHidden && <Link href="/" className="primary-action">Masuk studio</Link>}</div>}</section>
    </main>
  );
}
