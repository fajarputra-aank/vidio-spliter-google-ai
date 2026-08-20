import { BookmarkPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { CollaborationLayout } from "./CollaborationLayoutPreview";
import { ProviderCapacityIndicator } from "./ProviderCapacityIndicator";

function parseLayout(value: string): CollaborationLayout | null { try { const parsed = JSON.parse(value); if (["firstX", "firstY", "firstScale", "secondX", "secondY", "secondScale"].every((key) => typeof parsed[key] === "number")) return parsed as CollaborationLayout; } catch { /* Ignore malformed legacy preset. */ } return null; }

export function CollaborationLayoutPresetControls({ layout, onApply }: { layout: CollaborationLayout; onApply: (layout: CollaborationLayout) => void }) {
  const utils = trpc.useUtils(); const [name, setName] = useState(""); const presets = trpc.photo.collaborationLayoutPresets.useQuery(); const refresh = () => void utils.photo.collaborationLayoutPresets.invalidate();
  const create = trpc.photo.createCollaborationLayoutPreset.useMutation({ onSuccess: () => { setName(""); refresh(); toast.success("Preset tata letak disimpan secara privat."); }, onError: (error) => toast.error(error.message) }); const remove = trpc.photo.deleteCollaborationLayoutPreset.useMutation({ onSuccess: refresh, onError: (error) => toast.error(error.message) });
  return <><ProviderCapacityIndicator /><section className="layout-presets"><div><span className="eyebrow">PRESET TATA LETAK</span><p>Simpan proporsi dan posisi saat ini untuk proyek berikutnya. Preset ini hanya terlihat olehmu.</p></div><div className="layout-preset-save"><input value={name} maxLength={48} onChange={(event) => setName(event.target.value)} placeholder="Nama preset, misalnya Produk seimbang" /><button type="button" disabled={!name.trim() || create.isPending} onClick={() => create.mutate({ name, layout })}><BookmarkPlus size={14} /> Simpan</button></div><div className="layout-preset-list">{presets.isLoading ? <small>Memuat preset…</small> : presets.data?.length ? presets.data.map((preset) => { const saved = parseLayout(preset.layout); return <div key={preset.id}><button type="button" disabled={!saved} onClick={() => saved && onApply(saved)}>{preset.name}</button><button type="button" aria-label={`Hapus preset ${preset.name}`} onClick={() => remove.mutate({ presetId: preset.id })}><Trash2 size={13} /></button></div>; }) : <small>Belum ada preset tersimpan.</small>}</div></section></>;
}
