import React, { useMemo, useState } from "react";
import { ArchiveRestore, ArrowLeft, CheckSquare, Images, LoaderCircle, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { MediaImage } from "@/components/MediaImage";
import { DeletePhotoResultControl } from "@/components/DeletePhotoResultControl";
import "./photoTrash.css";

function formatExpiry(value: Date | string | null) { return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value)) : "—"; }

export default function PhotoTrash() {
  const { loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const active = trpc.photo.list.useQuery(undefined, { enabled: isAuthenticated });
  const trash = trpc.photo.trash.useQuery(undefined, { enabled: isAuthenticated });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const activeResults = useMemo(() => (active.data ?? []).filter((photo) => photo.status === "completed" && photo.resultUrl), [active.data]);
  const moveToTrash = trpc.photo.moveToTrash.useMutation({ onSuccess: async (result) => { setSelectedIds([]); await Promise.all([utils.photo.list.invalidate(), utils.photo.trash.invalidate(), utils.photo.collaborationProjects.invalidate()]); toast.success(`${result.trashedCount} foto dipindahkan ke Sampah hingga ${formatExpiry(result.trashExpiresAt)}.`); }, onError: (error) => toast.error(error.message) });
  const restore = trpc.photo.restoreFromTrash.useMutation({ onSuccess: async () => { await Promise.all([utils.photo.list.invalidate(), utils.photo.trash.invalidate()]); toast.success("Foto dipulihkan ke riwayat privat. Tautan publik lama tetap tidak aktif."); }, onError: (error) => toast.error(error.message) });
  const toggle = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAll = () => setSelectedIds((current) => current.length === activeResults.length ? [] : activeResults.map((photo) => photo.id));
  if (loading || !isAuthenticated) return <main className="photo-trash-loading"><LoaderCircle className="spin-icon" size={24} /> Membuka Sampah foto…</main>;
  return <main className="photo-trash-page"><header><Link href="/profil"><ArrowLeft size={16} /> Kembali ke profil</Link><span><Trash2 size={16} /> Sampah foto</span></header><section className="photo-trash-hero"><span className="eyebrow">SAMPah PRIBADI / 30 HARI</span><h1>Kelola foto yang<br /><em>baru dihapus.</em></h1><p>Foto di Sampah tetap privat dan tidak dapat diakses melalui tautan lama. Pulihkan sebelum masa 30 hari berakhir, atau hapus permanen jika sudah yakin.</p></section><section className="photo-trash-active"><div className="photo-trash-heading"><div><span className="eyebrow">RIWAYAT AKTIF</span><h2>Pilih beberapa foto.</h2></div><button type="button" onClick={toggleAll} disabled={!activeResults.length}><CheckSquare size={14} /> {selectedIds.length === activeResults.length && activeResults.length ? "Batal pilih semua" : "Pilih semua"}</button></div>{selectedIds.length ? <div className="photo-trash-bulk"><span>{selectedIds.length} foto dipilih</span><button type="button" disabled={moveToTrash.isPending} onClick={() => moveToTrash.mutate({ transformIds: selectedIds })}><Trash2 size={14} /> {moveToTrash.isPending ? "Memindahkan…" : "Pindahkan ke Sampah"}</button></div> : null}<div className="photo-trash-grid">{active.isLoading ? <p><LoaderCircle className="spin-icon" size={18} /> Memuat riwayat…</p> : activeResults.length ? activeResults.map((photo) => <article key={photo.id} className={selectedIds.includes(photo.id) ? "is-selected" : ""}><label><input type="checkbox" checked={selectedIds.includes(photo.id)} onChange={() => toggle(photo.id)} /> Pilih</label><MediaImage src={photo.resultUrl!} alt={photo.title} /><strong>{photo.title}</strong><small>{photo.style} · {photo.aspectRatio}</small></article>) : <p>Belum ada hasil foto aktif yang dapat dipindahkan.</p>}</div></section><section className="photo-trash-bin"><div className="photo-trash-heading"><div><span className="eyebrow">SAMPah</span><h2>Pulihkan dalam 30 hari.</h2></div><span>{trash.data?.length ?? 0} foto</span></div><div className="photo-trash-grid">{trash.isLoading ? <p><LoaderCircle className="spin-icon" size={18} /> Memuat Sampah…</p> : trash.data?.length ? trash.data.map((photo) => <article key={photo.id}><MediaImage src={photo.resultUrl ?? photo.sourceUrl} alt={photo.title} /><strong>{photo.title}</strong><small>Pemulihan sampai {formatExpiry(photo.trashExpiresAt)}</small><div><button type="button" disabled={restore.isPending} onClick={() => restore.mutate({ transformId: photo.id })}><ArchiveRestore size={14} /> Pulihkan</button><DeletePhotoResultControl transformId={photo.id} className="trash-permanent-delete" /></div></article>) : <p><Images size={18} /> Sampah kosong.</p>}</div></section></main>;
}
