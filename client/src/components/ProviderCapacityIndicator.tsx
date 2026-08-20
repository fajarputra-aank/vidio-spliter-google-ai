import { CircleAlert, CircleCheck, CircleHelp, LoaderCircle, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import "./providerCapacityIndicator.css";

export function ProviderCapacityIndicator() {
  const capacity = trpc.photo.aiProviderCapacity.useQuery();
  const failedProjects = trpc.photo.collaborationProjects.useQuery({ status: "failed" });
  const providerFailedProject = failedProjects.data?.find((project) => /^(Kapasitas penyedia AI|Layanan AI sedang mencapai batas)/.test(project.errorMessage ?? ""));
  const queueRetry = trpc.photo.queueCollaborationProviderRetry.useMutation({ onSuccess: async (queue) => { await failedProjects.refetch(); toast.success(queue.priority === "admin" ? "Masuk antrean prioritas admin. Notifikasi akan dikirim saat hasil siap." : "Masuk antrean pemulihan. Notifikasi akan dikirim saat hasil siap."); }, onError: (error) => toast.error(error.message) });
  const status = capacity.data?.status ?? "unknown";
  const observedAt = capacity.data?.observedAt ? new Date(capacity.data.observedAt).toLocaleString("id-ID") : null;
  const retryAt = capacity.data?.retryAt ? new Date(capacity.data.retryAt).toLocaleString("id-ID") : null;
  const content = status === "available"
    ? { icon: CircleCheck, title: "Penyedia AI terakhir terverifikasi tersedia", body: observedAt ? `Status terakhir dicatat ${observedAt}.` : "Belum ada waktu pemeriksaan yang tersedia." }
    : status === "unavailable"
      ? { icon: CircleAlert, title: "Kapasitas penyedia AI sedang penuh", body: retryAt ? `Jangan unggah ulang foto. Anda dapat mencoba lagi atau memakai antrean pemulihan sekitar ${retryAt}.` : "Jangan unggah ulang foto. Gunakan antrean pemulihan setelah kapasitas tersedia." }
      : { icon: CircleHelp, title: "Status kapasitas penyedia belum terverifikasi", body: "Status akan diperbarui otomatis setelah proses Kolaborasi berhasil atau penyedia melaporkan kapasitas penuh." };
  const Icon = content.icon;
  return <aside className={`provider-capacity-indicator is-${status}`} role="status" data-testid="provider-capacity-indicator"><Icon size={16} /><div><span>STATUS PENYEDIA AI</span><strong>{content.title}</strong><p>{content.body}</p>{status === "unavailable" && providerFailedProject ? <button className="provider-capacity-retry" type="button" onClick={() => queueRetry.mutate({ sourceTransformId: providerFailedProject.id })} disabled={queueRetry.isPending}>{queueRetry.isPending ? <><LoaderCircle className="spin-icon" size={13} /> Menambahkan ke antrean…</> : <><RefreshCw size={13} /> Coba lagi saat siap</>}</button> : null}</div><button type="button" onClick={() => void capacity.refetch()} disabled={capacity.isFetching}>{capacity.isFetching ? <RefreshCw className="spin-icon" size={14} /> : "Perbarui"}</button></aside>;
}
