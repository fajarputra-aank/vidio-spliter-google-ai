/**
 * Design reminder — Kamar Gelap Editorial: make the photo the focal point;
 * use contact-sheet details, calm paper space, charcoal type, and amber only for progress/action.
 */
import { useRef, useState } from "react";
import {
  Aperture,
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Download,
  ImagePlus,
  Layers3,
  Menu,
  Package,
  ScanFace,
  Sparkles,
  Utensils,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

const assets = {
  logo: "/manus-storage/lensa-saku-logo_25388856.png",
  hero: "/manus-storage/lensa-saku-hero-studio_c48067d1.jpg",
  headshot: "/manus-storage/lensa-saku-headshot_7856b583.jpg",
  product: "/manus-storage/lensa-saku-product_3a89a43d.jpg",
  food: "/manus-storage/lensa-saku-food_bf21e58e.jpg",
};

type Recipe = {
  id: string;
  name: string;
  category: string;
  label: string;
  description: string;
  image: string;
  filter: string;
  prompt: string;
};

const recipes: Recipe[] = [
  {
    id: "headshot",
    name: "Headshot rapi",
    category: "Potret",
    label: "Paling dipilih",
    description: "Pencahayaan studio bersih untuk profil kerja dan CV.",
    image: assets.headshot,
    filter: "contrast(1.04) saturate(.9) sepia(.08)",
    prompt: "cahaya studio lembut",
  },
  {
    id: "product",
    name: "Produk katalog",
    category: "Produk",
    label: "Untuk jualan",
    description: "Rapi, terang, dan berfokus pada detail produk.",
    image: assets.product,
    filter: "contrast(1.08) saturate(1.08) brightness(1.05)",
    prompt: "latar katalog hangat",
  },
  {
    id: "food",
    name: "Menu menggoda",
    category: "Makanan",
    label: "Baru",
    description: "Warna makanan diperkuat tanpa mengubah rasa alami.",
    image: assets.food,
    filter: "saturate(1.14) contrast(1.04) brightness(1.03)",
    prompt: "nuansa menu editorial",
  },
  {
    id: "social",
    name: "Konten sosial",
    category: "Sosial",
    label: "Cepat pakai",
    description: "Kontras ringan untuk feed yang terasa lebih hidup.",
    image: assets.headshot,
    filter: "saturate(1.18) contrast(1.1) hue-rotate(-5deg)",
    prompt: "warna editorial hangat",
  },
];

const categories = [
  { name: "Semua", icon: Layers3 },
  { name: "Potret", icon: ScanFace },
  { name: "Produk", icon: Package },
  { name: "Makanan", icon: Utensils },
  { name: "Sosial", icon: Sparkles },
];

const navItems = [
  { label: "Studio", icon: Aperture, active: true },
  { label: "Koleksi", icon: Layers3, active: false },
  { label: "Bantuan", icon: Camera, active: false },
];

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe>(recipes[0]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const shownRecipes =
    selectedCategory === "Semua"
      ? recipes
      : recipes.filter((recipe) => recipe.category === selectedCategory);

  const currentImage = uploadedImage ?? selectedRecipe.image;

  function readImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Pilih berkas gambar berformat JPG, PNG, atau WEBP.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(String(reader.result));
      setUploadedName(file.name);
      setIsDone(false);
      toast.success("Foto masuk ke meja kerja.");
    };
    reader.readAsDataURL(file);
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) readImage(file);
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) readImage(file);
  }

  function applyRecipe() {
    setIsProcessing(true);
    setIsDone(false);
    window.setTimeout(() => {
      setIsProcessing(false);
      setIsDone(true);
      toast.success(`${selectedRecipe.name} siap dipratinjau.`);
    }, 850);
  }

  function downloadPreview() {
    const link = document.createElement("a");
    link.href = currentImage;
    link.download = `lensa-saku-${selectedRecipe.id}.jpg`;
    link.click();
    toast.success("Pratinjau diunduh.");
  }

  function scrollToStudio() {
    document.getElementById("studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="studio-shell">
      <aside className="rail" aria-label="Navigasi utama">
        <button className="brand-badge" aria-label="Lensa Saku beranda" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <img src={assets.logo} alt="" />
        </button>
        <nav className="rail-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={`rail-nav-button ${item.active ? "is-active" : ""}`}
                aria-label={item.label}
                onClick={() => {
                  if (item.label === "Studio") scrollToStudio();
                  else toast.message(`${item.label} akan hadir dalam pembaruan berikutnya.`);
                }}
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="rail-avatar" onClick={() => toast.message("Profil lokal siap disambungkan.")}>D</button>
      </aside>

      <section className="page-content">
        <header className="topbar">
          <div className="desktop-brand" aria-label="Lensa Saku Studio AI">
            <span className="desktop-brand-mark"><img src={assets.logo} alt="" /></span>
            <span><strong>Lensa Saku</strong><small>STUDIO AI</small></span>
          </div>
          <div className="mobile-brand">
            <img src={assets.logo} alt="" />
            <div><strong>Lensa Saku</strong><span>Studio AI</span></div>
          </div>
          <div className="eyebrow topbar-note"><span className="pulse-dot" /> ruang kerja kreatif</div>
          <div className="topbar-actions">
            <button className="text-button" onClick={() => toast.message("Paket Pro akan tersedia setelah integrasi pembayaran diaktifkan.")}>Lihat paket <ChevronRight size={15} /></button>
            <button className="mobile-menu" aria-label="Buka menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
          </div>
        </header>

        {menuOpen && (
          <div className="mobile-panel" role="dialog" aria-label="Menu aplikasi">
            <button onClick={scrollToStudio}>Studio kerja</button>
            <button onClick={() => toast.message("Koleksi masih disiapkan.")}>Koleksi resep</button>
            <button onClick={() => toast.message("Kami sedang menyiapkan pusat bantuan.")}>Bantuan</button>
          </div>
        )}

        <section className="masthead">
          <div className="masthead-copy">
            <div className="eyebrow">01 — meja kerja visual</div>
            <h1>Satu foto masuk.<br /><em>Materi siap pakai</em> keluar.</h1>
            <p>Ubah foto produk, potret, dan menu menjadi visual yang lebih rapi dengan resep AI yang mudah dipilih.</p>
            <div className="masthead-ctas">
              <button className="primary-action" onClick={scrollToStudio}>Mulai dari foto <ArrowRight size={17} /></button>
              <div className="compact-proof"><span>60+</span><small>arah visual<br />untuk dieksplorasi</small></div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-frame">
              <img src={assets.hero} alt="Meja kerja studio kreatif dengan kamera dan contact sheet" />
              <span className="frame-number">N-024 / 36</span>
              <span className="hero-stamp">DIBUAT UNTUK BERGERAK</span>
            </div>
            <div className="hero-note"><Aperture size={16} /> <span>foto biasa, arah yang lebih jelas</span></div>
          </div>
        </section>

        <section className="process-strip" aria-label="Alur kerja">
          <div><span>01</span><strong>Masukkan foto</strong><p>JPG, PNG, atau WEBP.</p></div>
          <div><span>02</span><strong>Pilih resep</strong><p>Sesuaikan dengan tujuan.</p></div>
          <div><span>03</span><strong>Simpan hasil</strong><p>Pratinjau siap digunakan.</p></div>
          <aside><Clock3 size={18} /><span>Kurang dari satu menit untuk mulai.</span></aside>
        </section>

        <section className="workbench-section" id="studio">
          <div className="section-heading">
            <div>
              <span className="eyebrow">02 — studio aktif</span>
              <h2>Racik frame-mu.</h2>
            </div>
            <p>Mulai dengan foto sendiri, atau coba resep memakai contoh visual yang sudah tersedia.</p>
          </div>

          <div className="workbench">
            <section className="upload-column">
              <div className="column-label"><span>FOTO SUMBER</span><span>{uploadedName || "belum ada"}</span></div>
              <div
                className={`upload-zone ${isDragging ? "is-dragging" : ""} ${uploadedImage ? "has-upload" : ""}`}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
              >
                {uploadedImage ? (
                  <>
                    <img src={uploadedImage} alt="Foto yang diunggah pengguna" />
                    <div className="upload-overlay"><ImagePlus size={18} /><span>Ganti foto</span></div>
                    <button className="clear-upload" aria-label="Hapus foto" onClick={() => { setUploadedImage(null); setUploadedName(""); setIsDone(false); }}><X size={16} /></button>
                  </>
                ) : (
                  <div className="upload-empty">
                    <span className="upload-icon"><ImagePlus size={24} /></span>
                    <strong>Tarik foto ke sini</strong>
                    <p>atau pilih dari perangkatmu</p>
                    <button className="secondary-action" onClick={() => inputRef.current?.click()}>Pilih berkas</button>
                    <small>Maks. 10 MB · JPG, PNG, WEBP</small>
                  </div>
                )}
                <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} hidden />
              </div>
              <p className="local-note"><span /> Mode demonstrasi lokal. Foto hanya dipratinjau di peramban ini.</p>
            </section>

            <section className="recipe-column">
              <div className="column-label"><span>PILIH RESEP</span><span>{shownRecipes.length} tersedia</span></div>
              <div className="category-tabs" aria-label="Kategori resep">
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.name}
                      className={selectedCategory === category.name ? "is-selected" : ""}
                      onClick={() => setSelectedCategory(category.name)}
                    ><Icon size={15} />{category.name}</button>
                  );
                })}
              </div>
              <div className="recipe-list">
                {shownRecipes.map((recipe, index) => (
                  <button
                    key={recipe.id}
                    className={`recipe-card ${selectedRecipe.id === recipe.id ? "is-selected" : ""}`}
                    onClick={() => { setSelectedRecipe(recipe); setIsDone(false); }}
                  >
                    <span className="recipe-image"><img src={recipe.image} alt="" /><i>R-{String(index + 1).padStart(2, "0")}</i></span>
                    <div><span className="recipe-label">{recipe.label}</span><strong>{recipe.name}</strong><p>{recipe.description}</p></div>
                    <span className="recipe-check">{selectedRecipe.id === recipe.id && <Check size={15} />}</span>
                  </button>
                ))}
              </div>
              <div className="selected-recipe-note"><WandSparkles size={16} /><span>Resep dipilih: <strong>{selectedRecipe.name}</strong> · {selectedRecipe.prompt}</span></div>
            </section>

            <section className="result-column">
              <div className="column-label"><span>PRATINJAU</span><span>{isDone ? "siap" : "menunggu"}</span></div>
              <div className={`result-frame ${isProcessing ? "is-processing" : ""}`}>
                <img src={currentImage} alt="Pratinjau hasil resep terpilih" style={{ filter: isDone ? selectedRecipe.filter : "none" }} />
                <span className="frame-number">LS / 2026</span>
                {isProcessing && <div className="processing-layer"><Sparkles size={20} /><span>Merapikan frame...</span></div>}
                {isDone && <span className="result-stamp">SIAP CETAK</span>}
              </div>
              <div className="result-copy">
                <span className="eyebrow">{isDone ? "RESEP SUDAH DITERAPKAN" : "CONTOH ARAH VISUAL"}</span>
                <h3>{selectedRecipe.name}</h3>
                <p>{isDone ? "Pratinjau lokal menggunakan penyesuaian warna untuk memberi gambaran arah hasil." : "Pilih resep lalu terapkan untuk melihat pratinjau pada foto pilihanmu."}</p>
              </div>
              {isDone ? (
                <button className="download-action" onClick={downloadPreview}><Download size={16} /> Unduh pratinjau</button>
              ) : (
                <button className="primary-action full-action" onClick={applyRecipe} disabled={isProcessing}>{isProcessing ? "Sedang meracik..." : "Terapkan resep"}<ArrowRight size={17} /></button>
              )}
            </section>
          </div>
        </section>

        <section className="explore-section">
          <div className="section-heading compact-heading"><div><span className="eyebrow">03 — arah visual</span><h2>Untuk pekerjaan yang berbeda.</h2></div><button className="text-button" onClick={scrollToStudio}>Lihat semua resep <ArrowRight size={15} /></button></div>
          <div className="contact-meta"><span>CONTACT SHEET / 04 FRAME</span><span>ARAH VISUAL TERPILIH</span></div>
          <div className="explore-strip">
            <article className="explore-card portrait-card"><img src={assets.headshot} alt="Contoh hasil portrait profesional" /><span className="explore-frame-no">01 / 04</span><div><span>PROFIL KERJA</span><strong>Rapi tanpa terasa kaku.</strong></div></article>
            <article className="explore-card product-card"><img src={assets.product} alt="Contoh foto produk katalog" /><span className="explore-frame-no">02 / 04</span><div><span>FOTO PRODUK</span><strong>Detail kecil ikut bicara.</strong></div></article>
            <article className="explore-card food-card"><img src={assets.food} alt="Contoh foto makanan editorial" /><span className="explore-frame-no">03 / 04</span><div><span>MENU & KULINER</span><strong>Warna hangat, fokus ke rasa.</strong></div></article>
            <article className="explore-text-card"><span>RESEP BARU SETIAP PEKAN</span><p>Buka satu foto ke banyak kemungkinan baru.</p><button onClick={scrollToStudio}>Masuk studio <ArrowRight size={17} /></button></article>
          </div>
        </section>

        <footer className="footer">
          <div className="footer-brand"><img src={assets.logo} alt="" /><div><strong>Lensa Saku</strong><span>Studio AI untuk kerja visual yang bergerak cepat.</span></div></div>
          <span>© 2026 · Dibangun sebagai demonstrasi antarmuka</span>
        </footer>
      </section>
    </main>
  );
}
