# Migrasi Supabase mainnet ke project baru

Tujuan: memindahkan database `nexa-ai-mainnet` ke project Supabase baru tanpa kehilangan data (termasuk prediksi dan salt terenkripsi), dengan downtime sependek mungkin. Project lama tetap melayani sampai cutover.

## 0. Sebelum membuat project baru (penting)

- **Kuota egress 5 GB dihitung per organisasi, bukan per project.** Tooltip Usage Summary menjumlahkan `nexa-ai-mainnet` dan `nexa-ai-testnet` di satu paket. Project baru di organisasi yang sama **tidak** mendapat 5 GB baru; kuotanya sudah terpakai 30 GB. Pilihan: (a) buat project di organisasi baru (paket Free baru), (b) upgrade organisasi ke Pro, atau (c) pindahkan data indexer ke Postgres Railway (lihat bagian 6).
- Region: pilih yang sama dengan Railway service (dan dekat dengan API). Egress antar-region tetap dihitung.
- Compute: Nano/Micro punya Disk IO Budget kecil (baseline 5 MB/s setelah habis). Indexer yang menulis terus-menerus bisa menghabiskannya. Pertimbangkan Small.
- Gunakan **Session pooler** untuk `DATABASE_URL`. Batas koneksi per proses sudah 4 (`DB_POOL_MAX`); jumlahnya kecil, jangan dinaikkan tanpa alasan.

## 1. Siapkan kredensial (oleh Anda, bukan Claude)

Buat file `~/.config/nexa-ai/supabase-mainnet-new.env` (di luar repo) berisi satu baris:

```
DATABASE_URL=postgresql://...   # Session pooler project baru
```

Jangan tempel URL ini ke chat, terminal bersama, atau repo. Claude membaca file itu langsung tanpa menampilkannya.

## 2. Buat skema di project baru

```bash
# Jalankan di: ROOT
set -a && . ~/.config/nexa-ai/supabase-mainnet-new.env && set +a
pnpm --filter @nexa-ai/db migrate
```

Tabel masih kosong, jadi semua index (termasuk `pons_trades_at_idx` dan `pons_tokens_curve_idx`, migrasi 0011) dibuat cepat.

## 3. Cutover (downtime singkat)

Urutan wajib, supaya cursor indexer dan antrian post konsisten:

1. Hentikan service `worker`, `indexer`, `api` di Railway `nexa-ai-mainnet`.
2. Tunggu 1 menit agar koneksi di pooler lama terlepas.
3. Salin **data saja** skema `public` (skema `drizzle` sudah dibuat di langkah 2):

```bash
# Jalankan di: ROOT  (pg_dump dari image postgres lokal; tidak perlu psql terpasang)
set -a && . ~/.config/nexa-ai/supabase-mainnet.env && set +a
docker run --rm -e SRC="$DATABASE_URL" postgres:16-alpine \
  sh -c 'pg_dump "$SRC" --data-only --schema=public --no-owner -Fc' > ~/nexa-mainnet-data.dump

set -a && . ~/.config/nexa-ai/supabase-mainnet-new.env && set +a
docker run --rm -i -e DST="$DATABASE_URL" postgres:16-alpine \
  sh -c 'pg_restore --data-only --no-owner -d "$DST"' < ~/nexa-mainnet-data.dump
```

Catatan: dump sekitar 230 MB data; egress project lama sekitar itu juga. Karena Disk IO project lama sedang dibatasi, dump bisa memakan beberapa menit.

4. Verifikasi jumlah baris cocok antara lama dan baru (tabel utama: `pons_tokens`, `pons_trades`, `token_holders`, `whale_transfers`, `price_snapshots`, `predictions`, `post_queue`, `indexer_state`). Jangan lanjut kalau ada yang berbeda.
5. Di Railway, ganti `DATABASE_URL` ketiga service ke project baru (diisi oleh Anda lewat dashboard).
6. Nyalakan `indexer` dulu, lalu `api`, lalu `worker`. Indexer melanjutkan dari `indexer_state.last_block` yang ikut tersalin.
7. Simpan file dump di tempat aman sampai migrasi terbukti 24 jam, lalu hapus. Dump berisi data terenkripsi (preimage) dan sesi pengguna.

## 4. Rollback

Project lama tidak diubah selama migrasi. Kalau ada masalah: hentikan service, kembalikan `DATABASE_URL` ke project lama, nyalakan lagi. Data yang masuk ke project baru setelah cutover tidak otomatis kembali ke project lama.

## 5. Mengukur egress setelah pindah

Egress baru terbukti rendah hanya dengan pengukuran, bukan janji:

1. Catat angka egress project baru tepat setelah semua service menyala (nol-kan pembacaan: angka awal).
2. Catat lagi setelah 24 jam. Laju harian yang aman untuk kuota 5 GB per bulan adalah di bawah sekitar 166 MB per hari (untuk seluruh organisasi, jadi kurangi bagian project lain).
3. Kalau lebih tinggi: tambah cache dan `limit` di endpoint api publik, lalu ukur lagi.

## 6. Opsi: indexer di Postgres Railway

Indexer menulis dan membaca terus-menerus. Traffic antar-service di jaringan privat Railway tidak dihitung sebagai egress Supabase. Opsi: pindahkan data indexer (`pons_*`, `token_holders`, `whale_transfers`, `price_snapshots`, `burns`, `indexer_state`) ke Postgres Railway, sementara data worker (post, prediksi, pembayaran) tetap di Supabase. Ini mengubah arsitektur (dua DB), jadi catat keputusannya di `docs/DECISIONS.md` dulu.
