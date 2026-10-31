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

Deploy preview pertama (tanpa API; data dari fixture): `https://nexa-ai-82vl300k6-fauzanbayu123-1072s-projects.vercel.app`
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

## Supabase (testnet)

| Item | Nilai |
| --- | --- |
| Organisasi | `project-nexaai` (Free) |
| Project | `nexa-ai-testnet`, ref `kdqjhsttlkihdhmrolvi` (dibuat manual oleh pemilik di dashboard, 2026-10-31) |
| Region | `us-east-1` (N. Virginia). Berbeda dari rencana awal (Singapura), lihat DECISIONS |
| Koneksi | **Session pooler**, `aws-0-us-east-1.pooler.supabase.com:5432`, user `postgres.<ref>`. Direct (`db.<ref>.supabase.co`) hanya IPv6 dan tidak terjangkau dari lokal |
| Kredensial | `~/.config/nexa-ai/supabase-testnet.env` (di luar repo; berisi `DATABASE_URL`). Tidak pernah ditampilkan |
| Migrasi | Drizzle 0000, 0001 sudah dijalankan (9 tabel). Tabel pg-boss dibuat worker saat pertama jalan |

## Railway (testnet)

| Item | Nilai |
| --- | --- |
| Project | `nexa-ai-testnet` (id `a3cb031c-a7d1-40e4-a883-318be3bda766`), environment `production`, workspace `bayusmd's Projects` |
| Service | `worker`, `api` dari repo `project-nexaAI/nexa-ai`, branch `testnet`. Region `iad` (US East). Indexer belum ada (menunggu ABI Pons) |
| Build / start | `pnpm install --frozen-lockfile` / `pnpm --filter @nexa-ai/<worker\|api> start` (healthcheck api `/healthz`). Juga ada di `apps/*/railway.json` |
| Variabel (nama) worker | `DATABASE_URL`, `RPC_URL`, `CHAIN_ID`, `CHAIN_ENV`, `X_POST_MODE=dry`, `AGENT_ADDRESS`, `TREASURY_ADDRESS`, `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL_SMALL`, `LLM_MODEL_LARGE`, `PAID_FEATURES_ENABLED=false` |
| Variabel (nama) api | `DATABASE_URL`, `EXPLORER_URL`, `PAID_FEATURES_ENABLED=false` |
| Diisi manusia | `AGENT_PRIVATE_KEY`, `LLM_API_KEY`, `PREIMAGE_KEY` (worker); `NEXA_LEDGER_ADDRESS` setelah deploy #17; `WEB_ORIGIN` (api) |
