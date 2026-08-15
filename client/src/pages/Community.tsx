import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Heart, LoaderCircle, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Community() {
  const { isAuthenticated } = useAuth();
  const postsQuery = trpc.community.list.useQuery();
  const utils = trpc.useUtils();
  const like = trpc.community.toggleLike.useMutation({ onSuccess: () => void utils.community.list.invalidate(), onError: (error) => toast.error(error.message) });
  function toggleLike(postId: number) {
    if (!isAuthenticated) return startLogin();
    like.mutate({ postId });
  }

  return <main className="community-page"><header className="community-header"><Link href="/"><ArrowLeft size={16} /> Kembali ke studio</Link><span className="community-wordmark"><span className="aperture-mark" />Lensa Saku / ruang komunitas</span><Link href="/profil">Profilku</Link></header><section className="community-hero"><span className="eyebrow">CONTACT SHEET PUBLIK / 01</span><h1>Frame yang<br /><em>memantulkan ide.</em></h1><p>Ruang ini hanya memuat hasil yang sengaja diterbitkan oleh pemiliknya. Beri apresiasi pada karya yang membuatmu berhenti sejenak.</p></section><section className="community-grid-section"><div className="community-grid-heading"><span>ARSIP TERBIT / TERBARU DULU</span><span>{postsQuery.data?.length ?? 0} FRAME</span></div>{postsQuery.isLoading ? <div className="community-empty"><LoaderCircle className="spin-icon" size={22} /> Membuka contact sheet...</div> : postsQuery.data?.length ? <div className="community-grid">{postsQuery.data.map((post, index) => <article key={post.id}><div className="community-image"><img src={post.resultUrl} alt={post.caption || "Karya komunitas Lensa Saku"} /><span>F-{String(index + 1).padStart(3, "0")}</span></div><div className="community-meta"><p>{post.caption || "Karya publik tanpa catatan."}</p><small>oleh {post.authorName} · {new Date(post.createdAt).toLocaleDateString("id-ID")}</small><button className={post.likedByViewer ? "is-liked" : ""} disabled={like.isPending} onClick={() => toggleLike(post.id)}><Heart size={15} fill={post.likedByViewer ? "currentColor" : "none"} /> {post.likes}</button></div></article>)}</div> : <div className="community-empty"><Sparkles size={24} /><strong>Belum ada frame yang diterbitkan.</strong><p>Terbitkan hasil terbaikmu dari profil untuk memulai contact sheet publik ini.</p><Link href="/profil" className="primary-action">Buka profil</Link></div>}</section></main>;
}
