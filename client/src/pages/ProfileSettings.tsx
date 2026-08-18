import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Laptop, LoaderCircle, LockKeyhole, LogOut, Mail, MapPin, ShieldCheck } from "lucide-react";
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
  account_locked: { title: "Akun dikunci sementara", copy: "Terlalu banyak percobaan masuk gagal terdeteksi." },
  all_sessions_signed_out: { title: "Semua perangkat dikeluarkan", copy: "Sesi lain telah dinonaktifkan dari pengaturan keamanan." },
} as const;

function PasswordInput({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return <label className="security-field" htmlFor={id}><span>{label}</span><div><LockKeyhole size={16} /><input id={id} value={value} onChange={(event) => onChange(event.target.value)} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={12} maxLength={128} placeholder={label === "Kata sandi baru" ? "Minimal 12 karakter" : "Masukkan kata sandi"} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>;
}

export default function ProfileSettings() {
  const { user, loading, isAuthenticated, logout } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const history = trpc.auth.securityHistory.useQuery(undefined, { enabled: isAuthenticated });
  const activeSessions = trpc.auth.activeSessions.useQuery(undefined, { enabled: isAuthenticated });
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: async (result) => {
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      await Promise.all([utils.auth.me.invalidate(), history.refetch()]);
      toast.success(result.emailNoticeSent ? "Kata sandi diubah. Notifikasi email telah dikirim." : "Kata sandi diubah. Notifikasi email belum dapat dikirim.");
    },
    onError: (error) => toast.error(error.message),
  });
  const signOutAll = trpc.auth.signOutAllSessions.useMutation({
    onSuccess: async () => {
      toast.success("Semua perangkat telah dikeluarkan. Silakan masuk kembali.");
      await logout();
    },
    onError: (error) => toast.error(error.message),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nextPassword !== confirmPassword) { toast.error("Konfirmasi kata sandi baru belum sama."); return; }
    changePassword.mutate({ currentPassword, nextPassword });
  }
  if (loading || !user) return <main className="security-page security-loading"><LoaderCircle className="spin-icon" size={24} /> Menyiapkan keamanan akun…</main>;
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== nextPassword;
  return <main className="security-page"><header className="security-header"><Link href="/profil"><ArrowLeft size={16} /> Kembali ke profil</Link><span>LENSA SAKU / PENGATURAN AKUN</span></header><section className="security-hero"><div><span className="eyebrow">KEAMANAN PRIBADI / 01</span><h1>Kunci ruang<br /><em>kreatifmu.</em></h1><p>Kelola kata sandi dan tinjau aktivitas keamanan yang hanya dapat dilihat oleh akunmu.</p></div><div className="security-identity"><span><ShieldCheck size={18} /> EMAIL TERVERIFIKASI</span><strong>{user.email}</strong><small>{user.name || "Akun Lensa Saku"}</small></div></section><section className="security-grid"><article className="security-password-card"><div className="security-card-heading"><KeyRound size={19} /><div><span>GANTI KATA SANDI</span><h2>Perbarui akses.</h2></div></div><p>Setelah berhasil diubah, kami mengirim pemberitahuan ke email akunmu.</p><form onSubmit={submit}><PasswordInput id="settings-current-password" label="Kata sandi saat ini" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" /><PasswordInput id="settings-next-password" label="Kata sandi baru" value={nextPassword} onChange={setNextPassword} autoComplete="new-password" /><PasswordInput id="settings-confirm-password" label="Konfirmasi kata sandi baru" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />{passwordMismatch && <small className="security-password-hint">Konfirmasi harus sama dengan kata sandi baru.</small>}<button className="security-submit" disabled={changePassword.isPending || passwordMismatch}>{changePassword.isPending ? "Menyimpan…" : "Simpan kata sandi"}<CheckCircle2 size={17} /></button></form><div className="security-session-action"><div><LogOut size={17} /><span><strong>Keluar dari semua perangkat</strong><small>Semua sesi aktif, termasuk sesi ini, akan dihentikan.</small></span></div><button type="button" disabled={signOutAll.isPending} onClick={() => { if (window.confirm("Keluarkan akun ini dari semua perangkat? Kamu perlu masuk kembali.")) signOutAll.mutate(); }}>{signOutAll.isPending ? "Memproses…" : "Keluar semua"}</button></div></article><article className="security-history-card"><div className="security-card-heading"><ShieldCheck size={19} /><div><span>RIWAYAT KEAMANAN</span><h2>Aktivitas akun.</h2></div></div><p>Menampilkan maksimal 50 aktivitas terbaru tanpa menyimpan kata sandi atau alamat IP.</p>{history.isLoading ? <div className="security-history-empty"><LoaderCircle className="spin-icon" size={18} /> Memuat riwayat…</div> : history.isError ? <div className="security-history-empty"><strong>Riwayat belum dapat dimuat.</strong><button onClick={() => void history.refetch()}>Muat ulang</button></div> : history.data?.length ? <div className="security-timeline">{history.data.map((event) => { const detail = eventCopy[event.kind]; return <article key={event.id}><i /><div><strong>{detail.title}</strong><p>{detail.copy}</p><small>{formatDate(event.createdAt)}</small></div></article>; })}</div> : <div className="security-history-empty"><Mail size={18} /> Belum ada aktivitas keamanan yang tercatat.</div>}</article></section><section className="security-active-sessions"><div className="security-card-heading"><Laptop size={19} /><div><span>PERANGKAT & LOKASI</span><h2>Sesi yang aktif.</h2></div></div><p>Lokasi hanya menunjukkan perkiraan kota/negara dari jaringan. Kami tidak menyimpan alamat IP atau koordinat.</p>{activeSessions.isLoading ? <div className="security-history-empty"><LoaderCircle className="spin-icon" size={18} /> Memuat perangkat…</div> : activeSessions.isError ? <div className="security-history-empty"><strong>Perangkat belum dapat dimuat.</strong><button onClick={() => void activeSessions.refetch()}>Muat ulang</button></div> : activeSessions.data?.length ? <div className="active-session-list">{activeSessions.data.map((session) => <article key={session.id}><Laptop size={18} /><div><div className="active-session-title"><strong>{session.deviceLabel}</strong>{session.isCurrent && <span>Sesi ini</span>}</div><p><MapPin size={13} /> {session.locationLabel}</p><small>Terakhir aktif {formatDate(session.lastSeenAt)}</small></div></article>)}</div> : <div className="security-history-empty"><Laptop size={18} /> Sesi akan tercatat saat kamu masuk kembali.</div>}</section></main>;
}
