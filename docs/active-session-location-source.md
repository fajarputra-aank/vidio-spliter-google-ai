# Sumber Lokasi Kasar Sesi

Implementasi sesi aktif menggunakan endpoint HTTPS `https://ipwho.is/{IP}` dari dokumentasi IPWHOIS pada https://ipwhois.io/documentation. Dokumentasi menyatakan endpoint lookup tunggal tidak memerlukan API key dan dapat mengembalikan kota serta negara. Aplikasi hanya menyimpan label kota/negara hasil lookup; alamat IP mentah, koordinat, dan data jaringan tidak dipersistenkan.
