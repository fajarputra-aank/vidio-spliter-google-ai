import React, { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function EmptyPhotoTrashControl({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const utils = trpc.useUtils();
  const empty = trpc.photo.emptyTrash.useMutation({
    onSuccess: async (result) => { await Promise.all([utils.photo.trash.invalidate(), utils.photo.list.invalidate(), utils.photo.collaborationProjects.invalidate()]); setConfirmation(""); setOpen(false); toast.success(result.deletedCount ? `${result.deletedCount} foto dihapus permanen dari Sampah.` : "Sampah sudah kosong."); },
    onError: (error) => toast.error(error.message),
  });
  return <AlertDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setConfirmation(""); }}><AlertDialogTrigger asChild><button type="button" className="empty-trash-trigger" disabled={disabled}><Trash2 size={14} /> Kosongkan Sampah</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kosongkan seluruh Sampah?</AlertDialogTitle><AlertDialogDescription>Semua foto di Sampah akan dihapus permanen beserta data turunan yang masih tersisa. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader><label className="empty-trash-confirmation"><span>Ketik <b>KOSONGKAN</b> untuk melanjutkan</span><input value={confirmation} maxLength={10} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} placeholder="KOSONGKAN" aria-label="Konfirmasi kosongkan Sampah" /></label><AlertDialogFooter><AlertDialogCancel disabled={empty.isPending}>Batal</AlertDialogCancel><AlertDialogAction className="empty-trash-action" disabled={empty.isPending || confirmation !== "KOSONGKAN"} onClick={() => empty.mutate()}>{empty.isPending ? <><LoaderCircle className="spin-icon" size={14} /> Menghapus…</> : "Hapus seluruh foto"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
