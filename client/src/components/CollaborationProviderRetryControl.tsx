import { Clock3, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function CollaborationProviderRetryControl({ transformId, errorMessage }: { transformId: number; errorMessage: string | null }) {
  const utils = trpc.useUtils();
  const queued = trpc.photo.queueCollaborationProviderRetry.useMutation({
    onSuccess: async (queue) => {
      await utils.photo.collaborationProjects.invalidate();
      toast.success(queue.priority === "admin" ? "Masuk antrean prioritas admin. Kami memberi tahu Anda saat hasil siap." : "Masuk antrean pemulihan. Kami memberi tahu Anda saat hasil siap.");
    },
    onError: (error) => toast.error(error.message),
  });
  if (!/^(Kapasitas penyedia AI|Layanan AI sedang mencapai batas)/.test(errorMessage ?? "")) return null;
  return <div className="collaboration-provider-retry"><p><Clock3 size={13} /> Kapasitas penyedia AI penuh; sumber privat Anda sudah tersimpan.</p><button type="button" onClick={() => queued.mutate({ sourceTransformId: transformId })} disabled={queued.isPending}>{queued.isPending ? <><LoaderCircle className="spin-icon" size={13} /> Menambahkan…</> : <><RefreshCw size={13} /> Coba lagi saat siap</>}</button><small><ShieldCheck size={12} /> Administrator diproses lebih dahulu ketika kapasitas kembali tersedia.</small></div>;
}
