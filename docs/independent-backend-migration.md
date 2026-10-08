# Migrasi Backend Independen

Backend Lensa Saku sekarang memiliki adapter provider yang dapat dijalankan di luar Manus tanpa mengubah kontrak tRPC client.

## Komponen yang sudah dipisahkan

- **Autentikasi:** login lokal email/kata sandi memakai JWT cookie bertanda tangan `JWT_SECRET`.
- **Database:** tetap memakai Drizzle + MySQL-compatible melalui `DATABASE_URL`.
- **AI image:** pilih `AI_PROVIDER=openai` untuk OpenAI Images API atau `AI_PROVIDER=manus` untuk kompatibilitas lama.
- **Storage:** pilih `STORAGE_PROVIDER=s3` untuk S3-compatible storage atau `STORAGE_PROVIDER=manus` untuk kompatibilitas lama.
- **Health check:** `GET /api/health` mengembalikan status aman tanpa secret.

## Environment minimum mode independen

```env
NODE_ENV=production
INDEPENDENT_BACKEND=true
PORT=3000
JWT_SECRET=ganti-dengan-random-secret-minimal-32-karakter
DATABASE_URL=mysql://user:password@host:3306/lensa_saku

AI_PROVIDER=openai
OPENAI_API_KEY=isi-di-secret-manager
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_SIZE=1024x1024

STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<endpoint-s3-compatible>
S3_REGION=auto
S3_BUCKET=lensa-saku-private
S3_ACCESS_KEY_ID=isi-di-secret-manager
S3_SECRET_ACCESS_KEY=isi-di-secret-manager
S3_FORCE_PATH_STYLE=false
```

Jangan commit file `.env` atau nilai secret. Simpan environment melalui secret manager hosting, Docker secrets, atau environment variables server.

## Provider storage yang disarankan

- Cloudflare R2: endpoint bucket R2, `S3_REGION=auto`, `S3_FORCE_PATH_STYLE=false`.
- AWS S3: endpoint boleh dikosongkan, gunakan region bucket, `S3_FORCE_PATH_STYLE=false`.
- MinIO/self-hosted: isi endpoint dan gunakan `S3_FORCE_PATH_STYLE=true`.

Object tetap disimpan dengan key internal dan dikembalikan sebagai `/manus-storage/...` untuk menjaga kompatibilitas database/client lama. Proxy aplikasi mengeluarkan signed URL privat sehingga bucket tidak perlu dibuka publik.

## Deployment mandiri

1. Sediakan MySQL/TiDB/PostgreSQL-compatible layer yang sesuai schema saat ini; proyek saat ini memakai dialect MySQL.
2. Jalankan migrasi database dari folder `drizzle/` melalui pipeline deployment.
3. Sediakan bucket S3-compatible privat.
4. Isi secrets AI, database, JWT, dan storage di hosting.
5. Jalankan `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`.
6. Jalankan `NODE_ENV=production INDEPENDENT_BACKEND=true node dist/index.js`.
7. Verifikasi `GET /api/health` sebelum menghubungkan APK atau EXE.

## Tahap berikutnya

- Ganti `manus-storage` menjadi nama path netral setelah migrasi data selesai.
- Tambahkan refresh-token/revocation policy untuk client native.
- Pindahkan scheduled handlers ke cron provider independen.
- Tambahkan adapter email provider independen untuk verifikasi dan reset password.
- Setelah backend stabil, buat client Expo Android dan Tauri Windows menggunakan base URL backend ini.
