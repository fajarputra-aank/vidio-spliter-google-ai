# Deployment Vercel melalui GitHub Actions

Workflow deployment berada di `.github/workflows/ci.yml` dan hanya berjalan setelah job CI berhasil pada push ke branch `main`.

## Mengaktifkan deployment

Di repository GitHub, tambahkan **Actions variables** berikut:

| Nama | Nilai |
|---|---|
| `VERCEL_DEPLOY_ENABLED` | `true` |

Tambahkan **Actions secrets** berikut:

| Nama | Isi |
|---|---|
| `VERCEL_TOKEN` | Token akses Vercel |
| `VERCEL_ORG_ID` | ID organisasi/team Vercel |
| `VERCEL_PROJECT_ID` | ID project Vercel |

Workflow akan menjalankan:

1. `vercel pull` untuk mengambil konfigurasi project production.
2. `vercel build --prod` untuk membuat artefak deployment.
3. `vercel deploy --prebuilt --prod` untuk menerbitkan deployment.

Deployment tidak berjalan pada pull request. Pastikan project Vercel sudah dikonfigurasi untuk aplikasi full-stack ini, termasuk environment variables production dan routing server/API yang diperlukan.

> Jangan menyimpan token, database URL, SMTP password, atau secret production di dalam repository. Gunakan GitHub Actions Secrets dan environment variables Vercel.
