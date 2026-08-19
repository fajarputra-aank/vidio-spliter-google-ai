import { ImagePlus, LoaderCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const backgrounds = [
  { id: "keep", label: "Pertahankan latar" },
  { id: "studio-ivory", label: "Studio ivory" },
  { id: "soft-gray", label: "Studio abu lembut" },
  { id: "charcoal", label: "Studio charcoal" },
  { id: "cafe", label: "Kafe hangat" },
  { id: "garden", label: "Taman natural" },
  { id: "office", label: "Kantor minimal" },
] as const;

export function CollaborationRefineControls({ transformId }: { transformId: number }) {
  const utils = trpc.useUtils();
  const [background, setBackground] = useState<(typeof backgrounds)[number]["id"]>("keep");
  const retry = trpc.photo.retryCollaboration.useMutation({
    onSuccess: async () => {
      await utils.photo.collaborationProjects.invalidate();
      toast.success("Proses ulang dimulai dari dua sumber asli. Hasil lama tetap tersimpan privat.");
    },
    onError: (error) => toast.error(error.message),
  });
  return <div className="collaboration-refine-controls"><span><ImagePlus size={12} /> Latar hasil & proses ulang</span><select value={background} onChange={(event) => setBackground(event.target.value as typeof background)} aria-label="Pilih latar hasil"><option value="keep">Pertahankan latar saat ini</option>{backgrounds.slice(1).map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select><button type="button" disabled={retry.isPending} onClick={() => { if (window.confirm(background === "keep" ? "Ulangi proses dari dua foto sumber asli? Hasil lama tetap tersimpan." : "Buat ulang hasil dengan latar baru? Subjek utama dan wajah tetap diprioritaskan.")) retry.mutate({ transformId, background, requestId: crypto.randomUUID() }); }}><RotateCcw size={12} /> {retry.isPending ? <><LoaderCircle className="spin-icon" size={12} /> Memproses…</> : background === "keep" ? "Ulangi proses" : "Ganti latar & ulangi"}</button><small>Hasil baru dibuat sebagai frame privat terpisah. Hanya latar yang boleh berubah; subjek, wajah, dan identitas tetap dijaga.</small></div>;
}
