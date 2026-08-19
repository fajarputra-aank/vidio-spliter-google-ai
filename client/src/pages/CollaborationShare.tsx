import { LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";

export default function CollaborationShare() {
  const { token } = useParams<{ token: string }>(); const preview = trpc.photo.collaborationSharePreview.useQuery({ token: token || "" }, { enabled: Boolean(token), retry: false });
  if (preview.isLoading) return <main className="collaboration-share-page"><LoaderCircle className="spin-icon" size={24} /> Memeriksa tautan berbagi…</main>;
  if (preview.isError || !preview.data || !token) return <main className="collaboration-share-page"><LockKeyhole size={28} /><h1>Tautan tidak tersedia.</h1><p>Tautan ini mungkin telah dicabut atau melewati masa berlakunya.</p></main>;
  return <main className="collaboration-share-page"><section><span className="eyebrow"><Sparkles size={13} /> KOLABORASI FOTO</span><h1>{preview.data.title}</h1><p>Hasil ini dibagikan melalui tautan sementara dan akan berakhir pada {new Date(preview.data.expiresAt).toLocaleString("id-ID")}.</p><img src={`/api/collaboration-share/${encodeURIComponent(token)}`} alt={preview.data.title} /><small>{preview.data.hasWatermark ? "Watermark otomatis diterapkan pada salinan tautan ini. " : ""}Hanya hasil akhir yang tersedia melalui tautan ini. Foto sumber tetap privat.</small></section></main>;
}
