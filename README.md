# Jelajah Bahasa — Bahasa Indonesia Kelas VI

Website pembelajaran interaktif untuk murid Kelas VI dengan materi bertahap, ilustrasi buatan baru, latihan terbimbing, uji pemahaman acak, pembahasan, serta dashboard progres guru.

## Fitur

- **Kisi-kisi pembelajaran** berdasarkan cakupan kompetensi dalam naskah SAS Bahasa Indonesia Kelas VI Tahun Pelajaran 2026/2027.
- **7 modul materi**: teks eksplanasi; informasi tersurat/tersirat; sebab-akibat dan kronologi; cerita rakyat dan nilai kehidupan; diksi/kata baku/kluster/diftong; denotatif dan konotatif; serta rancangan cerita dan dialog.
- **Langkah menjawab** dan tips pada tiap modul.
- **Latihan terbimbing** dengan contoh, petunjuk, dan pembahasan.
- **Uji pemahaman acak**: benar-salah, pilihan ganda, pilih dua jawaban, isian, serta dua uraian singkat.
- **Kunci dan bank soal khusus guru**. Murid melihat pembahasan atas jawaban yang sudah dikerjakan.
- **Dashboard progres guru**, ekspor CSV, dan pemeriksaan manual jawaban uraian.
- **Mode demo lokal** tanpa akun agar website dapat dicoba langsung.
- **Supabase** untuk akun, database, keamanan berdasarkan peran, dan pembaruan progres realtime lintas perangkat.
- **Responsive** untuk komputer, tablet, dan ponsel.

> Seluruh stimulus, teks, dan soal latihan pada aplikasi ini dibuat baru. Tidak ada butir soal asli dari PDF yang ditampilkan atau disalin.

## 1. Menjalankan secara lokal

Pastikan Node.js 20 atau lebih baru terpasang.

```bash
npm install
npm run dev
```

Buka alamat lokal yang muncul di terminal (biasanya `http://localhost:5173`).

Untuk mencoba tanpa konfigurasi database, pilih **Mode demo**. Hasil demo disimpan di `localStorage` browser yang sama. Untuk melihat dashboard guru demo, masuk lagi sebagai Guru (demo) pada browser yang sama setelah beberapa murid menyelesaikan latihan.

## 2. Mengaktifkan database dan pemantauan realtime (Supabase)

1. Buat proyek di [Supabase](https://supabase.com/).
2. Buka **SQL Editor** pada proyek Supabase.
3. Jalankan seluruh isi `supabase/schema.sql`.
4. Pada **Project Settings → API**, salin Project URL dan anon/publishable key.
5. Salin `.env.example` menjadi `.env.local`, lalu isi:

```env
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

6. Jalankan ulang `npm run dev`.
7. Murid memilih **Daftar**, mengisi nama, kelas, email, dan kata sandi. Murid kemudian masuk lewat **Masuk online**. Kebijakan database membatasi siswa agar hanya dapat membaca hasil miliknya sendiri.
8. Buat akun guru melalui menu Daftar seperti biasa. Setelah akun dibuat, buka SQL Editor dan aktifkan perannya dengan perintah berikut (ganti email):

```sql
UPDATE public.profiles
SET role = 'teacher'
WHERE id = (SELECT id FROM auth.users WHERE email = 'guru@sekolah.sch.id');
```

9. Keluar lalu masuk kembali menggunakan akun guru. Menu **Progres murid** dan **Kunci & bank soal** akan muncul.

### Cara kerja database

- `profiles`: identitas, kelas, dan peran akun.
- `attempts`: skor objektif, durasi, jawaban murid, kunci/pembahasan yang relevan, serta penilaian dan umpan balik uraian.
- Row Level Security (RLS) membatasi siswa agar hanya membaca/menambahkan hasil dengan `user_id` miliknya. Akun guru dapat membaca hasil seluruh murid dan memperbarui penilaian uraian.
- Dashboard guru berlangganan perubahan tabel `attempts` melalui Supabase Realtime.

**Keamanan:** jangan pernah memasukkan `service_role` key ke aplikasi browser. Aplikasi hanya menggunakan anon/publishable key dan mengandalkan RLS. Pastikan RLS dan SQL schema telah dijalankan sebelum dipakai oleh murid.

## 3. Deploy ke GitHub Pages

1. Buat repository GitHub baru.
2. Unggah semua isi folder proyek ini ke branch `main` (termasuk `.github/workflows/deploy.yml`).
3. Jika menggunakan Supabase, buka **Settings → Secrets and variables → Actions** pada repository. Tambahkan secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Buka **Settings → Pages**, pilih **GitHub Actions** sebagai Build and deployment source.
5. Push perubahan ke branch `main`, atau jalankan workflow `Deploy Jelajah Bahasa to GitHub Pages` melalui tab Actions.
6. Setelah workflow berhasil, buka alamat GitHub Pages yang disediakan GitHub.

Tanpa secrets Supabase, situs tetap dapat dibuka dalam mode demo lokal, tetapi data tidak terkumpul lintas perangkat.

## 4. Deploy ke hosting statis lain

```bash
npm install
npm run build
```

Unggah isi folder `dist/` ke hosting statis. Isi dua environment variable Supabase saat proses build jika ingin menggunakan database daring.

## 5. Catatan penggunaan guru

- Uji pemahaman memilih secara acak 3 benar-salah, 5 pilihan ganda, 2 pilihan dua jawaban, 2 isian singkat, dan 2 uraian singkat.
- Skor otomatis dihitung dari 12 soal objektif. Dua uraian ditampilkan sebagai **menunggu penilaian guru** dan dapat diperiksa pada dashboard guru menggunakan rubrik.
- Bank soal berisi variasi stimulus baru. Acak urutan dan pemilihan butir dilakukan setiap kali murid memulai tes.
- Untuk menambah variasi, guru/pengembang dapat menambahkan butir baru pada `src/data.js` dengan format objek soal yang telah digunakan.
- Ilustrasi tersimpan pada `public/illustrations/` dan dapat diganti/ditambah dengan aset yang sesuai.

## Struktur folder

```text
src/
  data.js       # kisi-kisi, materi, contoh, dan bank soal
  db.js         # integrasi Supabase
  main.jsx      # alur aplikasi dan komponen halaman
  style.css     # desain responsif
public/
  illustrations/ # gambar ilustrasi SVG baru
supabase/
  schema.sql    # tabel, RLS, trigger profil, dan realtime
.github/workflows/
  deploy.yml    # build dan deploy GitHub Pages
```

Dibuat sebagai bahan pembelajaran Bahasa Indonesia Kelas VI — SDN 61 Singkawang.

## Batasan keamanan untuk ujian resmi

Aplikasi ini ditujukan sebagai media belajar dan asesmen formatif. Karena website dibangun sebagai aplikasi statis, bank soal dan proses pemeriksaan otomatis berada di sisi browser; pengguna yang sangat memahami pengembangan web secara teknis dapat memeriksa berkas JavaScript yang dikirim ke browser. Nilai yang dikirim dari browser juga bukan sistem pengawasan ujian berisiko tinggi. Untuk ujian resmi berisiko tinggi, pindahkan bank soal dan proses penilaian ke backend/Edge Function yang memvalidasi jawaban di server.
