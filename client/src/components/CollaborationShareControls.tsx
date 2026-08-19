import { Copy, ImageUp, Link2, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function CollaborationShareControls({ transformId }: { transformId: number }) {
  const utils = trpc.useUtils();
  const [useWatermark, setUseWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState("Lensa Saku · Kolaborasi");
  const [logoId, setLogoId] = useState<number | undefined>();
  const links = trpc.photo.collaborationShareLinks.useQuery({ transformId });
  const limit = trpc.photo.collaborationShareLimit.useQuery();
  const logos = trpc.photo.collaborationBrandLogos.useQuery();
  const activeLinks = useMemo(() => (links.data ?? []).filter((link) => !link.revokedAt && new Date(link.expiresAt) > new Date()), [links.data]);
  const refresh = () => {
    void utils.photo.collaborationShareLinks.invalidate({ transformId });
    void utils.photo.collaborationShareLimit.invalidate();
    void utils.photo.collaborationBrandLogos.invalidate();
  };
  const create = trpc.photo.createCollaborationShareLink.useMutation({
    onSuccess: async (link) => {
      const url = `${window.location.origin}/bagikan/${link.token}`;
      try { await navigator.clipboard.writeText(url); toast.success("Tautan sementara dibuat dan disalin."); }
      catch { toast.success("Tautan sementara dibuat. Salin dari daftar di bawah."); }
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const revoke = trpc.photo.revokeCollaborationShareLink.useMutation({ onSuccess: () => { refresh(); toast.success("Tautan berbagi dicabut."); }, onError: (error) => toast.error(error.message) });
  const revokeAll = trpc.photo.revokeAllCollaborationShareLinks.useMutation({ onSuccess: (result) => { refresh(); toast.success(`${result.revokedCount} tautan aktif dicabut.`); }, onError: (error) => toast.error(error.message) });
  const upload = trpc.photo.uploadCollaborationBrandLogo.useMutation({ onSuccess: (logo) => { setLogoId(logo.id); refresh(); toast.success("Logo watermark disimpan privat."); }, onError: (error) => toast.error(error.message) });
  const handleLogo = (file?: File) => {
    if (!file) return;
    if (!/[.]?(png|jpe?g|webp)$/i.test(file.name) || file.size > 2_500_000) { toast.error("Pilih logo PNG, JPG, atau WEBP maksimal 2,5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const sourceData = String(reader.result).split(",")[1];
      if (sourceData) upload.mutate({ name: file.name.replace(/[.][^.]+$/, "").slice(0, 48), mimeType: file.type as "image/png" | "image/jpeg" | "image/webp", sourceData });
    };
    reader.readAsDataURL(file);
  };
  const maxActiveLinks = limit.data?.maxActiveLinks;
  const atLimit = maxActiveLinks !== null && maxActiveLinks !== undefined && activeLinks.length >= maxActiveLinks;
  const limitNote = maxActiveLinks === null ? "Tanpa batas tautan aktif untuk peran akunmu. Watermark tetap diterapkan pada salinan saja." : maxActiveLinks === undefined ? "Memuat batas tautan aktif…" : `${activeLinks.length}/${maxActiveLinks} tautan aktif untuk hasil ini. Watermark diterapkan pada salinan; hasil privat asli tidak berubah.`;

  return <div className="collaboration-share-controls">
    <span><Link2 size={13} /> Tautan sementara</span>
    <label className="share-watermark-toggle"><input type="checkbox" checked={useWatermark} onChange={(event) => setUseWatermark(event.target.checked)} /><ShieldCheck size={12} /> Watermark otomatis</label>
    {useWatermark && <><input className="share-watermark-text" value={watermarkText} maxLength={72} onChange={(event) => setWatermarkText(event.target.value)} aria-label="Teks watermark otomatis" /><label className="share-logo-picker">Logo brand<select value={logoId ?? ""} onChange={(event) => setLogoId(event.target.value ? Number(event.target.value) : undefined)}><option value="">Tanpa logo</option>{logos.data?.map((logo) => <option value={logo.id} key={logo.id}>{logo.name}</option>)}</select><span><ImageUp size={12} /> Unggah<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleLogo(event.target.files?.[0])} /></span></label></>}
    <div className="share-create-buttons">{([1, 24, 72] as const).map((hours) => <button type="button" key={hours} disabled={create.isPending || atLimit || (useWatermark && !watermarkText.trim())} onClick={() => create.mutate({ transformId, expiresInHours: hours, watermarkText: useWatermark ? watermarkText.trim() : undefined, watermarkLogoId: useWatermark ? logoId : undefined })}>{create.isPending ? <LoaderCircle className="spin-icon" size={12} /> : null}{hours === 1 ? "1 jam" : `${hours / 24} hari`}</button>)}</div>
    <small>{limitNote}</small>
    {activeLinks.length > 1 && <button className="share-revoke-all" type="button" disabled={revokeAll.isPending} onClick={() => { if (window.confirm(`Cabut seluruh ${activeLinks.length} tautan aktif untuk hasil ini? Tindakan tidak dapat dibatalkan.`)) revokeAll.mutate({ transformId }); }}><Trash2 size={12} /> Cabut semua tautan aktif</button>}
    {links.data?.length ? <div className="share-link-list">{links.data.map((link) => <p key={link.id}><span>{link.revokedAt ? "DICABUT" : new Date(link.expiresAt) > new Date() ? `${link.watermarkText || link.watermarkLogoId ? "WATERMARK · " : ""}Aktif hingga ${new Date(link.expiresAt).toLocaleString("id-ID")} · ${link.accessCount} akses` : `KEDALUWARSA · ${link.accessCount} akses`}</span>{!link.revokedAt && new Date(link.expiresAt) > new Date() && <><button type="button" onClick={() => toast.message(`Tautan #${link.id} tidak dapat disalin ulang demi keamanan. Buat tautan baru bila diperlukan.`)} aria-label="Informasi tautan"><Copy size={12} /></button><button type="button" onClick={() => revoke.mutate({ shareLinkId: link.id })} aria-label="Cabut tautan"><Trash2 size={12} /></button></>}</p>)}</div> : null}
  </div>;
}
