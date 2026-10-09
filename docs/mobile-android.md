# Build APK Android Lensa Saku

Aplikasi web Lensa Saku sekarang memiliki shell Android berbasis Capacitor dan autentikasi mobile khusus. Backend tetap dijalankan secara independen di VPS, Railway, atau Docker; APK tidak bergantung pada login Manus.

## Konfigurasi backend

Deploy backend independen terlebih dahulu dan pastikan endpoint berikut dapat diakses melalui HTTPS:

```text
https://api.example.com/api/health
https://api.example.com/api/trpc
```

Backend minimal membutuhkan `INDEPENDENT_BACKEND=true`, `JWT_SECRET`, `DATABASE_URL`, provider AI, storage privat, dan SMTP bila verifikasi email/reset password digunakan. Detail lengkap ada di [independent-backend-migration.md](./independent-backend-migration.md).

## Login mobile

APK menggunakan prosedur tRPC berikut:

- `auth.mobileRegister`
- `auth.mobileLogin`
- `auth.mobileRefresh`
- `auth.mobileLogout`

Access token JWT berlaku singkat selama 15 menit. Refresh token berlaku 30 hari, hanya disimpan dalam bentuk hash di tabel `mobileRefreshTokens`, dirotasi setiap kali digunakan, dan dicabut saat logout, reset kata sandi, atau logout semua perangkat. Request API native memakai `Authorization: Bearer <accessToken>`; browser tetap menggunakan cookie.

## Build debug APK

Jalankan dari root repository:

```bash
export VITE_API_BASE_URL=https://api.example.com
pnpm install --frozen-lockfile
pnpm mobile:apk
```

APK debug dihasilkan di:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Untuk emulator Android lokal, `VITE_API_BASE_URL` dapat dikosongkan sehingga fallback native memakai `http://10.0.2.2:3000`. Untuk perangkat fisik, gunakan alamat LAN backend, misalnya `http://192.168.1.20:3000`, atau gunakan HTTPS.

## Build release

Untuk distribusi, gunakan keystore milik pemilik aplikasi dan jangan commit file keystore atau password ke repository. Setelah konfigurasi signing Gradle selesai:

```bash
export VITE_API_BASE_URL=https://api.example.com
pnpm mobile:apk:release
# atau Android App Bundle untuk Play Store
pnpm mobile:aab:release
```

Perintah `mobile:sync` menjalankan build web lalu `cap sync android`. Perintah `mobile:open` membuka proyek native di Android Studio.

## Checklist sebelum distribusi

- [ ] `VITE_API_BASE_URL` menunjuk ke backend production HTTPS.
- [ ] `GET /api/health` merespons sehat dari jaringan perangkat.
- [ ] Migrasi `drizzle/0047_greedy_warbound.sql` sudah diterapkan.
- [ ] Login, logout, refresh token, reset password, dan logout semua perangkat diuji.
- [ ] Keystore release disimpan di secret manager/CI, bukan di Git.
- [ ] Provider AI dan S3 bucket privat sudah menggunakan credential production.
- [ ] Verifikasi email dan SMTP production sudah dikonfigurasi.
