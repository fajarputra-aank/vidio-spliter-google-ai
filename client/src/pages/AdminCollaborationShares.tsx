import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Link2, LoaderCircle, Settings2, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type Role = "user" | "admin";
type ActiveLink = {
  id: number;
  transformId: number;
  ownerId: number;
  ownerName: string | null;
  ownerEmail: string | null;
  title: string | null;
  template: string | null;
  expiresAt: Date | string;
  createdAt: Date | string;
  accessCount: number;
  lastAccessedAt: Date | string | null;
  watermarkText: string | null;
  watermarkLogoId: number | null;
};
type ActiveLinkGroup = Omit<ActiveLink, "id" | "expiresAt" | "createdAt" | "accessCount" | "lastAccessedAt" | "watermarkText" | "watermarkLogoId"> & { title: string; links: ActiveLink[] };

function formatDate(value: Date | string | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Belum diakses";
}

export default function AdminCollaborationShares() {
  const { user, loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const limits = trpc.admin.collaborationShareRoleLimits.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const activeLinks = trpc.admin.activeCollaborationShareLinks.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const [drafts, setDrafts] = useState<Record<Role, string>>({ user: "3", admin: "" });

  useEffect(() => {
    if (!limits.data) return;
    setDrafts({ user: limits.data.user === null ? "" : String(limits.data.user), admin: limits.data.admin === null ? "" : String(limits.data.admin) });
  }, [limits.data]);

  const updateLimit = trpc.admin.updateCollaborationShareRoleLimit.useMutation({
    onSuccess: async (result) => {
      await utils.admin.collaborationShareRoleLimits.invalidate();
      toast.success(result.maxActiveLinks === null ? `Peran ${result.role} kini tanpa batas tautan aktif.` : `Batas peran ${result.role} disimpan: ${result.maxActiveLinks} tautan aktif.`);
    },
    onError: (error) => toast.error(error.message),
  });
  const revokeAll = trpc.admin.revokeAllActiveCollaborationShareLinks.useMutation({
    onSuccess: async (result) => {
      await utils.admin.activeCollaborationShareLinks.invalidate();
      toast.success(`${result.revokedCount} tautan aktif telah dicabut.`);
    },
    onError: (error) => toast.error(error.message),
  });

  const links = (activeLinks.data ?? []) as ActiveLink[];
  const groups = useMemo(() => {
    const byTransform = new Map<number, ActiveLinkGroup>();
    for (const link of links) {
      const current = byTransform.get(link.transformId);
      if (current) current.links.push(link);
      else byTransform.set(link.transformId, { transformId: link.transformId, ownerId: link.ownerId, title: link.title || "Kolaborasi dua foto", template: link.template, ownerName: link.ownerName, ownerEmail: link.ownerEmail, links: [link] });
    }
    return Array.from(byTransform.values());
  }, [links]);

  const saveLimit = (role: Role) => {
    const raw = drafts[role].trim();
    if (!raw) return updateLimit.mutate({ role, maxActiveLinks: null });
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > 100) return toast.error("Masukkan angka bulat 0–100, atau kosongkan untuk tanpa batas.");
    updateLimit.mutate({ role, maxActiveLinks: value });
  };

  if (loading || (isAuthenticated && user?.role === "admin" && (limits.isLoading || activeLinks.isLoading))) return <main className="collaboration-admin-loading"><LoaderCircle className="spin-icon" size={24} /> Menyiapkan kontrol tautan Kolaborasi…</main>;
  if (!isAuthenticated || user?.role !== "admin") return <main className="collaboration-admin-loading"><ShieldCheck size={26} /><strong>Akses administrator diperlukan.</strong><Link href="/profil">Kembali ke profil</Link></main>;

  return <main className="collaboration-admin-page">
    <header className="collaboration-admin-header"><Link href="/admin"><ArrowLeft size={15} /> Kembali ke operasi</Link><span><Link2 size={15} /> Lensa Saku / tautan Kolaborasi</span></header>
    <section className="collaboration-admin-hero"><div><span className="eyebrow">KONTROL AKSES / KOLABORASI</span><h1>Tautan aktif,<br /><em>tetap terkendali.</em></h1><p>Kelola tautan berbagi hasil Kolaborasi yang masih aktif tanpa membuka foto sumber, token, atau URL penyimpanan privat.</p></div><aside><ShieldCheck size={18} /><strong>ADMIN ONLY</strong><span>{activeLinks.data?.length ?? 0} tautan aktif</span></aside></section>

    <section className="collaboration-role-limits">
      <div className="collaboration-section-heading"><div><span className="eyebrow">PENGATURAN PERAN</span><h2><Settings2 size={17} /> Batas tautan aktif.</h2></div><span>KOSONG = TANPA BATAS</span></div>
      <p>Atur batas per hasil untuk pengguna standar dan administrator. Nilai <strong>0</strong> menonaktifkan pembuatan tautan baru untuk peran tersebut; nilai kosong berarti tanpa batas. Token, masa berlaku, dan perlindungan privasi tetap sama.</p>
      <div className="collaboration-role-limit-grid">{(["user", "admin"] as const).map((role) => <form key={role} onSubmit={(event) => { event.preventDefault(); saveLimit(role); }}><header><UsersRound size={15} /><span>{role === "admin" ? "Administrator" : "Pengguna standar"}</span></header><label htmlFor={`limit-${role}`}>Maksimum tautan aktif per hasil<input id={`limit-${role}`} inputMode="numeric" type="number" min="0" max="100" value={drafts[role]} onChange={(event) => setDrafts((current) => ({ ...current, [role]: event.target.value }))} placeholder="Tanpa batas" /></label><button disabled={updateLimit.isPending}>{updateLimit.isPending ? <LoaderCircle className="spin-icon" size={14} /> : <Settings2 size={14} />} Simpan batas</button></form>)}</div>
    </section>

    <section className="collaboration-active-links">
      <div className="collaboration-section-heading"><div><span className="eyebrow">TAUTAN AKTIF / TERPUSAT</span><h2><Link2 size={17} /> Hasil yang sedang dibagikan.</h2></div><span>{groups.length} HASIL</span></div>
      {activeLinks.isError ? <div className="collaboration-admin-empty"><strong>Daftar tautan aktif belum dapat dimuat.</strong><button onClick={() => void activeLinks.refetch()}>Muat ulang</button></div> : groups.length ? <div className="collaboration-active-groups">{groups.map((group) => <article key={group.transformId}><header><div><span>{(group.template || "free").toUpperCase()} · H-{String(group.transformId).padStart(4, "0")}</span><h3>{group.title}</h3><p>{group.ownerName || "Kreator"}{group.ownerEmail ? ` · ${group.ownerEmail}` : ""}</p></div><button className="collaboration-revoke-all" disabled={revokeAll.isPending} onClick={() => { if (window.confirm(`Cabut seluruh ${group.links.length} tautan aktif untuk hasil ini? Tindakan tidak dapat dibatalkan.`)) revokeAll.mutate({ transformId: group.transformId }); }}><Trash2 size={14} /> Cabut semua ({group.links.length})</button></header><div className="collaboration-active-link-list">{group.links.map((link) => <p key={link.id}><span><strong>TAUTAN #{link.id}</strong>{link.watermarkText || link.watermarkLogoId ? " · WATERMARK" : ""}</span><small>{link.accessCount} akses · berakhir {formatDate(link.expiresAt)} · terakhir diakses {formatDate(link.lastAccessedAt)}</small></p>)}</div></article>)}</div> : <div className="collaboration-admin-empty"><Link2 size={25} /><strong>Belum ada tautan Kolaborasi aktif.</strong><p>Tautan aktif dari seluruh pengguna akan muncul di sini secara terpusat.</p></div>}
    </section>
  </main>;
}
