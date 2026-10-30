# Infrastruktur

Hanya nama dan konfigurasi. **Tidak ada nilai rahasia di sini.**

## Vercel (web)

| Item | Nilai |
| --- | --- |
| Akun / scope | `fauzanbayu123-1072s-projects` (hobby) |
| Project | `nexa-ai-web` (dibuat 2026-10-31 atas perintah "Deploy web") |
| Root Directory | `apps/web` (source files di luar root diizinkan: workspace pnpm + fixture di `docs/`) |
| Framework | Next.js 15.5.28, React 19.3.1 |
| Build command | `pnpm run build` (menimpa deteksi otomatis `turbo run build`, yang butuh `packageManager`) |
| Install | otomatis; pnpm 10.28 dipilih Vercel dari lockfile v9 |
| Git | **Belum terhubung** (repo belum di-push). Deploy lewat CLI dari folder lokal |
| Unggahan | Daftar putih di `.vercelignore`; `.env*`, `contracts/`, dan `.git` tidak pernah diunggah |

Deploy preview pertama (tanpa API; data dari fixture): `https://nexa-ai-jhj9z9r0t-fauzanbayu123-1072s-projects.vercel.app`
(dilindungi Deployment Protection: buka dengan login Vercel).

Perintah deploy ulang (dari ROOT):

```bash
vercel deploy --yes --build-env NEXT_PUBLIC_USE_FIXTURES=true
```

Di Git Bash tambahkan `export MSYS_NO_PATHCONV=1` sebelum memakai `vercel api /v9/...`.

### Env vars web (nama saja)

| Nama | Keterangan | Status |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_FIXTURES` | `true` selama API belum ada | Dikirim saat deploy (`--build-env`) |
| `NEXT_PUBLIC_API_URL` | URL service `api` di Railway | Belum |
| `NEXT_PUBLIC_SITE_URL` | URL publik situs (canonical, `og:image`) | Belum: gambar OG menunjuk `localhost` sampai diisi |
| `NEXT_PUBLIC_X_HANDLE` | Handle X tanpa `@` | Belum diberikan |
| `FIXTURE_PROOF` | `populated` untuk menguji data terisi (server) | Tidak diisi |

## Supabase, Railway

Belum dibuat. Menunggu perintah **"Deploy testnet"** (CLAUDE.md bagian 10b).
