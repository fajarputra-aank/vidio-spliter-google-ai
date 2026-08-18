import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const eventCopy = {
  login: { title: "Masuk ke akun", copy: "Sesi akun berhasil dibuka." },
  password_changed: { title: "Kata sandi diubah", copy: "Kata sandi diperbarui dari pengaturan profil." },
  password_reset: { title: "Kata sandi diatur ulang", copy: "Kata sandi diperbarui menggunakan tautan email." },
} as const;

function PasswordInput({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return <label className="security-field" htmlFor={id}><span>{label}</span><div><LockKeyhole size={16} /><input id={id} value={value} onChange={(event) => onChange(event.target.value)} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={12} maxLength={128} placeholder={label === "Kata sandi baru" ? "Minimal 12 karakter" : "Masukkan kata sandi"} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>;
}

export default function ProfileSettings() {
  const { user, loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const history = trpc.auth.securityHistory.useQuery(undefined, { enabled: isAuthenticated });
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: async (result) => {
      setCurrentPassword("");
      setNextPassword("");
      await Promise.all([utils.auth.me.invalidate(), history.refetch()]);
      toast.success(result.emailNoticeSent ? "Kata sandi diubah. Notifikasi email telah dikirim." : "Kata sandi diubah. Notifikasi email belum dapat dikirim.");
    },
    onError: (error) => toast.error(error.message),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    changePassword.mutate({ currentPassword, nextPassword });
  }
  if (loading || !user) return <main className="security-page security-loading"><LoaderCircle className="spin-icon" size={24} /> Menyiapkan keamanan akun…</main>;
  return <main className="security-page"><header className="security-header"><Link href="/profil"><ArrowLeft size={16} /> Kembali ke profil</Link><span>LENSA SAKU / PENGATURAN AKUN</span></header><section className="security-hero"><div><span className="eyebrow">KEAMANAN PRIBADI / 01</span><h1>Kunci ruang<br /><em>kreatifmu.</em></h1><p>Kelola kata sandi dan tinjau aktivitas keamanan yang hanya dapat dilihat oleh akunmu.</p></div><div className="security-identity"><span><ShieldCheck size={18} /> EMAIL TERVERIFIKASI</span><strong>{user.email}</strong><small>{user.name || "Akun Lensa Saku"}</small></div></section><section className="security-grid"><article className="security-password-card"><div className="security-card-heading"><KeyRound size={19} /><div><span>GANTI KATA SANDI</span><h2>Perbarui akses.</h2></div></div><p>Setelah berhasil diubah, kami mengirim pemberitahuan ke email akunmu.</p><form onSubmit={submit}><PasswordInput id="settings-current-password" label="Kata sandi saat ini" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" /><PasswordInput id="settings-next-password" label="Kata sandi baru" value={nextPassword} onChange={setNextPassword} autoComplete="new-password" /><button className="security-submit" disabled={changePassword.isPending}>{changePassword.isPending ? "Menyimpan…" : "Simpan kata sandi"}<CheckCircle2 size={17} /></button></form></article><article className="security-history-card"><div className="security-card-heading"><ShieldCheck size={19} /><div><span>RIWAYAT KEAMANAN</span><h2>Aktivitas akun.</h2></div></div><p>Menampilkan maksimal 50 aktivitas terbaru tanpa menyimpan kata sandi atau alamat IP.</p>{history.isLoading ? <div className="security-history-empty"><LoaderCircle className="spin-icon" size={18} /> Memuat riwayat…</div> : history.isError ? <div className="security-history-empty"><strong>Riwayat belum dapat dimuat.</strong><button onClick={() => void history.refetch()}>Muat ulang</button></div> : history.data?.length ? <div className="security-timeline">{history.data.map((event) => { const detail = eventCopy[event.kind]; return <article key={event.id}><i /><div><strong>{detail.title}</strong><p>{detail.copy}</p><small>{formatDate(event.createdAt)}</small></div></article>; })}</div> : <div className="security-history-empty"><Mail size={18} /> Belum ada aktivitas keamanan yang tercatat.</div>}</article></section></main>;
}
