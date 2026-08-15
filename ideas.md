# Arah Desain — Lensa Saku

## Tiga Arah Eksplorasi

| Theme Name | Very Brief Intro | Probability |
|---|---|---:|
| **Kamar Gelap Editorial** | Ruang kerja foto modern yang mengambil tekstur *contact sheet*, cap tinta, dan ritme majalah independen. Terasa kreatif, tangkas, dan tetap mudah dipakai. | 0.07 |
| **Katalog Studio Hangat** | Antarmuka seperti lembar katalog produk dengan warna tanah dan kartu foto berlapis. Menonjolkan rasa percaya diri untuk pemilik usaha kecil. | 0.04 |
| **Salon Digital Pop** | Pengalaman visual berani dengan panel warna blok dan kolase hasil transformasi. Cocok untuk eksplorasi gaya yang riang dan ekspresif. | 0.09 |

## Pendekatan Terpilih — Kamar Gelap Editorial

### Design Movement

Perpaduan **New Objectivity photography**, tata letak majalah editorial independen, dan artefak laboratorium foto analog. Antarmuka harus terasa seperti meja kurator kreatif—rapi, taktis, dan kaya bukti visual—bukan galeri kartu generik.

### Core Principles

1. **Foto mendahului ornamen:** gambar dan hasil proses adalah pusat komposisi; UI hanya mengarahkan perhatian.
2. **Sistem kerja terlihat nyata:** tahapan upload, pilih resep, dan unduh ditampilkan sebagai alur yang selalu terbaca.
3. **Kejelasan editorial:** hierarki kontras, label kecil kapital, dan bidang putih lapang membangun ketenangan.
4. **Keberanian terukur:** aksen warna hangat hanya digunakan untuk aksi dan status penting, bukan sebagai dekorasi menyeluruh.

### Color Philosophy

Dasar **kertas tulang hangat** membangun rasa ramah dan profesional; **arang foto** memberi kontras tajam seperti tinta cetak; **amber kilat** menjadi warna kepemilikan bagi tindakan utama dan penanda proses. Hijau gelap hanya dipakai untuk keberhasilan agar bermakna, bukan sebagai warna navigasi umum.

### Layout Paradigm

Desktop berupa **meja kerja asimetris**: rel navigasi tipis di kiri, kanvas hasil besar di tengah, dan panel resep yang menempel di kanan. Bagian eksplorasi menggunakan jalur horizontal seperti strip film, bukan deretan grid terpusat. Di ponsel, rel berubah menjadi header kompak dan panel resep muncul sebagai bagian yang dapat dibuka.

### Signature Elements

1. Pinggiran bingkai ala **negative film** dengan nomor frame pada gambar unggulan.
2. **Cap proses** berbentuk persegi panjang kecil untuk status seperti “SIAP CETAK” atau “AI DITERAPKAN”.
3. Strip metrik ringkas bertanda titik amber yang menampilkan tahapan kerja dan penghematan waktu.

### Interaction Philosophy

Setiap tindakan terasa seperti memilih bahan di meja kerja studio. Kartu resep mengangkat sedikit dan memperlihatkan “lihat contoh”; pilihan aktif menampilkan cap dan garis amber. Aksi yang belum tersambung ke layanan AI akan transparan sebagai demonstrasi lokal dan memberi pemberitahuan yang jujur.

### Animation

Gunakan masuk bertahap 30–70 ms antar-elemen, perpindahan panel 180–240 ms dengan easing `cubic-bezier(0.23, 1, 0.32, 1)`, dan transisi hanya pada opacity serta transform. Hasil proses menggunakan sapuan ringan dari kiri ke kanan, tanpa efek berlebihan. Semua gerak non-esensial dimatikan saat `prefers-reduced-motion` aktif.

### Typography System

**DM Serif Display** dipakai untuk judul dan angka hero agar berkarakter editorial; **Manrope** dipakai untuk navigasi, formulir, dan teks isi agar tetap jelas. Label berukuran kecil memakai kapital dengan pelacakan lebar. Judul besar harus berada pada kisaran 44–68 px di desktop dan tidak dipusatkan tanpa alasan komposisional.

### Brand Essence

**Lensa Saku adalah meja kerja AI untuk mengubah satu foto menjadi materi siap pakai, bagi kreator dan pemilik bisnis yang butuh hasil cepat tanpa mengorbankan rasa visual.**

Kepribadian: **taktis, hangat, berkelas**.

### Brand Voice

Bahasa ringkas, meyakinkan, dan spesifik terhadap pekerjaan yang selesai—bukan jargon AI.

> “Satu foto masuk. Materi jualan keluar.”

> “Pilih resep, kami rapikan frame-nya.”

### Wordmark & Logo

Logo berupa **aperture empat daun** dengan satu irisan amber yang menyerupai kilatan cahaya; tanpa teks di aset ikon. Wordmark menggunakan huruf serif display dengan penekanan pada lengkung “S” seperti sapuan kuas cahaya.

### Signature Brand Color

**Amber Kilat — `#EF8F2F`**. Warna ini hanya untuk aksi utama, indikator progres, dan cap status sehingga langsung dikenali sebagai tanda kerja yang bergerak maju.

## Data & Interaction Decisions

Setiap transformasi memiliki status **processing**, **completed**, atau **failed** serta menyimpan referensi aman ke foto sumber dan hasil di penyimpanan berkas. Koleksi ditampilkan per pengguna yang masuk, sehingga riwayat tidak dicampur antarakun. Saat AI merender, konsol proses menggunakan empat tahap yang mudah dibaca dan progres terestimasi; status tidak diklaim selesai hingga respons dari layanan gambar benar-benar diterima.

## Style Decisions

- **Amber Kilat `#EF8F2F`** hanya digunakan pada aksi, status pilihan, indikator progres, dan cap proses; bidang dekoratif yang luas memakai kertas tulang, arang, atau fotografi.
- **Hijau** dicadangkan khusus untuk status selesai/berhasil dan tidak digunakan sebagai aksen navigasi atau merek umum.
- Setiap bagian utama yang mengandalkan fotografi menyertakan setidaknya satu artefak kamar gelap: nomor frame, batas contact sheet, cap proses, atau tepi film negatif.
