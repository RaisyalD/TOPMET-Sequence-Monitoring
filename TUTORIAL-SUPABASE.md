# Tutorial TOPMET Dashboard dengan Supabase

Dokumen ini menjelaskan cara menjalankan TOPMET Machine Monitoring Dashboard,
membuat akun, login, memuat data baseline, dan mengedit data mesin.

## Alur User Singkat

```text
Register
   ↓
Konfirmasi email jika diminta
   ↓
Login
   ↓
Machine Overview
   ↓
Pilih mesin dan trial
   ↓
Edit sequence / komponen / pressure / score
   ↓
Simpan ke Supabase
   ↓
Grafik dan tabel memakai data terbaru
   ↓
User lain menerima perubahan melalui Realtime
```

### Alur lengkap user

1. User membuka `register.html`.
2. User membuat akun dengan email dan password.
3. User melakukan konfirmasi email jika fitur tersebut aktif.
4. User membuka `login.html`.
5. User memasukkan email dan password.
6. Sistem memvalidasi session ke Supabase Authentication.
7. User diarahkan ke `index.html`, dimulai dari **Machine Overview**.
8. Dashboard mengambil data dari Supabase.
9. User membuka panel **Edit Data Mesin**.
10. User memilih mesin, trial, titik waktu, dan data yang ingin diedit.
11. User menyimpan perubahan.
12. Supabase menyimpan perubahan secara permanen.
13. Dashboard memperbarui angka, tabel, dan grafik.
14. User lain yang sedang login menerima perubahan melalui Realtime.
15. User memilih **Keluar** untuk mengakhiri session.

User tidak dapat masuk ke dashboard tanpa login. Jika session tidak ditemukan
atau sudah berakhir, sistem mengarahkan user kembali ke `login.html`.

## 1. Prasyarat

- Project Supabase sudah dibuat.
- Email/Password Authentication aktif di Supabase.
- Repository dijalankan melalui web server lokal atau Vercel.
- Migration database sudah tersedia di:

  `supabase/migrations/202611170001_topmet_foundation.sql`

Jangan masukkan `service_role` key ke frontend atau repository.
Frontend hanya menggunakan project URL dan publishable/anon key.

## 2. Menjalankan Project Lokal

Jalankan web server dari folder repository:

```powershell
cd "C:\Users\RAISYAL D\TOPMET-Dashboard"
npx serve .
```

Kemudian buka URL yang diberikan oleh server, misalnya:

```text
http://localhost:3000/register.html
```

Jangan membuka file HTML dengan `file:///`, karena beberapa fitur authentication
dan request Supabase memerlukan web server.

## 3. Menjalankan Migration Supabase

1. Buka Supabase Dashboard.
2. Pilih project TOPMET.
3. Buka **SQL Editor**.
4. Buka file:

   `supabase/migrations/202611170001_topmet_foundation.sql`

5. Salin seluruh isinya ke SQL Editor.
6. Klik **Run**.

Migration membuat tabel:

- `machines`
- `trials`
- `components`
- `sequence_samples`
- `component_states`
- `pressure_channels`
- `pressure_samples`
- `hmi_parameters`
- `machine_scores`
- `maintenance_insights`

Migration juga mengaktifkan Row Level Security dan policy untuk user
authenticated.

## 4. Mengatur Authentication

Di Supabase:

1. Buka **Authentication**.
2. Buka **Providers**.
3. Pastikan **Email** aktif.
4. Tentukan apakah **Confirm email** ingin diaktifkan.

Jika Confirm email aktif, user harus membuka email konfirmasi sebelum login.

## 5. Registrasi User

1. Buka `register.html`.
2. Masukkan email.
3. Masukkan password minimal 6 karakter.
4. Masukkan ulang password.
5. Klik **Daftar**.
6. Jika diminta, buka email konfirmasi dari Supabase.
7. Setelah registrasi selesai, buka `login.html`.

Halaman registrasi tidak langsung membuka dashboard. User harus login secara
terpisah.

## 6. Login User

1. Buka `login.html`.
2. Masukkan email dan password.
3. Klik **Masuk**.
4. Sistem mengarahkan user ke `index.html`.

Jika user membuka `index.html` tanpa session aktif, user otomatis diarahkan
kembali ke `login.html`.

Untuk keluar, klik tombol **Keluar** pada header dashboard.

## 7. Memuat Data Baseline

Jika database masih kosong, panel **Edit Data Mesin** belum memiliki pilihan
mesin, titik waktu, komponen, atau channel pressure.

Ikuti langkah berikut:

1. Login ke dashboard.
2. Cari panel **Edit Data Mesin**.
3. Klik **Muat Data Baseline**.
4. Baca modal konfirmasi.
5. Klik **Lanjutkan**.
6. Tunggu sampai muncul notifikasi berhasil.
7. Refresh dashboard jika diperlukan.

Data baseline berasal dari `data.js` repository. Tidak ada data mesin baru yang
dibuat secara fiktif.

Baseline mencakup:

- Metz 1 sampai Metz 4.
- Trial 1 dan Trial 2.
- Titik waktu sequence.
- Status komponen ON/OFF.
- Vacuum pressure.
- Fase proses.
- Machine Health Score existing.

## 8. Mengedit Sequence Satu Per Satu

Pada panel **Edit Data Mesin**:

1. Pilih mesin.
2. Pilih trial.
3. Pilih jenis data **Sequence & komponen**.
4. Pilih titik waktu.
5. Ubah nilai waktu jika diperlukan.
6. Pilih komponen.
7. Pilih status:
   - `ON / 1`
   - `OFF / 0`
8. Klik **Simpan Sequence**.

Perubahan disimpan ke tabel:

- `sequence_samples`
- `component_states`

## 9. Mengedit Vacuum Pressure

Pada panel **Edit Data Mesin**:

1. Pilih mesin.
2. Pilih trial.
3. Pilih jenis data **Vacuum pressure**.
4. Pilih titik waktu.
5. Pilih channel pressure.
6. Masukkan nilai pressure dalam mbar.
7. Klik **Simpan Pressure**.

Perubahan disimpan ke tabel `pressure_samples`.

Channel yang tersedia mengikuti data aktual, misalnya:

- Coating Chamber
- Winding Chamber
- Line / Foreline
- Diff Pump

## 10. Mengedit Machine Health Score

Pilih jenis data **Machine Health Score**, kemudian ubah:

- Score
- Status
- Ranking

Klik **Simpan Score**.

Nilai disimpan ke tabel `machine_scores`.

Perubahan score akan memengaruhi KPI, ranking, dan chart performa setelah data
dashboard dimuat ulang.

## 11. Menu Dashboard

Setelah data tersedia, menu berikut membaca data terbaru:

- **Machine Overview**
- **Sequence Analysis**
- **Pressure Trend**
- **Trial Comparison**
- **Machine Performance**
- **Component Monitoring**
- **Maintenance Insights**

Grafik dan tabel dirender ulang berdasarkan state dashboard hasil query Supabase.

## 12. Realtime Multi-user

Jika Realtime berhasil:

1. User A mengedit data.
2. Perubahan disimpan ke Supabase.
3. Supabase mengirim event Realtime.
4. User B menerima perubahan dan dashboard dimuat ulang.

Status di header:

- `Database & Realtime aktif`: subscription aktif.
- `Database aktif · Realtime offline`: database dapat digunakan, tetapi
  sinkronisasi otomatis sementara tidak aktif.

## 13. Troubleshooting Realtime

Jika muncul `Realtime: CHANNEL_ERROR`:

1. Pastikan migration sudah dijalankan penuh.
2. Pastikan tabel masuk ke publication `supabase_realtime`.
3. Pastikan user sudah login.
4. Pastikan RLS policy untuk role `authenticated` aktif.
5. Pastikan project Supabase tidak sedang mengalami gangguan.
6. Refresh browser dengan `Ctrl + F5`.
7. Logout dan login kembali.

Realtime offline tidak menghapus data dan tidak mencegah penyimpanan biasa.
Namun user lain tidak menerima perubahan secara otomatis sampai subscription
berhasil.

## 14. Troubleshooting List Kosong

Jika pilihan mesin, titik waktu, komponen, atau channel kosong:

1. Pastikan user sudah login.
2. Pastikan migration sudah dijalankan.
3. Klik **Muat Data Baseline**.
4. Tunggu notifikasi selesai.
5. Refresh dengan `Ctrl + F5`.
6. Periksa tabel berikut di Supabase Table Editor:
   - `machines`
   - `trials`
   - `sequence_samples`
   - `components`
   - `component_states`
   - `pressure_channels`
   - `pressure_samples`

Jika tabel belum memiliki record, baseline belum berhasil dimuat.

## 15. Keamanan

- Jangan commit `service_role` key.
- Jangan menaruh `service_role` key di JavaScript frontend.
- Gunakan publishable/anon key untuk browser.
- Pertahankan RLS aktif.
- Semua operasi CRUD harus dilakukan oleh user authenticated.
- Jangan membagikan key Supabase di dokumentasi publik.
