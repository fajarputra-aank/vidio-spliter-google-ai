import { useAuth } from "@/_core/hooks/useAuth";
import { CollaborationRefineControls } from "@/components/CollaborationRefineControls";
import { CollaborationResultFeedback } from "@/components/CollaborationResultFeedback";
import { CollaborationRetryComparison } from "@/components/CollaborationRetryComparison";
import { CollaborationShareControls } from "@/components/CollaborationShareControls";
import { CollaborationProviderRetryControl } from "@/components/CollaborationProviderRetryControl";
import { MediaImage } from "@/components/MediaImage";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, Filter, Images, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

const templates = ["", "free", "couple", "product"] as const;
const statuses = ["", "processing", "completed", "failed", "cancelled"] as const;

export default function CollaborationHistory() {
  const { loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const [template, setTemplate] = useState<(typeof templates)[number]>("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("");
  const filters = useMemo(() => ({ template: template || undefined, status: status || undefined }), [status, template]);
  const projects = trpc.photo.collaborationProjects.useQuery(filters, { enabled: isAuthenticated });
  if (loading || !isAuthenticated) return <main className="collaboration-loading"><LoaderCircle className="spin-icon" size={24} /> Membuka riwayat kolaborasi…</main>;
  return <main className="collaboration-history-page">
    <header className="collaboration-header"><Link href="/kolaborasi"><ArrowLeft size={16} /> Kembali ke kolaborasi</Link><span><Images size={17} /> Lensa Saku / riwayat</span><Link href="/profil">Koleksi privat</Link></header>
    <section className="collaboration-history-hero"><span className="eyebrow">ARSIP PRIVAT / KOLABORASI</span><h1>Proyek yang<br /><em>pernah disatukan.</em></h1><p>Riwayat ini hanya menampilkan proyek Kolaborasi Foto milikmu. Ulangi proses dari dua sumber asli, bandingkan versi, atau beri umpan balik tanpa menimpa hasil sebelumnya.</p></section>
    <section className="collaboration-history-filters" aria-label="Filter riwayat kolaborasi"><span><Filter size={14} /> Filter riwayat</span><label>Template<select value={template} onChange={(event) => setTemplate(event.target.value as typeof template)}>{templates.map((item) => <option key={item} value={item}>{item === "" ? "Semua template" : item === "free" ? "Komposisi bebas" : item === "couple" ? "Pasangan" : "Dua produk"}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{statuses.map((item) => <option key={item} value={item}>{item === "" ? "Semua status" : item === "processing" ? "Diproses" : item === "completed" ? "Selesai" : item === "failed" ? "Gagal" : "Dibatalkan"}</option>)}</select></label></section>
    <section className="collaboration-history-grid">{projects.isLoading ? <div className="collaboration-history-empty"><LoaderCircle className="spin-icon" size={22} /> Memuat proyek…</div> : projects.data?.length ? projects.data.map((project) => <article key={project.id}><div className="collaboration-history-image">{project.resultUrl ? <MediaImage src={project.resultUrl} alt={project.title} /> : <span>{project.status.toUpperCase()}</span>}</div><div><span>{(project.template || "free").toUpperCase()} · {project.aspectRatio}</span><h2>{project.title}</h2><p>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(project.createdAt))} · {project.status === "completed" ? "Selesai" : project.status === "failed" ? "Gagal" : project.status === "cancelled" ? "Dibatalkan" : "Diproses"}</p>{project.status === "failed" ? <CollaborationProviderRetryControl transformId={project.id} errorMessage={project.errorMessage} /> : null}{project.resultUrl && <><a href={project.resultUrl} download><Download size={14} /> Unduh hasil</a><CollaborationRefineControls transformId={project.id} /><CollaborationResultFeedback transformId={project.id} />{project.retryOfTransformId ? <CollaborationRetryComparison transformId={project.id} /> : null}<CollaborationShareControls transformId={project.id} /></>}</div></article>) : <div className="collaboration-history-empty"><Images size={26} /><strong>Tidak ada proyek yang cocok.</strong><p>Ubah filter atau buat Kolaborasi Foto baru untuk menambah arsip privatmu.</p><Link href="/kolaborasi">Buka Kolaborasi Foto</Link></div>}</section>
  </main>;
}
