import React, { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import "./deletePhotoResult.css";

export function DeletePhotoResultControl({ transformId, onDeleted, className = "" }: { transformId: number; onDeleted?: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const remove = trpc.photo.deletePhotoTransform.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.photo.list.invalidate(), utils.photo.collaborationProjects.invalidate(), utils.photo.getById.invalidate()]);
      setOpen(false); onDeleted?.();
      toast.success(result.revokedShareLinks ? `Foto dihapus dan ${result.revokedShareLinks} tautan berbagi dicabut.` : "Foto dihapus dari riwayat privat.");
    },
    onError: (error) => toast.error(error.message),
  });
  return <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogTrigger asChild><button type="button" className={className} data-testid="delete-photo-result"><Trash2 size={15} /> Hapus foto</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus foto ini?</AlertDialogTitle><AlertDialogDescription>Foto akan dihapus dari riwayat, album, serta publikasi komunitas terkait. Tautan berbagi aktif juga dicabut. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={remove.isPending}>Batal</AlertDialogCancel><AlertDialogAction className="delete-photo-confirm" disabled={remove.isPending} onClick={() => remove.mutate({ transformId })}>{remove.isPending ? <><LoaderCircle className="spin-icon" size={14} /> Menghapus…</> : "Ya, hapus foto"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
