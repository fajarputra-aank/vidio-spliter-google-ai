import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowLeft, CalendarClock, Check, ChevronLeft, ChevronRight, Copy, Eye, LoaderCircle, Pencil, Save, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type Season = "ramadan" | "lebaran";
type FormState = { slug: string; name: string; season: Season; description: string; recipeIds: string[]; isActive: boolean; startsAt: string; endsAt: string };
const blankForm = (): FormState => ({ slug: "", name: "", season: "ramadan", description: "", recipeIds: [], isActive: true, startsAt: "", endsAt: "" });

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function toDateTimeLocal(value: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toNullableDate(value: string) {
  return value ? new Date(value) : null;
}

function monthLabel(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(value);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export default function SeasonalCollectionsAdmin() {
  const { user, loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const collections = trpc.admin.seasonalCollections.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const definitions = trpc.recipeCatalog.definitions.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const [form, setForm] = useState<FormState>(blankForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const isBusy = collections.isLoading || definitions.isLoading;
  const managedCollections = collections.data?.collections ?? [];
  const serverNow = collections.data?.serverNow ?? new Date();
  const recipeMap = useMemo(() => new Map<string, string>(definitions.data?.map((recipe) => [recipe.id, recipe.title]) ?? []), [definitions.data]);
  const draftRecipes = useMemo(() => form.recipeIds.map((id) => ({ id, title: recipeMap.get(id) ?? id })), [form.recipeIds, recipeMap]);
  const endingSoon = useMemo(() => managedCollections.filter((collection) => { if (!collection.isActive || !collection.endsAt) return false; const remaining = new Date(collection.endsAt).getTime() - new Date(serverNow).getTime(); return remaining > 0 && remaining <= 7 * 24 * 60 * 60 * 1000; }), [managedCollections, serverNow]);
  const calendarDays = useMemo(() => { const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1); const gridStart = new Date(first); gridStart.setDate(first.getDate() - first.getDay()); return Array.from({ length: 42 }, (_, index) => { const day = new Date(gridStart); day.setDate(gridStart.getDate() + index); return day; }); }, [calendarCursor]);
  const resetForm = () => { setEditingId(null); setForm(blankForm()); };
  const refreshCollections = () => { void utils.admin.seasonalCollections.invalidate(); void utils.recipeCatalog.seasonalCollections.invalidate(); };
  const create = trpc.admin.createSeasonalCollection.useMutation({ onSuccess: () => { refreshCollections(); resetForm(); toast.success("Koleksi musiman disimpan."); }, onError: (error) => toast.error(error.message) });
  const update = trpc.admin.updateSeasonalCollection.useMutation({ onSuccess: () => { refreshCollections(); resetForm(); toast.success("Koleksi musiman diperbarui."); }, onError: (error) => toast.error(error.message) });
  const duplicate = trpc.admin.duplicateSeasonalCollection.useMutation({ onSuccess: (draft) => { refreshCollections(); beginEdit(draft); toast.success("Koleksi disalin sebagai draf nonaktif."); }, onError: (error) => toast.error(error.message) });

  if (loading || isBusy) return <main className="seasonal-admin-loading"><LoaderCircle className="spin-icon" size={25} /> Memuat meja koleksi musiman…</main>;
  if (!isAuthenticated || user?.role !== "admin") return <main className="seasonal-admin-loading"><ShieldCheck size={28} /><strong>Akses administrator diperlukan.</strong><Link href="/profil" className="secondary-action">Kembali ke profil</Link></main>;
  if (collections.isError || definitions.isError) return <main className="seasonal-admin-loading"><strong>Data koleksi belum dapat dimuat.</strong><button className="secondary-action" onClick={() => { void collections.refetch(); void definitions.refetch(); }}>Muat ulang</button></main>;

  function toggleRecipe(recipeId: string) {
    setForm((current) => ({ ...current, recipeIds: current.recipeIds.includes(recipeId) ? current.recipeIds.filter((id) => id !== recipeId) : [...current.recipeIds, recipeId] }));
  }

  function beginEdit(collection: NonNullable<typeof collections.data>["collections"][number]) {
    setEditingId(collection.id);
    setForm({ slug: collection.slug, name: collection.name, season: collection.season, description: collection.description, recipeIds: collection.recipeIds, isActive: collection.isActive, startsAt: toDateTimeLocal(collection.startsAt), endsAt: toDateTimeLocal(collection.endsAt) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.recipeIds.length) return toast.error("Pilih minimal satu resep yang sudah tervalidasi.");
    const startsAt = toNullableDate(form.startsAt);
    const endsAt = toNullableDate(form.endsAt);
    if (startsAt && endsAt && endsAt <= startsAt) return toast.error("Tanggal berakhir harus setelah tanggal mulai.");
    const payload = { ...form, startsAt, endsAt };
    if (editingId) update.mutate({ id: editingId, ...payload });
    else create.mutate(payload);
  }

  function collectionsOnDay(day: Date) {
    const dayStart = startOfDay(day).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    return managedCollections.filter((collection) => { if (!collection.startsAt && !collection.endsAt) return false; const startsAt = collection.startsAt ? new Date(collection.startsAt).getTime() : Number.NEGATIVE_INFINITY; const endsAt = collection.endsAt ? new Date(collection.endsAt).getTime() : Number.POSITIVE_INFINITY; return startsAt < dayEnd && endsAt > dayStart; });
  }

  return <main className="seasonal-admin-page">
    <header className="seasonal-admin-header"><Link href="/admin"><ArrowLeft size={16} /> Kembali ke operasi</Link><span><Sparkles size={15} /> KOLEKSI MUSIMAN</span><b>ADMIN</b></header>
    <section className="seasonal-admin-hero"><div><span className="eyebrow">KURASI RESEP / AMAN</span><h1>Atur momen,<br /><em>jaga sumbernya.</em></h1><p>Kelompokkan resep Ramadan dan Lebaran dari katalog tervalidasi. Prompt sumber tidak dapat diubah dari halaman ini agar perlindungan subjek, produk, label, dan promosi tetap konsisten.</p></div><aside><ShieldCheck size={18} /><strong>RESEP TERVERIFIKASI</strong><span>Tanpa prompt bebas</span></aside></section>
    <section className="seasonal-calendar-panel"><div className="seasonal-calendar-heading"><div><span className="eyebrow">KALENDER KAMPANYE</span><h2>Jadwal yang sedang bergerak.</h2></div><div className="calendar-month-nav"><button type="button" aria-label="Bulan sebelumnya" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={15} /></button><strong>{monthLabel(calendarCursor)}</strong><button type="button" aria-label="Bulan berikutnya" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={15} /></button></div></div><div className="seasonal-calendar"><div className="calendar-weekdays">{["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendarDays.map((day) => { const scheduled = collectionsOnDay(day); const isToday = startOfDay(day).getTime() === startOfDay(new Date(serverNow)).getTime(); return <div className={`${day.getMonth() === calendarCursor.getMonth() ? "" : "is-outside"} ${isToday ? "is-today" : ""}`} key={day.toISOString()}><time>{day.getDate()}</time>{scheduled.slice(0, 2).map((collection) => <button type="button" className={`calendar-event ${collection.season}`} key={collection.id} onClick={() => beginEdit(collection)}>{collection.name}</button>)}{scheduled.length > 2 && <small>+{scheduled.length - 2} lainnya</small>}</div>; })}</div></div><p><CalendarClock size={14} /> Klik kampanye pada kalender untuk mengubah jadwalnya. Koleksi tanpa tanggal tampil langsung atau mengikuti status aktifnya.</p></section>
    {endingSoon.length > 0 && <section className="seasonal-expiry-alert" role="status"><AlertTriangle size={17} /><div><strong>{endingSoon.length} koleksi segera berakhir</strong><p>{endingSoon.map((collection) => `${collection.name} · ${formatDate(collection.endsAt!)}`).join(" | ")}</p></div></section>}
    <section className="seasonal-admin-grid">
      <form className="seasonal-editor" onSubmit={submit}>
        <div className="admin-section-heading"><div><span className="eyebrow">{editingId ? "PERBARUI KOLEKSI" : "KOLEKSI BARU"}</span><h2>{editingId ? "Sempurnakan pilihan." : "Kurasi perayaan."}</h2></div>{editingId && <button type="button" className="seasonal-cancel" onClick={resetForm}>Batal edit</button>}</div>
        <label>Nama koleksi<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={80} placeholder="Contoh: Inspirasi Hampers Ramadan" required /></label>
        <label>Slug koleksi<input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))} maxLength={48} pattern="[a-z0-9-]{3,48}" placeholder="inspirasi-hampers-ramadan" required /></label>
        <label>Musim<select value={form.season} onChange={(event) => setForm((current) => ({ ...current, season: event.target.value as Season }))}><option value="ramadan">Ramadan</option><option value="lebaran">Lebaran</option></select></label>
        <label>Deskripsi singkat<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={240} placeholder="Jelaskan tujuan koleksi ini bagi pengguna." required /></label>
        <label className="seasonal-active"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Tampilkan koleksi di studio pengguna</label>
        <div className="seasonal-schedule"><span>JADWAL OTOMATIS <small>Kosongkan untuk aktif selama status koleksi aktif.</small></span><label>Mulai<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></label><label>Berakhir<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></label></div>
        <fieldset><legend>Pilih resep tervalidasi <span>{form.recipeIds.length} dipilih</span></legend><div className="seasonal-recipe-options">{definitions.data?.map((recipe) => <label key={recipe.id} className={form.recipeIds.includes(recipe.id) ? "is-selected" : ""}><input type="checkbox" checked={form.recipeIds.includes(recipe.id)} onChange={() => toggleRecipe(recipe.id)} /><span><strong>{recipe.title}</strong><small>{recipe.id}</small></span><Check size={14} /></label>)}</div></fieldset>
        <aside className="seasonal-draft-preview" aria-live="polite"><div><span><Eye size={13} /> PRATINJAU PENGGUNA</span><small>{form.isActive ? form.startsAt ? `Mulai ${formatDate(toNullableDate(form.startsAt)!)}` : "Tampil langsung" : "Disimpan nonaktif"}</small></div><strong>{form.name || "Nama koleksi musiman"}</strong><p>{form.description || "Deskripsi koleksi akan tampil di area pilihan resep pengguna."}</p><div>{draftRecipes.length ? draftRecipes.map((recipe) => <span key={recipe.id}>{recipe.title}</span>) : <em>Pilih resep untuk melihat isi koleksi.</em>}</div></aside>
        <button className="primary-action seasonal-save" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? <><LoaderCircle className="spin-icon" size={16} /> Menyimpan…</> : <><Save size={16} /> {editingId ? "Simpan pembaruan" : "Buat koleksi"}</>}</button>
      </form>
      <section className="seasonal-collection-list"><div className="admin-section-heading"><div><span className="eyebrow">KOLEKSI TERDAFTAR</span><h2>Yang sedang dikurasi.</h2></div><span>{managedCollections.length} KOLEKSI</span></div>{managedCollections.length ? <div>{managedCollections.map((collection) => <article key={collection.id}><header><span className={`seasonal-tag ${collection.season}`}>{collection.season === "ramadan" ? "RAMADAN" : "LEBARAN"}</span><span className={collection.isActive ? "is-active" : "is-inactive"}>{collection.isActive ? "AKTIF" : "NONAKTIF"}</span></header><h3>{collection.name}</h3><p>{collection.description}</p><div className="seasonal-schedule-summary"><span>{collection.startsAt ? `Mulai ${formatDate(collection.startsAt)}` : "Mulai langsung"}</span><span>{collection.endsAt ? `Berakhir ${formatDate(collection.endsAt)}` : "Tanpa tanggal berakhir"}</span></div><div className="seasonal-recipe-pills">{collection.recipeIds.map((recipeId) => <span key={recipeId}>{recipeMap.get(recipeId) ?? recipeId}</span>)}</div><footer><small>Diubah {formatDate(collection.updatedAt)}</small><span><button type="button" onClick={() => beginEdit(collection)}><Pencil size={13} /> Edit</button><button type="button" className="seasonal-duplicate" onClick={() => duplicate.mutate({ id: collection.id })} disabled={duplicate.isPending}><Copy size={13} /> Duplikasi</button></span></footer></article>)}</div> : <p className="seasonal-empty">Belum ada koleksi. Buat satu koleksi untuk menampilkan kelompok resep yang lebih terarah di studio.</p>}</section>
    </section>
  </main>;
}
