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
| Status | `worker` dan `api` Online (2026-10-31). Worker: commit/reveal NONAKTIF sampai `AGENT_PRIVATE_KEY`, `NEXA_LEDGER_ADDRESS`, `PREIMAGE_KEY` diisi. Domain publik belum dibuat |
| Build / start | `pnpm install --frozen-lockfile` / `pnpm --filter @nexa-ai/<worker\|api> start` (healthcheck api `/healthz`). Diatur lewat API Railway (`serviceInstanceUpdate`); `apps/*/railway.json` tidak terbaca karena service berakar di root repo |
| Variabel (nama) worker | `DATABASE_URL`, `RPC_URL`, `CHAIN_ID`, `CHAIN_ENV`, `X_POST_MODE=dry`, `AGENT_ADDRESS`, `TREASURY_ADDRESS`, `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL_SMALL`, `LLM_MODEL_LARGE`, `PAID_FEATURES_ENABLED=false` |
| Variabel (nama) api | `DATABASE_URL`, `EXPLORER_URL`, `TOKEN_EXPLORER_URL`, `PAID_FEATURES_ENABLED=false` |
| Diisi manusia | `AGENT_PRIVATE_KEY`, `LLM_API_KEY`, `PREIMAGE_KEY` (worker); `NEXA_LEDGER_ADDRESS` setelah deploy #17; `WEB_ORIGIN` (api) |

- API publik testnet: https://api-production-bf46.up.railway.app (domain Railway dibuat 2026-10-31). `/healthz`, `/proof`, `/burn`, `/rug-radar` = 200 (data kosong); `/signals` = 404 sampai PR main -> testnet digabung. Variabel `WEB_ORIGIN` (CORS) belum diisi di service api.
- 2026-10-31: service `indexer` dibuat di Railway (repo project-nexaAI/nexa-ai, branch testnet; build `pnpm install --frozen-lockfile`, start `pnpm --filter @nexa-ai/indexer start`). Variabel: DATABASE_URL (Session pooler Supabase, tidak ditampilkan), CHAIN_ENV=mainnet, HIGH_CREATOR_TAX_BPS=500, INDEXER_POLL_SECONDS=5; RPC_URL memakai bawaan mainnet. Membaca mainnet (read-only), menulis ke DB testnet. `api` kini punya WEB_ORIGIN = URL branch testnet Vercel. Migrasi 0004 sudah diterapkan ke Supabase testnet. Status deploy: antre (trial).

**Variabel worker untuk posting X (nama saja, nilai diisi pemilik di dashboard):** `X_POST_MODE`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `X_LIVE_POST_CAP`, `POST_INTERVAL_MINUTES`, `X_POST_KINDS`, `APPROVAL_MODE`.

## Supabase (mainnet)

| Item | Nilai |
| --- | --- |
| Project | `nexa-ai-mainnet`, ref `mjautadlenhckogsvkfw` (dibuat 2026-11-03 atas perintah "Siapkan mainnet") |
| Region | `us-east-1`, sama dengan testnet |
| Koneksi | Session pooler `aws-0-us-east-1.pooler.supabase.com:5432` |
| Kredensial | `~/.config/nexa-ai/supabase-mainnet.env` (di luar repo, `chmod 600`, password acak, tidak pernah ditampilkan) |
| Migrasi | Drizzle sudah dijalankan (2026-11-03). Tabel pg-boss dibuat worker saat pertama jalan |

Branch `mainnet` di GitHub dibuat dari `main` (2026-11-03).

## Railway (mainnet)

| Item | Nilai |
| --- | --- |
| Project | `nexa-ai-mainnet` (id `22907aae-7708-4f4e-9a56-651dc532a7be`, env `production` `cf0a6d22-5abe-4084-ac06-81b098e88731`), dibuat 2026-11-03. Project lama `graceful-victory` (service `blog-cms`) dihapus atas perintah pemilik untuk membebaskan batas paket gratis |
| Service | `worker` (f521380a-9268-4313-9055-8b9aeef36733, belum dijalankan), `api` (a227c978-95b8-4144-b37d-3fc443a36cef, Online), `indexer` (2563ab00-7b71-439f-8f5c-14ea76fa5d9a, Online); repo `project-nexaAI/nexa-ai`, branch `mainnet`. API publik mainnet: https://api-production-79c7.up.railway.app |
| Status | Deploy awal `FAILED` (belum ada kunci; sengaja tidak dijalankan sampai perintah pemilik) |
| Variabel (nama) worker | `DATABASE_URL`, `CHAIN_ENV=mainnet`, `CHAIN_ID=4663`, `RPC_URL`, `AGENT_ADDRESS`, `TREASURY_ADDRESS`, `LLM_*` (tanpa key), `PAID_FEATURES_ENABLED=false`, `X_POST_MODE=dry`, `X_LIVE_POST_CAP=4`, `X_POST_KINDS=pulse`, `POST_INTERVAL_MINUTES=30`, `APPROVAL_MODE=risky`, `PULSE_ENABLED=false`, `PULSE_INTERVAL_MINUTES=30` |
| Variabel (nama) api | `DATABASE_URL`, `EXPLORER_URL`, `TOKEN_EXPLORER_URL`, `PAID_FEATURES_ENABLED=false`, `PRO_PRICE_USDG_MICROS=19000000`, `PAYMENT_CHAIN_ID=4663`, `TREASURY_ADDRESS`, `WEB_ORIGIN=https://nexaagent.tech` |
| Diisi manusia | worker: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `LLM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_PRO_CHAT_ID`; api: `TELEGRAM_BOT_USERNAME` |

### Pindah ke mainnet (2026-11-03, arahan head dev "gass ke mainnet semua")
Data indexer (token Pons, trade, holder, whale, snapshot harga, cursor) dan 3 akun KOL disalin dari Supabase testnet ke mainnet (jumlah baris cocok). Data khusus testnet (post, prediksi, pembayaran, sesi) tidak disalin; Supabase testnet dibiarkan sebagai arsip. Worker testnet dihapus, indexer testnet dihentikan; API testnet masih melayani situs sampai `NEXT_PUBLIC_API_URL` di Vercel dipindah ke API mainnet.
