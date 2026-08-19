import { useAuth } from "@/_core/hooks/useAuth";
import { useBrand } from "@/contexts/BrandContext";
import { trpc } from "@/lib/trpc";
import { finalizeBrandSave } from "@/lib/brandUpdateFlow";
import { GlobalBrandWatermarkPresets } from "@/components/GlobalBrandWatermarkPresets";
import { ArrowLeft, ImagePlus, LoaderCircle, Paintbrush, Save, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type BrandImage = { mimeType: "image/jpeg" | "image/png" | "image/webp"; sourceData: string; previewUrl: string };

function readBrandImage(file: File): Promise<BrandImage> {
  return new Promise((resolve, reject) => {
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) return reject(new Error("Gunakan gambar JPG, PNG, atau WEBP."));
    if (file.size > 3_500_000) return reject(new Error("Ukuran gambar brand maksimal 3 MB."));
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const sourceData = dataUrl.split(",")[1];
      if (!sourceData) return reject(new Error("Gambar tidak dapat dibaca."));
      resolve({ mimeType: file.type as BrandImage["mimeType"], sourceData, previewUrl: dataUrl });
    };
    reader.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
}

export default function BrandSettings() {
  const { user, loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const { brand, applySavedBrand } = useBrand();
  const utils = trpc.useUtils();
  const [logo, setLogo] = useState<BrandImage | null>(null);
  const [icon, setIcon] = useState<BrandImage | null>(null);
  const updateBrand = trpc.admin.updateBrand.useMutation({
    onSuccess: (nextBrand) => { void finalizeBrandSave({ brand: nextBrand, applyActiveBrand: applySavedBrand, invalidateBrand: () => utils.brand.get.invalidate(), resetDrafts: () => { setLogo(null); setIcon(null); } }); toast.success("Identitas brand telah diperbarui."); },
    onError: (error) => toast.error(error.message),
  });

  if (loading) return <main className="settings-loading proof-loading"><span className="aperture-mark" /><LoaderCircle className="spin-icon" size={24} /> Membuka pengaturan brand…</main>;
  if (!isAuthenticated || user?.role !== "admin") return <main className="admin-loading"><ShieldCheck size={28} /><strong>Akses administrator diperlukan.</strong><Link href="/profil" className="secondary-action">Kembali ke profil</Link></main>;

  const selectImage = async (event: React.ChangeEvent<HTMLInputElement>, kind: "logo" | "icon") => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const image = await readBrandImage(file);
      kind === "logo" ? setLogo(image) : setIcon(image);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gambar belum dapat dipakai.");
    }
  };

  return <main className="brand-settings-page">
    <header className="settings-header"><Link href="/admin"><ArrowLeft size={16} /> Kembali ke operasi</Link><div className="profile-wordmark"><span className="aperture-mark" /><strong>Lensa Saku</strong><small>IDENTITAS BRAND</small></div></header>
    <section className="brand-settings-hero"><div><span className="eyebrow">RUANG BRAND / ADMIN</span><h1>Identitas yang<br /><em>selalu konsisten.</em></h1><p>Ganti logo utama dan ikon ringkas tanpa menyentuh kode. Logo dipakai pada navigasi; ikon dipakai pada area kecil dan favicon.</p></div><div className="brand-settings-stamp"><Paintbrush size={18} /><span>BRAND</span><strong>DIKELOLA ADMIN</strong></div></section>
    <section className="brand-settings-grid">
      <article><div className="brand-settings-heading"><div><span className="eyebrow">LOGO UTAMA</span><h2>Identitas lengkap.</h2></div><ImagePlus size={19} /></div><div className="brand-preview brand-preview-logo"><img src={logo?.previewUrl ?? brand.logoUrl} alt="Pratinjau logo utama" /></div><label className="brand-file-input"><span>Unggah logo baru</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void selectImage(event, "logo")} /></label><p>JPG, PNG, atau WEBP, maksimal 3 MB. Gunakan komposisi lebar agar detail tetap terbaca.</p></article>
      <article><div className="brand-settings-heading"><div><span className="eyebrow">IKON RINGKAS</span><h2>Untuk layar kecil.</h2></div><Sparkles size={19} /></div><div className="brand-preview brand-preview-icon"><img src={icon?.previewUrl ?? brand.iconUrl} alt="Pratinjau ikon aplikasi" /></div><label className="brand-file-input"><span>Unggah ikon baru</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void selectImage(event, "icon")} /></label><p>Rasio 1:1 paling efektif untuk favicon, rail navigasi, dan layar seluler.</p></article>
    </section>
    <GlobalBrandWatermarkPresets />
    <footer className="brand-settings-footer"><p>Perubahan berlaku pada sesi baru dan seluruh halaman yang memakai identitas brand.</p><button disabled={updateBrand.isPending || (!logo && !icon)} onClick={() => updateBrand.mutate({ logo: logo ? { mimeType: logo.mimeType, sourceData: logo.sourceData } : undefined, icon: icon ? { mimeType: icon.mimeType, sourceData: icon.sourceData } : undefined })}>{updateBrand.isPending ? <><LoaderCircle className="spin-icon" size={16} /> Menyimpan…</> : <><Save size={16} /> Simpan identitas brand</>}</button></footer>
  </main>;
}
