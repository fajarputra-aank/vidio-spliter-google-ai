/**
 * Design reminder — Kamar Gelap Editorial: photo-first workspace with tactile
 * contact-sheet details, an honest process console, and a private proof gallery.
 */
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { shareImageUrl } from "@/lib/share";
import { readRemixPreset } from "@/lib/remix";
import { selectAlternativeRecipe } from "@/lib/studioExperiment";
import { privateMediaUrl, publicMediaUrl } from "@/lib/mediaUrl";
import { useBrand } from "@/contexts/BrandContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import {
  Aperture, ArrowRight, BookmarkPlus, Camera, Check, ChevronRight, Clock3, Download,
  Globe2, History, ImagePlus, Layers3, LoaderCircle, LogIn, Menu, Package,
  Palette, Ratio, RotateCcw, ScanFace, Share2, Sparkles, Trash2, Utensils, WandSparkles, X,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const assets = {
  hero: publicMediaUrl("/manus-storage/lensa-saku-hero-studio_9f9ec738.jpg"),
  headshot: publicMediaUrl("/manus-storage/lensa-saku-headshot_83cca6e1.jpg"),
  product: publicMediaUrl("/manus-storage/lensa-saku-product_617755a2.jpg"),
  food: publicMediaUrl("/manus-storage/lensa-saku-food_26a6ef7f.jpg"),
};

type Recipe = { id: "headshot" | "beauty" | "background" | "product" | "food" | "social" | "fashion" | "interior" | "light" | "restore" | "detail" | "travel" | "night" | "sketch"; name: string; category: string; label: string; description: string; image: string; prompt: string };
type UploadPayload = { base64: string; mimeType: "image/jpeg" | "image/png" | "image/webp"; fileName: string };
type OutputAspect = "1:1" | "16:9" | "9:16";
type AiStyle = "editorial" | "realistic" | "anime" | "cinematic" | "vintage" | "pastel" | "minimal" | "monochrome" | "neon" | "watercolor";
type PhotoRecommendation = { recipe: Recipe["id"]; confidence: "high" | "medium" | "low"; reason: string };

const recipes: Recipe[] = [
  { id: "headshot", name: "Headshot rapi", category: "Potret", label: "Paling dipilih", description: "Cahaya studio bersih untuk profil kerja dan CV.", image: assets.headshot, prompt: "cahaya studio lembut" },
  { id: "beauty", name: "Retouch natural", category: "Potret", label: "Halus", description: "Rapikan cahaya dan detail kulit tanpa mengubah dirimu.", image: assets.headshot, prompt: "retouch jujur" },
  { id: "background", name: "Latar studio bersih", category: "Produk", label: "Praktis", description: "Ganti gangguan di belakang dengan latar studio yang rapi.", image: assets.product, prompt: "latar studio netral" },
  { id: "product", name: "Produk katalog", category: "Produk", label: "Untuk jualan", description: "Rapi, terang, dan berfokus pada detail produk.", image: assets.product, prompt: "latar katalog hangat" },
  { id: "food", name: "Menu menggoda", category: "Makanan", label: "Baru", description: "Warna makanan diperkuat tanpa mengubah rasa alami.", image: assets.food, prompt: "nuansa menu editorial" },
  { id: "social", name: "Konten sosial", category: "Sosial", label: "Cepat pakai", description: "Kontras ringan untuk feed yang terasa lebih hidup.", image: assets.headshot, prompt: "warna editorial hangat" },
  { id: "fashion", name: "Kampanye fashion", category: "Fashion", label: "Editorial", description: "Rasa kampanye yang menonjolkan detail pakaian.", image: assets.headshot, prompt: "arah fashion campaign" },
  { id: "interior", name: "Ruang & properti", category: "Ruang", label: "Lebih terang", description: "Perspektif dan tekstur ruang terasa lebih rapi.", image: assets.product, prompt: "arsitektur editorial" },
  { id: "light", name: "Cahaya seimbang", category: "Ruang", label: "Perbaikan", description: "Seimbangkan eksposur, bayangan, dan warna tanpa mengubah isi foto.", image: assets.product, prompt: "cahaya natural seimbang" },
  { id: "restore", name: "Pulihkan foto", category: "Restorasi", label: "Perbaikan", description: "Bersihkan kabut dan gores tanpa mengubah cerita.", image: assets.food, prompt: "restorasi natural" },
  { id: "detail", name: "Detail lebih tajam", category: "Restorasi", label: "Jernih", description: "Kurangi noise dan lembutnya foto dengan detail yang tetap masuk akal.", image: assets.food, prompt: "detail natural" },
  { id: "travel", name: "Perjalanan berkesan", category: "Kreatif", label: "Destinasi", description: "Perjelas atmosfer perjalanan tanpa mengubah lokasi atau momenmu.", image: assets.product, prompt: "travel editorial" },
  { id: "night", name: "Malam sinematik", category: "Kreatif", label: "Atmosfer", description: "Kontras malam dengan cahaya praktis yang realistis.", image: assets.product, prompt: "grade malam sinematik" },
  { id: "sketch", name: "Sketsa editorial", category: "Kreatif", label: "Ilustrasi", description: "Ubah momen menjadi sketsa orisinal yang tetap setia pada subjek.", image: assets.headshot, prompt: "sketsa kontemporer" },
];

const categories = [{ name: "Semua", icon: Layers3 }, { name: "Potret", icon: ScanFace }, { name: "Produk", icon: Package }, { name: "Makanan", icon: Utensils }, { name: "Sosial", icon: Sparkles }, { name: "Fashion", icon: Palette }, { name: "Ruang", icon: Camera }, { name: "Restorasi", icon: WandSparkles }, { name: "Kreatif", icon: Aperture }];
const progressStages = ["Mengunci foto sumber", "Menyiapkan arah visual", "Merender transformasi AI", "Menyimpan hasil ke galeri"];
const aspectOptions: Array<{ value: OutputAspect; title: string; note: string }> = [
  { value: "1:1", title: "1:1", note: "kotak" },
  { value: "16:9", title: "16:9", note: "landscape" },
  { value: "9:16", title: "9:16", note: "story" },
];
const styleOptions: Array<{ value: AiStyle; title: string; note: string }> = [
  { value: "editorial", title: "Editorial", note: "hangat & terarah" },
  { value: "realistic", title: "Realistis", note: "tekstur setia" },
  { value: "anime", title: "Anime", note: "ilustrasi orisinal" },
  { value: "cinematic", title: "Sinematik", note: "kontras filmis" },
  { value: "vintage", title: "Vintage", note: "cetak analog" },
  { value: "pastel", title: "Pastel", note: "lembut & lapang" },
  { value: "minimal", title: "Minimal", note: "ruang negatif" },
  { value: "monochrome", title: "Monokrom", note: "kontras hitam-putih" },
  { value: "neon", title: "Neon", note: "cahaya malam modern" },
  { value: "watercolor", title: "Cat air", note: "ilustrasi transparan" },
];

function downloadImage(url: string, recipe: string) {
  const link = document.createElement("a");
  link.href = privateMediaUrl(url);
  link.download = `lensa-saku-${recipe}.png`;
  link.click();
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function shareImage(url: string, title: string) {
  try {
    const outcome = await shareImageUrl(url, title, window.location.origin, navigator);
    toast.success(outcome === "native" ? "Pilihan berbagi sudah dibuka." : "Tautan hasil sudah disalin.");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    toast.error("Tautan belum dapat dibagikan. Coba unduh hasilnya.");
  }
}

export default function Home() {
  const { brand } = useBrand();
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const historyQuery = trpc.photo.list.useQuery(undefined, { enabled: isAuthenticated });
  const quotaQuery = trpc.photo.quota.useQuery(undefined, { enabled: isAuthenticated });
  const creditBalanceQuery = trpc.billing.balance.useQuery(undefined, { enabled: isAuthenticated });
  const promptFavoritesQuery = trpc.promptFavorites.list.useQuery(undefined, { enabled: isAuthenticated });
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe>(recipes[0]);
  const [selectedAspect, setSelectedAspect] = useState<OutputAspect>("1:1");
  const [selectedStyle, setSelectedStyle] = useState<AiStyle>("editorial");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadPayload, setUploadPayload] = useState<UploadPayload | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [remixNote, setRemixNote] = useState<string | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [recommendations, setRecommendations] = useState<PhotoRecommendation[]>([]);
  const [recommendationStatus, setRecommendationStatus] = useState<"idle" | "login" | "error">("idle");
  const [isRestoringHistorySource, setIsRestoringHistorySource] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasUnlimitedStudioAccess = user?.role === "admin" || quotaQuery.data?.isUnlimited === true;

  const shownRecipes = selectedCategory === "Semua" ? recipes : recipes.filter((recipe) => recipe.category === selectedCategory);
  const previewImage = resultImage ?? uploadedImage ?? selectedRecipe.image;
  const progressStage = progress < 25 ? 0 : progress < 48 ? 1 : progress < 78 ? 2 : 3;

  useEffect(() => {
    if (!isProcessing) return;
    const timer = window.setInterval(() => setProgress((current) => Math.min(91, current + (current < 55 ? 6 : 2))), 700);
    return () => window.clearInterval(timer);
  }, [isProcessing]);

  useEffect(() => {
    const preset = readRemixPreset(window.location.search);
    if (!preset) return;
    const recipe = recipes.find((item) => item.id === preset.recipe);
    const style = styleOptions.find((item) => item.value === preset.style);
    const aspect = aspectOptions.find((item) => item.value === preset.aspect);
    if (recipe) setSelectedRecipe(recipe);
    setSelectedStyle(preset.style);
    setSelectedAspect(preset.aspect);
    setSelectedCategory("Semua");
    setRemixNote(`Preset remix aktif: ${recipe?.name ?? "resep"} · ${style?.title ?? "gaya"} · ${aspect?.title ?? "rasio"}. Unggah fotomu sendiri untuk lanjut.`);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const transformMutation = trpc.photo.transform.useMutation({
    onSuccess: (record) => {
      setProgress(100);
      if (!record.resultUrl) {
        setIsProcessing(false);
        toast.error("Layanan AI tidak mengembalikan gambar hasil. Coba lagi.");
        return;
      }
      setResultImage(privateMediaUrl(record.resultUrl));
      setIsProcessing(false);
      void utils.photo.list.invalidate();
      void utils.photo.quota.invalidate();
      void utils.billing.balance.invalidate();
      void utils.photo.profile.invalidate();
      toast.success("Hasil AI sudah masuk ke galeri pribadimu.");
    },
    onError: (error) => {
      setIsProcessing(false);
      setProgress(0);
      toast.error(error.message);
    },
  });

  const recommendationMutation = trpc.photo.recommend.useMutation({
    onSuccess: (value) => { setRecommendations(value as PhotoRecommendation[]); setRecommendationStatus("idle"); },
    onError: () => { setRecommendations([]); setRecommendationStatus("error"); },
  });

  const createPromptFavoriteMutation = trpc.promptFavorites.create.useMutation({
    onSuccess: () => { void utils.promptFavorites.list.invalidate(); toast.success("Arahan disimpan ke favorit privat."); },
    onError: (error) => toast.error(error.message),
  });
  const deletePromptFavoriteMutation = trpc.promptFavorites.delete.useMutation({
    onSuccess: () => { void utils.promptFavorites.list.invalidate(); toast.success("Arahan dihapus dari favorit."); },
    onError: (error) => toast.error(error.message),
  });

  function readImage(file: File) {
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) {
      toast.error("Pilih berkas JPG, PNG, atau WEBP.");
      return;
    }
    if (file.size > 5_500_000) {
      toast.error("Ukuran foto maksimal 5 MB agar proses AI tetap lancar.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const base64 = dataUrl.split(",")[1];
      if (!base64) return toast.error("Foto tidak dapat dibaca.");
      setUploadedImage(dataUrl);
      setUploadPayload({ base64, mimeType: file.type as UploadPayload["mimeType"], fileName: file.name });
      setResultImage(null);
      setProgress(0);
      setRecommendations([]);
      if (isAuthenticated) {
        setRecommendationStatus("idle");
        recommendationMutation.mutate({ sourceData: base64, mimeType: file.type as UploadPayload["mimeType"] });
      } else {
        setRecommendationStatus("login");
      }
      toast.success("Foto siap diproses di studio.");
    };
    reader.readAsDataURL(file);
  }

  function applyRecipe() {
    if (!isAuthenticated) {
      toast.message("Masuk dulu untuk menyimpan foto dan hasil AI ke galeri.");
      startLogin();
      return;
    }
    if (!uploadPayload) {
      toast.error("Unggah foto asli terlebih dahulu untuk menjalankan transformasi AI.");
      inputRef.current?.click();
      return;
    }
    if (!hasUnlimitedStudioAccess && quotaQuery.data?.exhausted && (creditBalanceQuery.data?.credits ?? 0) < 1) {
      toast.error("Kuota harian dan kredit tambahanmu sudah habis. Tambahkan kredit untuk lanjut meracik.");
      return;
    }
    setProgress(8);
    setResultImage(null);
    setIsProcessing(true);
    transformMutation.mutate({ recipe: selectedRecipe.id, aspectRatio: selectedAspect, style: selectedStyle, fileName: uploadPayload.fileName, mimeType: uploadPayload.mimeType, sourceData: uploadPayload.base64, customInstruction: customInstruction.trim() || undefined });
  }

  function chooseRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe);
    setResultImage(null);
    setProgress(0);
  }

  function chooseAspect(aspect: OutputAspect) {
    setSelectedAspect(aspect);
    setResultImage(null);
    setProgress(0);
  }

  function chooseStyle(style: AiStyle) {
    setSelectedStyle(style);
    setResultImage(null);
    setProgress(0);
  }

  function saveInstructionFavorite() {
    const instruction = customInstruction.trim();
    if (!isAuthenticated) return startLogin();
    if (instruction.length < 3) return toast.error("Tulis arahan minimal 3 karakter sebelum menyimpannya.");
    createPromptFavoriteMutation.mutate({ instruction });
  }

  function tryAnotherRecipe() {
    const alternative = selectAlternativeRecipe(selectedRecipe.id, recommendations.map((item) => item.recipe), recipes.map((item) => item.id));
    const recipe = recipes.find((item) => item.id === alternative);
    if (!recipe) return;
    chooseRecipe(recipe);
    setSelectedCategory(recipe.category);
    scrollTo("studio");
    toast.message(`Foto sumber tetap dipakai. Coba ${recipe.name} saat siap.`);
  }

  async function restoreHistoryToStudio(item: { id: number; sourceUrl: string; resultUrl: string | null; recipe: string; aspectRatio: string; style: string }) {
    const recipe = recipes.find((candidate) => candidate.id === item.recipe);
    const sourceMediaUrl = privateMediaUrl(item.sourceUrl);
    setUploadedImage(sourceMediaUrl);
    setResultImage(privateMediaUrl(item.resultUrl ?? item.sourceUrl));
    setSelectedAspect(item.aspectRatio as OutputAspect);
    setSelectedStyle(item.style as AiStyle);
    if (recipe) { setSelectedRecipe(recipe); setSelectedCategory(recipe.category); }
    setUploadPayload(null);
    setIsRestoringHistorySource(true);
    scrollTo("studio");
    try {
      const response = await fetch(sourceMediaUrl);
      if (!response.ok) throw new Error("source unavailable");
      const blob = await response.blob();
      const mimeType = (["image/jpeg", "image/png", "image/webp"] as string[]).includes(blob.type) ? blob.type as UploadPayload["mimeType"] : "image/jpeg";
      const sourceData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const value = String(reader.result).split(",")[1];
          value ? resolve(value) : reject(new Error("source decode failed"));
        };
        reader.onerror = () => reject(reader.error ?? new Error("source read failed"));
        reader.readAsDataURL(blob);
      });
      setUploadPayload({ base64: sourceData, mimeType, fileName: `riwayat-${item.id}.${mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"}` });
      toast.success("Sumber privat dimuat kembali. Kamu dapat mencoba resep lain tanpa unggah ulang.");
    } catch {
      toast.error("Sumber riwayat belum dapat dimuat ulang. Pilih berkas asli untuk membuat transformasi baru.");
    } finally {
      setIsRestoringHistorySource(false);
    }
  }

  function scrollTo(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }

  return (
    <main className="studio-shell">
      <aside className="rail" aria-label="Navigasi utama">
        <button className="brand-badge" aria-label="Lensa Saku beranda"><img src={publicMediaUrl(brand.iconUrl)} alt="Ikon Lensa Saku" /></button>
        <nav className="rail-nav">
          <button className="rail-nav-button is-active" aria-label="Studio" onClick={() => scrollTo("studio")}><Aperture size={19} strokeWidth={1.7} /><span>Studio</span></button>
          <button className="rail-nav-button" aria-label="Koleksi" onClick={() => scrollTo("gallery")}><History size={19} strokeWidth={1.7} /><span>Koleksi</span></button>
          <Link href="/profil" className="rail-nav-button" aria-label="Profil"><Palette size={19} strokeWidth={1.7} /><span>Profil</span></Link>
          <Link href="/komunitas" className="rail-nav-button" aria-label="Komunitas"><Globe2 size={19} strokeWidth={1.7} /><span>Ruang</span></Link>
          <button className="rail-nav-button" aria-label="Bantuan" onClick={() => toast.message("Mulai dengan unggah foto, pilih resep, lalu lihat hasilmu di koleksi.")}><Camera size={19} strokeWidth={1.7} /><span>Bantuan</span></button>
        </nav>
        <button className="rail-avatar" aria-label={isAuthenticated ? "Keluar dari akun" : "Masuk"} onClick={() => isAuthenticated ? logout() : startLogin()}>{isAuthenticated ? (user?.name?.slice(0, 1).toUpperCase() ?? "A") : <LogIn size={15} />}</button>
      </aside>

      <section className="page-content">
        <header className="topbar">
          <div className="desktop-brand" aria-label="Lensa Saku Studio AI"><span className="desktop-brand-mark"><img src={publicMediaUrl(brand.iconUrl)} alt="Ikon Lensa Saku" /></span><span><strong>Lensa Saku</strong><small>STUDIO AI</small></span><img className="desktop-brand-lockup" src={publicMediaUrl(brand.logoUrl)} alt="Logo utama Lensa Saku" /></div>
          <div className="mobile-brand"><span className="mobile-brand-mark"><img src={publicMediaUrl(brand.iconUrl)} alt="Logo Lensa Saku" /></span><div><strong>Lensa Saku</strong><span>Studio AI</span></div></div>
          <div className="eyebrow topbar-note"><span className="pulse-dot" /> {isAuthenticated ? "arsip visual pribadi aktif" : "masuk untuk menyimpan hasil"}</div>
          <div className="topbar-actions">
            {!authLoading && (isAuthenticated ? <Link href="/profil" className="text-button auth-action"><Palette size={14} /> Profilku</Link> : <button className="text-button auth-action" onClick={startLogin}><LogIn size={14} /> Masuk untuk simpan</button>)}
            <Link href="/kredit" className="text-button">Tambah kredit <ChevronRight size={15} /></Link>
            <button className="mobile-menu" aria-label="Buka menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
          </div>
        </header>

        {menuOpen && <div className="mobile-panel" role="dialog" aria-label="Menu aplikasi"><button onClick={() => scrollTo("studio")}>Studio kerja</button><button onClick={() => scrollTo("gallery")}>Koleksiku</button><Link href="/profil">Profil</Link><Link href="/komunitas">Ruang komunitas</Link><Link href="/kredit">Tambah kredit</Link><button onClick={() => toast.message("Pilih foto, pilih resep, lalu proses hasilnya.")}>Bantuan</button></div>}

        <section className="masthead">
          <div className="masthead-copy"><div className="eyebrow">01 — meja kerja visual</div><img className="studio-brand-lockup" src={publicMediaUrl(brand.logoUrl)} alt="Logo utama Lensa Saku" /><h1>Satu foto masuk.<br /><em>Materi siap pakai</em> keluar.</h1><p>Ubah foto produk, potret, dan menu menjadi visual yang lebih rapi. Hasil transformasi asli disimpan ke galeri pribadi agar selalu mudah diunduh kembali.</p><div className="masthead-ctas"><button className="primary-action" onClick={() => scrollTo("studio")}>Mulai dari foto <ArrowRight size={17} /></button><div className="compact-proof"><span>AI</span><small>proses aman<br />hasil tersimpan</small></div></div></div>
          <div className="hero-visual"><div className="hero-image-frame"><img src={assets.hero} alt="Meja kerja studio kreatif dengan kamera dan contact sheet" /><span className="frame-number">N-024 / 36</span><span className="hero-stamp">TERHUBUNG KE AI</span></div><div className="hero-note"><Aperture size={16} /><span>foto biasa, arah yang lebih jelas</span></div></div>
        </section>

        <section className="process-strip" aria-label="Alur kerja"><div><span>01</span><strong>Masukkan foto</strong><p>JPG, PNG, atau WEBP.</p></div><div><span>02</span><strong>Pilih resep</strong><p>Sesuaikan dengan tujuan.</p></div><div><span>03</span><strong>AI meracik hasil</strong><p>Progress tampil langsung.</p></div><aside><Clock3 size={18} /><span>Hasil tersimpan untuk diunduh kapan pun.</span></aside></section>

        <section className="workbench-section" id="studio">
          <div className="section-heading"><div><span className="eyebrow">02 — studio aktif</span><h2>Racik frame-mu.</h2></div><p>Untuk memproses foto AI, masuk dan unggah foto asli. Lensa Saku menyimpan sumber serta hasilmu ke galeri privat.</p></div>{remixNote && <div className="remix-slip"><WandSparkles size={16} /><span>{remixNote}</span><button onClick={() => setRemixNote(null)}><X size={14} /></button></div>}
          <div className="workbench">
            <section className="upload-column">
              <div className="column-label"><span>FOTO SUMBER</span><span>{uploadPayload?.fileName || "belum ada"}</span></div>
              <div className={`upload-zone ${isDragging ? "is-dragging" : ""} ${uploadedImage ? "has-upload" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); const file = event.dataTransfer.files?.[0]; if (file) readImage(file); }}>
                {uploadedImage ? <><img src={uploadedImage} alt="Foto yang diunggah pengguna" /><button className="upload-overlay" onClick={() => inputRef.current?.click()}><ImagePlus size={18} /><span>Ganti foto</span></button><button className="clear-upload" aria-label="Hapus foto" onClick={() => { setUploadedImage(null); setUploadPayload(null); setResultImage(null); setProgress(0); }}><X size={16} /></button></> : <div className="upload-empty"><span className="upload-icon"><ImagePlus size={24} /></span><strong>Tarik foto ke sini</strong><p>atau pilih dari perangkatmu</p><button className="secondary-action" onClick={() => inputRef.current?.click()}>Pilih berkas</button><small>Maks. 5 MB · JPG, PNG, WEBP</small></div>}
                <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) readImage(file); }} hidden />
              </div>
              <p className="local-note"><span /> Foto sumber disimpan privat saat kamu menjalankan transformasi AI.</p>
              {isAuthenticated && <div className={`quota-slip ${quotaQuery.data?.exhausted && !hasUnlimitedStudioAccess ? "is-exhausted" : ""}`}><div><span>{hasUnlimitedStudioAccess ? "AKSES STUDIO" : "KUOTA HARI INI"}</span><strong>{hasUnlimitedStudioAccess ? "∞" : quotaQuery.isLoading ? "…" : `${quotaQuery.data?.remaining ?? 0} / ${quotaQuery.data?.dailyLimit ?? 5}`}</strong></div><p>{hasUnlimitedStudioAccess ? "Transformasi tanpa batas aktif untuk akun ini." : quotaQuery.data?.exhausted ? `Kuota habis. ${creditBalanceQuery.data?.credits ?? 0} kredit cadangan siap dipakai.` : "Transformasi tersisa untuk hari ini."}</p>{!hasUnlimitedStudioAccess && <Link href="/kredit">{creditBalanceQuery.data?.credits ?? 0} kredit →</Link>}</div>}
            </section>

            <section className="recipe-column">
              <div className="column-label"><span>PILIH RESEP</span><span>{shownRecipes.length} tersedia</span></div>
              <div className="category-tabs" aria-label="Kategori resep">{categories.map((category) => { const Icon = category.icon; return <button key={category.name} className={selectedCategory === category.name ? "is-selected" : ""} onClick={() => setSelectedCategory(category.name)}><Icon size={15} />{category.name}</button>; })}</div>
              {recommendationMutation.isPending && <div className="recipe-recommendation is-loading"><Sparkles size={15} /><span>Menganalisis jenis foto untuk mencari resep yang cocok…</span></div>}
              {recommendationStatus === "login" && <button className="recipe-recommendation is-login" onClick={startLogin}><LogIn size={15} /><span><small>REKOMENDASI AI</small><strong>Masuk untuk analisis otomatis</strong><em>Analisis jenis foto berjalan privat setelah kamu masuk ke studio.</em></span><ArrowRight size={15} /></button>}
              {recommendationStatus === "error" && <div className="recipe-recommendation is-loading"><X size={15} /><span>Analisis foto belum tersedia. Kamu tetap dapat memilih resep secara manual.</span></div>}
              {recommendations.length > 0 && !recommendationMutation.isPending && <div className="recipe-recommendation-list" aria-label="Tiga rekomendasi resep AI">{recommendations.map((recommendation, index) => <button className="recipe-recommendation" key={recommendation.recipe} onClick={() => { const recipe = recipes.find((item) => item.id === recommendation.recipe); if (recipe) { chooseRecipe(recipe); setSelectedCategory(recipe.category); toast.message(`${recipe.name} dipilih. Foto sumber tetap sama.`); } }}><Sparkles size={15} /><span><small>REKOMENDASI AI {String(index + 1).padStart(2, "0")} · {recommendation.confidence === "high" ? "TINGGI" : recommendation.confidence === "medium" ? "SEDANG" : "EKSPLORASI"}</small><strong>Coba {recipes.find((item) => item.id === recommendation.recipe)?.name ?? "Konten sosial"}</strong><em>{recommendation.reason}</em></span><ArrowRight size={15} /></button>)}</div>}
              <div className="recipe-list">{shownRecipes.map((recipe, index) => <button key={recipe.id} className={`recipe-card ${selectedRecipe.id === recipe.id ? "is-selected" : ""}`} onClick={() => chooseRecipe(recipe)}><span className="recipe-image"><img src={recipe.image} alt="" /><i>R-{String(index + 1).padStart(2, "0")}</i></span><div><span className="recipe-label">{recipe.label}</span><strong>{recipe.name}</strong><p>{recipe.description}</p></div><span className="recipe-check">{selectedRecipe.id === recipe.id && <Check size={15} />}</span></button>)}</div>
              <div className="style-picker"><div><span className="eyebrow"><Palette size={13} /> GAYA AI</span><p>Pilih bahasa visual untuk hasilmu.</p></div><div className="style-options">{styleOptions.map((style) => <button key={style.value} className={selectedStyle === style.value ? "is-selected" : ""} onClick={() => chooseStyle(style.value)}><strong>{style.title}</strong><small>{style.note}</small></button>)}</div></div>
              <div className="aspect-picker"><div><span className="eyebrow"><Ratio size={13} /> RASIO KELUARAN</span><p>AI menata komposisi sesuai frame pilihanmu.</p></div><Select value={selectedAspect} onValueChange={(value) => chooseAspect(value as OutputAspect)}><SelectTrigger size="sm" className="aspect-select"><SelectValue /></SelectTrigger><SelectContent>{aspectOptions.map((aspect) => <SelectItem key={aspect.value} value={aspect.value}>{aspect.title} · {aspect.note}</SelectItem>)}</SelectContent></Select></div>
              <div className="selected-recipe-note"><WandSparkles size={16} /><span>Resep dipilih: <strong>{selectedRecipe.name}</strong> · {selectedRecipe.prompt}</span></div>
              <div className="instruction-field"><label htmlFor="custom-instruction"><span>ARAH TAMBAHAN OPSIONAL</span><small>{customInstruction.length}/360</small></label><Textarea id="custom-instruction" value={customInstruction} onChange={(event) => setCustomInstruction(event.target.value.slice(0, 360))} placeholder="Contoh: pertahankan suasana hangat, buat latar lebih tenang." /><p>Instruksi dipakai hanya bila tidak bertentangan dengan perlindungan subjek, label, dan komposisi foto sumber.</p><div className="instruction-favorites"><div className="favorite-heading"><span>FAVORIT PRIBADI</span><button type="button" onClick={saveInstructionFavorite} disabled={createPromptFavoriteMutation.isPending || customInstruction.trim().length < 3}><BookmarkPlus size={14} /> Simpan arahan</button></div>{!isAuthenticated ? <button type="button" className="favorite-login" onClick={startLogin}>Masuk untuk menyimpan arahan favorit privat.</button> : promptFavoritesQuery.isLoading ? <small>Memuat arahan favorit…</small> : promptFavoritesQuery.isError ? <div className="favorite-error"><small>Favorit privat belum dapat dimuat.</small><button type="button" onClick={() => void promptFavoritesQuery.refetch()}>Muat ulang</button></div> : promptFavoritesQuery.data?.length ? <div className="favorite-list">{promptFavoritesQuery.data.map((favorite) => <div className="favorite-chip" key={favorite.id}><button type="button" onClick={() => { setCustomInstruction(favorite.instruction); toast.message("Arahan favorit dipakai kembali."); }}>{favorite.instruction}</button><button type="button" aria-label="Hapus arahan favorit" onClick={() => deletePromptFavoriteMutation.mutate({ favoriteId: favorite.id })} disabled={deletePromptFavoriteMutation.isPending}><Trash2 size={13} /></button></div>)}</div> : <small>Belum ada arahan favorit. Simpan arah yang ingin dipakai lagi di sini.</small>}</div></div>
            </section>

            <section className="result-column">
              <div className="column-label"><span>PRATINJAU</span><span>{resultImage ? "siap" : isProcessing ? "meracik" : "menunggu"}</span></div>
              {resultImage && uploadedImage ? <><BeforeAfterSlider before={uploadedImage} after={resultImage} aspectRatio={selectedAspect} /><p className="comparison-help">Geser garis pembanding, gunakan kontrol sentuh/keyboard, atau tekan <strong>TENGAH</strong> untuk kembali ke posisi 50:50.</p></> : <div className={`result-frame ratio-preview ${isProcessing ? "is-processing" : ""}`} style={{ aspectRatio: selectedAspect }}><img src={previewImage} alt="Pratinjau hasil resep terpilih" /><span className="frame-number">LS / {new Date().getFullYear()}</span><span className="ratio-stamp">{selectedAspect}</span>{isProcessing && <div className="processing-layer progress-layer"><div className="process-orbit"><Sparkles size={20} /></div><strong>{progressStages[progressStage]}</strong><span>AI sedang memproses frame-mu</span><div className="progress-track" aria-label={`Progres proses ${progress}%`}><i style={{ width: `${progress}%` }} /></div><small>{progress}% · perkiraan selama AI menyelesaikan frame</small></div>}</div>}
              <div className="result-copy"><span className="eyebrow">{resultImage ? "HASIL AI TERSIMPAN" : isProcessing ? "PROSES AI BERJALAN" : "ARAH VISUAL TERPILIH"}</span><h3>{selectedRecipe.name}</h3><p>{resultImage ? `Hasil ${selectedStyle} ${selectedAspect} sudah tersimpan. Geser garis pembanding untuk melihat perubahan.` : isProcessing ? "Jangan tutup halaman ini. Indikator bergerak sebagai perkiraan sampai hasil asli dari AI diterima." : `Unggah foto asli lalu terapkan resep serta gaya ${selectedStyle} untuk membuat hasil ${selectedAspect}.`}</p></div>
              {resultImage ? <div className="result-actions"><button className="download-action" onClick={() => { downloadImage(resultImage, selectedRecipe.id); toast.success("Unduhan hasil dimulai."); }}><Download size={16} /> Unduh</button><button className="share-action" onClick={() => void shareImage(resultImage, selectedRecipe.name)}><Share2 size={16} /> Bagikan</button><button className="share-action retry-action" onClick={tryAnotherRecipe} disabled={isRestoringHistorySource}><RotateCcw size={16} /> {isRestoringHistorySource ? "Menyiapkan sumber…" : "Coba resep lain"}</button></div> : <button className="primary-action full-action" onClick={applyRecipe} disabled={isProcessing || (!hasUnlimitedStudioAccess && quotaQuery.data?.exhausted && (creditBalanceQuery.data?.credits ?? 0) < 1)}>{isProcessing ? <><LoaderCircle className="spin-icon" size={17} /> Sedang meracik...</> : hasUnlimitedStudioAccess ? <>Terapkan tanpa batas <ArrowRight size={17} /></> : quotaQuery.data?.exhausted && (creditBalanceQuery.data?.credits ?? 0) < 1 ? "Tambah kredit untuk lanjut" : quotaQuery.data?.exhausted ? "Pakai 1 kredit tambahan" : <>Terapkan resep <ArrowRight size={17} /></>}</button>}
            </section>
          </div>
          {isProcessing && <div className="progress-console" role="status" aria-live="polite"><div className="console-title"><span className="pulse-dot" /> PROSES AKTIF <b>{progress}%</b></div><div className="console-steps">{progressStages.map((stage, index) => <div key={stage} className={index < progressStage ? "is-complete" : index === progressStage ? "is-current" : ""}><span>{index < progressStage ? <Check size={12} /> : String(index + 1).padStart(2, "0")}</span>{stage}</div>)}</div></div>}
        </section>

        <section className="history-section" id="gallery">
          <div className="section-heading"><div><span className="eyebrow">03 — koleksi pribadi</span><h2>Jejak frame-mu.</h2></div><p>{isAuthenticated ? "Semua hasil transformasi tersimpan privat di akunmu. Pilih kembali kapan pun untuk melihat atau mengunduh ulang." : "Masuk untuk membuat galeri personal yang menyimpan sumber dan hasil transformasi AI."}</p></div>
          {!isAuthenticated ? <div className="history-login"><div><History size={28} /><strong>Koleksimu dimulai dari satu foto.</strong><p>Masuk untuk menyimpan riwayat, meninjau hasil lama, dan mengunduh kembali kapan saja.</p></div><button className="primary-action" onClick={startLogin}><LogIn size={16} /> Masuk & buat koleksi</button></div> : historyQuery.isLoading ? <div className="history-loading"><LoaderCircle className="spin-icon" size={22} /> Membuka arsip visualmu...</div> : historyQuery.isError ? <div className="history-error"><strong>Arsip belum bisa dibuka.</strong><p>Periksa koneksi lalu coba memuat ulang koleksi.</p><button className="secondary-action" onClick={() => void historyQuery.refetch()}>Muat ulang</button></div> : historyQuery.data?.length ? <div className="history-grid">{historyQuery.data.map((item) => <article className={`history-card ${item.status}`} key={item.id}><div className="history-thumb"><img src={privateMediaUrl(item.resultUrl || item.sourceUrl)} alt={`Hasil ${item.title}`} />{item.status === "completed" ? <span>SELESAI</span> : <span>{item.status.toUpperCase()}</span>}</div><div className="history-info"><small>{formatDate(item.createdAt)}</small><strong>{item.title}</strong><p>{item.status === "completed" ? `${item.style} · ${item.aspectRatio} siap dilihat ulang.` : item.status === "failed" ? "Proses sebelumnya belum berhasil." : "Masih diproses di studio."}</p><div className="history-actions">{item.resultUrl && <button onClick={() => void restoreHistoryToStudio(item)}><Sparkles size={14} /> Bandingkan</button>}{item.resultUrl && <button onClick={() => downloadImage(item.resultUrl ?? item.sourceUrl, item.recipe)}><Download size={14} /> Unduh</button>}{item.resultUrl && <button onClick={() => void shareImage(item.resultUrl ?? item.sourceUrl, item.title)}><Share2 size={14} /> Bagikan</button>}</div></div></article>)}</div> : <div className="history-empty"><span className="film-count">00 / 00</span><strong>Belum ada frame di koleksi.</strong><p>Unggah foto pertama, pilih resep, lalu hasilnya akan muncul di sini.</p><button className="secondary-action" onClick={() => scrollTo("studio")}>Masuk studio</button></div>}
        </section>

        <section className="explore-section"><div className="section-heading compact-heading"><div><span className="eyebrow">04 — arah visual</span><h2>Untuk pekerjaan yang berbeda.</h2></div><button className="text-button" onClick={() => scrollTo("studio")}>Pilih resep <ArrowRight size={15} /></button></div><div className="contact-meta"><span>CONTACT SHEET / 04 FRAME</span><span>ARAH VISUAL TERPILIH</span></div><div className="explore-strip"><article className="explore-card"><img src={assets.headshot} alt="Contoh hasil portrait profesional" /><span className="explore-frame-no">01 / 04</span><div><span>PROFIL KERJA</span><strong>Rapi tanpa terasa kaku.</strong></div></article><article className="explore-card"><img src={assets.product} alt="Contoh foto produk katalog" /><span className="explore-frame-no">02 / 04</span><div><span>FOTO PRODUK</span><strong>Detail kecil ikut bicara.</strong></div></article><article className="explore-card"><img src={assets.food} alt="Contoh foto makanan editorial" /><span className="explore-frame-no">03 / 04</span><div><span>MENU & KULINER</span><strong>Warna hangat, fokus ke rasa.</strong></div></article><article className="explore-text-card"><span>RESEP BARU SETIAP PEKAN</span><p>Buka satu foto ke banyak kemungkinan baru.</p><button onClick={() => scrollTo("studio")}>Masuk studio <ArrowRight size={17} /></button></article></div></section>
        <footer className="footer"><div className="footer-brand"><span className="footer-mark"><span className="aperture-mark" aria-hidden="true" /></span><div><strong>Lensa Saku</strong><span>Studio AI untuk kerja visual yang bergerak cepat.</span></div></div><span>© 2026 · Foto disimpan privat per akun</span></footer>
      </section>
    </main>
  );
}
