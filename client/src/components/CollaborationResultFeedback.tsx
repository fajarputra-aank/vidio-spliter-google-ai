import { Flag, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const reasons = [{ id: "face_mismatch", label: "Wajah kurang sesuai" }, { id: "subject_changed", label: "Subjek berubah" }, { id: "background_issue", label: "Latar kurang sesuai" }, { id: "other", label: "Lainnya" }] as const;

export function CollaborationResultFeedback({ transformId }: { transformId: number }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState<(typeof reasons)[number]["id"]>("face_mismatch"); const [details, setDetails] = useState("");
  const report = trpc.photo.reportCollaborationResult.useMutation({ onSuccess: () => { setOpen(false); setDetails(""); toast.success("Umpan balik privat telah dikirim untuk ditinjau tim administrator."); }, onError: (error) => toast.error(error.message) });
  if (!open) return <button type="button" className="collaboration-feedback-trigger" onClick={() => setOpen(true)}><Flag size={12} /> Laporkan hasil</button>;
  return <form className="collaboration-feedback-form" onSubmit={(event) => { event.preventDefault(); report.mutate({ transformId, reason, details: details.trim() || undefined }); }}><strong><Flag size={12} /> Umpan balik privat</strong><select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>{reasons.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><textarea value={details} maxLength={320} onChange={(event) => setDetails(event.target.value)} placeholder="Jelaskan bagian yang kurang sesuai (opsional, maksimal 320 karakter)." /><div><button type="button" onClick={() => setOpen(false)}>Batal</button><button type="submit" disabled={report.isPending}>{report.isPending ? <><LoaderCircle className="spin-icon" size={12} /> Mengirim…</> : "Kirim laporan"}</button></div><small>Laporan hanya memuat kategori dan catatanmu; foto, tautan, dan sumber privat tidak diteruskan.</small></form>;
}
