import React, { useMemo, useState } from "react";
import { Archive, CheckSquare, LoaderCircle, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type FailedTransform = { id: number; title: string; createdAt: Date | string; errorMessage?: string | null; isHidden?: boolean };
type FailureKind = "all" | "capacity" | "connection" | "validation" | "other";

function failureKind(message?: string | null): Exclude<FailureKind, "all"> {
  const value = (message ?? "").toLowerCase();
  if (/batas|kuota|kapasitas|limit/.test(value)) return "capacity";
  if (/jaringan|koneksi|sementara|timeout|server/.test(value)) return "connection";
  if (/format|ukuran|tidak dapat dibaca|validasi/.test(value)) return "validation";
  return "other";
}

export function FailedPhotoDeletePanel({ items, archivedItems, formatDate }: { items: FailedTransform[]; archivedItems: FailedTransform[]; formatDate: (value: Date | string) => string }) {
  const utils = trpc.useUtils();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<FailureKind>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const filtered = useMemo(() => items.filter((item) => {
    const date = new Date(item.createdAt).toISOString().slice(0, 10);
    return item.title.toLowerCase().includes(query.trim().toLowerCase()) && (kind === "all" || failureKind(item.errorMessage) === kind) && (!from || date >= from) && (!to || date <= to);
  }), [from, items, kind, query, to]);
  const refresh = async () => { await Promise.all([utils.photo.list.invalidate(), utils.photo.getById.invalidate(), utils.photo.collaborationProjects.invalidate()]); };
  const archive = trpc.photo.setHidden.useMutation({ onSuccess: async (_, input) => { await refresh(); toast.success(input.isHidden ? "Proses gagal diarsipkan. Tidak dihapus permanen." : "Proses gagal dipulihkan ke riwayat aktif."); }, onError: (error) => toast.error(error.message) });
  const remove = trpc.photo.deleteFailedTransforms.useMutation({ onSuccess: async (result) => { await refresh(); setSelectedIds([]); setConfirmOpen(false); toast.success(`${result.deletedCount} proses gagal dihapus permanen.`); }, onError: (error) => toast.error(error.message) });
  const allFilteredSelected = filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id));
  const toggle = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleVisible = () => setSelectedIds((current) => allFilteredSelected ? current.filter((id) => !filtered.some((item) => item.id === id)) : Array.from(new Set([...current, ...filtered.map((item) => item.id)])));
  if (!items.length && !archivedItems.length) return null;
  return <section className="failed-delete-desk" aria-label="Kelola transformasi gagal"><div className="failed-delete-heading"><div><span className="eyebrow">KELOLA RIWAYAT GAGAL</span><h2>Atur proses yang<br /><em>tidak selesai.</em></h2><p>Pilih beberapa proses untuk dihapus permanen, atau arsipkan satu per satu bila ingin menyimpannya tanpa memenuhi riwayat aktif.</p></div><span><Trash2 size={13} /> {items.length} aktif · {archivedItems.length} arsip</span></div>{items.length > 0 && <><div className="failed-delete-filters"><label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul proses gagal" /></label><select value={kind} onChange={(event) => setKind(event.target.value as FailureKind)}><option value="all">Semua jenis kegagalan</option><option value="capacity">Kapasitas AI</option><option value="connection">Koneksi sementara</option><option value="validation">Validasi foto</option><option value="other">Lainnya</option></select><label><span>Dari</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label><span>Sampai</span><input type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} /></label></div><div className="failed-delete-bulk"><button type="button" onClick={toggleVisible}><CheckSquare size={14} /> {allFilteredSelected ? "Batal pilih yang tampil" : "Pilih semua yang tampil"}</button><span>{selectedIds.length ? `${selectedIds.length} proses dipilih` : "Pilih proses gagal untuk dihapus"}</span>{selectedIds.length > 0 && <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}><AlertDialogTrigger asChild><button type="button" className="failed-bulk-remove"><Trash2 size={14} /> Hapus {selectedIds.length} proses</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus {selectedIds.length} proses gagal?</AlertDialogTitle><AlertDialogDescription>Proses gagal yang dipilih akan dihapus permanen dari riwayat privat. Foto atau hasil lain tidak terpengaruh.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={remove.isPending}>Batal</AlertDialogCancel><AlertDialogAction className="delete-photo-confirm" disabled={remove.isPending} onClick={() => remove.mutate({ transformIds: selectedIds })}>{remove.isPending ? <><LoaderCircle className="spin-icon" size={14} /> Menghapus…</> : "Ya, hapus pilihan"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div><div className="failed-delete-list">{filtered.length ? filtered.map((item) => <article key={item.id}><label className="failed-select"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)} /> Pilih</label><div><strong>{item.title}</strong><small>{formatDate(item.createdAt)} · {item.errorMessage || "Transformasi tidak selesai."}</small></div><button type="button" className="failed-archive-trigger" disabled={archive.isPending} onClick={() => archive.mutate({ transformId: item.id, isHidden: true })}><Archive size={14} /> Arsipkan</button></article>) : <p className="failed-delete-empty">Tidak ada proses gagal yang cocok dengan filter.</p>}</div></>}{archivedItems.length > 0 && <div className="failed-archive-list"><strong><Archive size={14} /> Arsip proses gagal</strong>{archivedItems.map((item) => <article key={item.id}><span>{item.title} · {formatDate(item.createdAt)}</span><button type="button" disabled={archive.isPending} onClick={() => archive.mutate({ transformId: item.id, isHidden: false })}><RotateCcw size={13} /> Pulihkan</button></article>)}</div>}</section>;
}
