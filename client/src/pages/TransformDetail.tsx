import { useAuth } from "@/_core/hooks/useAuth";
import { MediaImage } from "@/components/MediaImage";
import { trpc } from "@/lib/trpc";
import { formatProcessDuration } from "@/lib/processDuration";
import { downloadTransformActivityCsv } from "@/lib/transformActivityCsv";
import { downloadShareHistoryCsv } from "@/lib/shareHistoryCsv";
import { ArrowLeft, Clock3, Download, History, RotateCcw, Sparkles } from "lucide-react";
import { Link, useRoute } from "wouter";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function TransformDetail() {
  const { isAuthenticated, loading } = useAuth();
  const [, params] = useRoute("/koleksi/:id");
  const transformId = Number(params?.id);
  const detail = trpc.photo.getById.useQuery({ transformId }, { enabled: isAuthenticated && Number.isInteger(transformId) && transformId > 0 });
  const shareHistory = trpc.photo.shareHistory.useQuery({ transformId }, { enabled: isAuthenticated && Number.isInteger(transformId) && transformId > 0 });

  if (loading || detail.isLoading) return <main className="transform-detail-page"><section className="transform-detail-guard"><span>AKTIVITAS PRIVAT</span><h1>Memuat jejak transformasi…</h1><p>Kami sedang memeriksa riwayat yang tersimpan untuk akun ini.</p></section></main>;
  if (!isAuthenticated) return <main className="transform-detail-page"><section className="transform-detail-guard"><span>AKTIVITAS PRIVAT</span><h1>Masuk untuk melihat aktivitas ini.</h1><p>Detail transformasi hanya tersedia bagi pemilik akun dan tidak pernah ditampilkan secara publik.</p><Link href="/masuk">Masuk ke studio <ArrowLeft size={15} /></Link></section></main>;
  if (detail.isError || !detail.data) return <main className="transform-detail-page"><section className="transform-detail-guard"><span>AKTIVITAS PRIVAT</span><h1>Aktivitas tidak ditemukan.</h1><p>Detail hanya tersedia untuk transformasi di akunmu sendiri.</p><Link href="/">Kembali ke koleksi <ArrowLeft size={15} /></Link></section></main>;

  const item = detail.data;
  const statusLabel = item.status === "completed" ? "Selesai" : item.status === "failed" ? "Gagal" : item.status === "cancelled" ? "Dibatalkan" : "Diproses";
  const events = [
    { label: "Transformasi dibuat", time: item.createdAt, detail: item.queuePosition ? `Masuk sebagai perkiraan antrean #${item.queuePosition}.` : "Masuk ke antrean AI." },
    ...(item.autoRetryAt ? [{ label: "Coba ulang otomatis", time: item.autoRetryAt, detail: "Gangguan sementara terdeteksi; sistem mencoba sekali lagi." }] : []),
    ...(item.completedAt ? [{ label: statusLabel, time: item.completedAt, detail: item.status === "completed" ? "Hasil tersimpan di galeri privat." : item.errorMessage || "Status transformasi diperbarui." }] : []),
    ...(shareHistory.data ?? []).map((event) => ({ label: `Berbagi ${event.platform}`, time: event.createdAt, detail: `${event.outcome === "shared" ? "Dikirim melalui lembar berbagi perangkat" : event.outcome === "copied" ? "Tautan hasil disalin" : "Salinan hasil diunduh"}${event.watermarkText ? ` · watermark: ${event.watermarkText}` : ""}.` })),
  ];

  return <main className="transform-detail-page"><header><Link href="/"><ArrowLeft size={16} /> Kembali ke koleksi</Link><span>AKTIVITAS PRIVAT / {String(item.id).padStart(5, "0")}</span></header><section className="transform-detail-hero"><div><span className="eyebrow">TRANSFORMASI {statusLabel.toUpperCase()}</span><h1>{item.title}</h1><p>{item.style} · {item.aspectRatio} · Durasi aktual {formatProcessDuration(item.createdAt, item.completedAt)}</p></div><div className={`transform-status ${item.status}`}>{statusLabel}</div></section><section className="transform-detail-grid"><article className="transform-proof"><MediaImage src={item.resultUrl || item.sourceUrl} alt={`Hasil ${item.title}`} fallbackLabel="Berkas transformasi" /><span>FRAME / {String(item.id).padStart(5, "0")}</span></article><article className="transform-activity"><div className="detail-heading"><History size={17} /><div><span>JEJAK AKTIVITAS</span><h2>Setiap langkah tercatat.</h2></div><div className="detail-export-group"><button type="button" className="detail-export" onClick={() => downloadTransformActivityCsv(item)}><Download size={14} /> Aktivitas CSV</button>{shareHistory.data?.length ? <button type="button" className="detail-export" onClick={() => downloadShareHistoryCsv(shareHistory.data, item.id)}><Download size={14} /> Berbagi CSV</button> : null}</div></div><div className="activity-timeline">{events.map((event, index) => <div key={`${event.label}-${index}`}><i /><div><strong>{event.label}</strong><small>{formatDate(event.time)}</small><p>{event.detail}</p></div></div>)}</div>{item.retryOfTransformId && <div className="detail-note"><RotateCcw size={15} /><span>Ini adalah percobaan ulang dari transformasi #{item.retryOfTransformId}.{item.retryInstruction ? ` Catatan privat: ${item.retryInstruction}` : ""}</span></div>}<div className="detail-meta"><span><Clock3 size={14} /> Percobaan layanan: {item.providerAttemptCount}</span>{item.queuePosition && <span><Sparkles size={14} /> Antrean awal: #{item.queuePosition}</span>}</div></article></section></main>;
}
