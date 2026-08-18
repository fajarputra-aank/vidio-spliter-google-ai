import { useAuth } from "@/_core/hooks/useAuth";
import { useBrand } from "@/contexts/BrandContext";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

function safeDestination(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function PasswordField({ id, value, onChange, placeholder = "Minimal 12 karakter", label = "Kata sandi" }: { id: string; value: string; onChange: (value: string) => void; placeholder?: string; label?: string }) {
  const [visible, setVisible] = useState(false);
  return <label className="auth-field" htmlFor={id}><span>{label}</span><div className="auth-input-wrap"><LockKeyhole size={17} /><input id={id} autoComplete={id === "register-password" ? "new-password" : "current-password"} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required minLength={12} maxLength={128} /><button type="button" className="auth-eye" onClick={() => setVisible(!visible)} aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>;
}

export default function Auth() {
  const [, navigate] = useLocation();
  const { brand } = useBrand();
  const { user, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [location] = useLocation();
  const isRegister = location === "/daftar";
  const next = useMemo(() => safeDestination(new URLSearchParams(window.location.search).get("next")), []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && isAuthenticated) navigate(user?.mustChangePassword ? "/ganti-kata-sandi" : next, { replace: true });
  }, [isAuthenticated, loading, navigate, next, user?.mustChangePassword]);

  const finish = async (result: { user: NonNullable<typeof user> }) => {
    utils.auth.me.setData(undefined, result.user);
    await utils.auth.me.invalidate();
    navigate(result.user.mustChangePassword ? "/ganti-kata-sandi" : next, { replace: true });
  };
  const login = trpc.auth.login.useMutation({ onSuccess: (value) => void finish(value), onError: (error) => toast.error(error.message) });
  const register = trpc.auth.register.useMutation({ onSuccess: (value) => void finish(value), onError: (error) => toast.error(error.message) });
  const pending = login.isPending || register.isPending;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRegister) register.mutate({ name, email, password });
    else login.mutate({ email, password });
  }

  return <main className="auth-page"><section className="auth-poster"><Link href="/" className="auth-brand"><img src={brand.iconUrl} alt="Ikon Lensa Saku" /><span><strong>Lensa Saku</strong><small>STUDIO AI</small></span></Link><div className="auth-poster-copy"><span className="eyebrow">ruang privat untuk visualmu</span><h1>Masuk ke<br /><em>kamar gelap</em> digital.</h1><p>Simpan proses, hasil, dan arah kreatifmu dalam akun yang hanya milikmu.</p></div><div className="auth-poster-foot"><span>01</span><i /><small>FOTO MASUK · ARAH JELAS · HASIL TERSIMPAN</small></div></section><section className="auth-form-side"><div className="auth-card"><Link href="/" className="auth-back">← Kembali ke studio</Link><div className="auth-kicker"><span>{isRegister ? "AKUN BARU" : "AKUN PRIBADI"}</span><i /></div><h2>{isRegister ? "Buat akunmu." : "Selamat datang kembali."}</h2><p>{isRegister ? "Daftar dengan email untuk membuat galeri visual yang benar-benar privat." : "Masuk dengan email dan kata sandi akun Lensa Saku."}</p><form onSubmit={submit} className="auth-form">{isRegister && <label className="auth-field" htmlFor="register-name"><span>Nama</span><div className="auth-input-wrap"><UserRound size={17} /><input id="register-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama yang ingin ditampilkan" required minLength={2} maxLength={80} /></div></label>}<label className="auth-field" htmlFor="auth-email"><span>Email</span><div className="auth-input-wrap"><Mail size={17} /><input id="auth-email" autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" required maxLength={320} /></div></label><PasswordField id={isRegister ? "register-password" : "login-password"} value={password} onChange={setPassword} />{isRegister && <small className="auth-hint"><CheckCircle2 size={14} /> Gunakan sedikitnya 12 karakter untuk menjaga koleksimu.</small>}<button className="auth-submit" disabled={pending}>{pending ? "Memproses…" : isRegister ? "Buat akun & masuk" : "Masuk ke studio"}<ArrowRight size={17} /></button></form><div className="auth-switch"><span>{isRegister ? "Sudah punya akun?" : "Belum punya akun?"}</span><Link href={`${isRegister ? "/masuk" : "/daftar"}?next=${encodeURIComponent(next)}`}>{isRegister ? "Masuk" : "Buat akun"}</Link></div><p className="auth-privacy"><KeyRound size={14} /> Tidak terhubung dengan akun Manus atau layanan sosial mana pun.</p></div></section></main>;
}

export function ChangePassword() {
  const [, navigate] = useLocation();
  const { brand } = useBrand();
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const mutation = trpc.auth.changePassword.useMutation({ onSuccess: async (value) => { utils.auth.me.setData(undefined, value.user); await utils.auth.me.invalidate(); toast.success("Kata sandi baru sudah tersimpan."); navigate("/", { replace: true }); }, onError: (error) => toast.error(error.message) });
  if (loading || !user) return <main className="auth-page auth-loading">Menyiapkan akun…</main>;
  return <main className="auth-page auth-change"><section className="auth-card"><img className="auth-change-icon" src={brand.iconUrl} alt="Ikon Lensa Saku" /><span className="auth-alert">PENGAMANAN AKUN</span><h1>Ganti kata sandi sementara.</h1><p>Akun administrator ini menggunakan kata sandi awal. Buat kata sandi baru sebelum membuka studio.</p><form className="auth-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ currentPassword, nextPassword }); }}><PasswordField id="current-password" label="Kata sandi sementara" value={currentPassword} onChange={setCurrentPassword} placeholder="Masukkan kata sandi awal" /><PasswordField id="next-password" label="Kata sandi baru" value={nextPassword} onChange={setNextPassword} placeholder="Minimal 12 karakter" /><button className="auth-submit" disabled={mutation.isPending}>{mutation.isPending ? "Menyimpan…" : "Simpan & lanjutkan"}<ArrowRight size={17} /></button></form></section></main>;
}
