import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, Bell, CheckSquare, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type PreferencesDraft = { communityModeration: boolean; accountActivity: boolean; productUpdates: boolean };
const initialPreferences: PreferencesDraft = { communityModeration: true, accountActivity: true, productUpdates: false };

export default function NotificationSettings() {
  const { loading: authLoading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const preferencesQuery = trpc.notifications.preferences.useQuery(undefined, { enabled: isAuthenticated });
  const [draft, setDraft] = useState<PreferencesDraft>(initialPreferences);
  const savePreferences = trpc.notifications.updatePreferences.useMutation({ onSuccess: () => { toast.success("Preferensi notifikasi disimpan."); void preferencesQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  useEffect(() => { if (preferencesQuery.data) setDraft({ communityModeration: preferencesQuery.data.communityModeration, accountActivity: preferencesQuery.data.accountActivity, productUpdates: preferencesQuery.data.productUpdates }); }, [preferencesQuery.data]);
  if (authLoading || !isAuthenticated || preferencesQuery.isLoading) return <main className="settings-loading proof-loading"><span className="aperture-mark" /><LoaderCircle className="spin-icon" size={24} /> Membuka pengaturan notifikasi...</main>;
  if (preferencesQuery.isError) return <main className="settings-loading"><strong>Pengaturan belum dapat dimuat.</strong><button className="secondary-action" onClick={() => void preferencesQuery.refetch()}>Muat ulang</button></main>;
  return <main className="settings-page"><header className="settings-header"><Link href="/profil"><ArrowLeft size={16} /> Kembali ke profil</Link><div className="profile-wordmark"><span className="aperture-mark" /><strong>Lensa Saku</strong><small>PENGATURAN</small></div></header><section className="settings-intro"><span className="eyebrow">PREFERENSI PRIBADI / 01</span><h1>Pilih pesan yang<br /><em>ingin kamu terima.</em></h1><p>Pengaturan ini berlaku khusus pada akunmu. Menonaktifkan suatu jenis pesan tidak memengaruhi riwayat foto, album, atau akses ke studio.</p></section><section className="settings-card"><div className="settings-card-heading"><div><Bell size={18} /><span>JENIS PEMBERITAHUAN</span></div><small>PERUBAHAN DISIMPAN PRIVAT</small></div><label className="settings-choice"><input type="checkbox" checked={draft.communityModeration} onChange={(event) => setDraft((current) => ({ ...current, communityModeration: event.target.checked }))} /><span><ShieldCheck size={19} /><strong>Moderasi komunitas</strong><p>Terima pemberitahuan saat karya publikmu ditinjau atau ditindak oleh moderator. Frame privatmu tidak dihapus.</p></span></label><label className="settings-choice"><input type="checkbox" checked={draft.accountActivity} onChange={(event) => setDraft((current) => ({ ...current, accountActivity: event.target.checked }))} /><span><CheckSquare size={19} /><strong>Aktivitas studio</strong><p>Terima pemberitahuan ketika transformasi AI sudah selesai dan siap ditinjau di arsip privat.</p></span></label><footer><div><UserRound size={15} /><span>Hanya akunmu yang dapat melihat atau mengubah pilihan ini.</span></div><button disabled={savePreferences.isPending} onClick={() => savePreferences.mutate(draft)}>{savePreferences.isPending ? "Menyimpan..." : "Simpan preferensi"}</button></footer></section></main>;
}
