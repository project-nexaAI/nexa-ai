# PROGRESS

## Tahap 0 — Setup (selesai kecuali blocker manusia)
- [x] `.claude/settings.json`, `.gitignore`, `.env.example`, hooks `.githooks/` (`core.hooksPath` aktif)
- [x] pnpm, gh, supabase, vercel, railway terpasang (login belum dicek: lihat BLOCKERS #1)
- [x] Foundry v1.8.7 terpasang di ~/.foundry/bin (tambahkan ke PATH)
- [x] Skill (8) & subagent (2)
- [x] `pnpm check:wallets`, `addresses/<network>.json`
- [x] Branch `testnet` & `mainnet` (lokal)
- [~] `chains.ts`: chain ID terverifikasi; alamat Pons/Chainlink/USDG/Uniswap masih `null` (BLOCKERS #6)

## Tahap 2 — RiskGuard + siklus prediksi
- [x] Siklus prediksi penuh (LLM mock -> draft terenkripsi -> commit -> RiskGuard -> persetujuan -> post dry +15 menit -> reveal -> skor) lolos di Anvil + Postgres (19 test worker)
- [ ] Telegram mode dry; endpoint `/proof`, `/predictions/:id`, `/rug-radar` + fixture (apps/api)
- [x] `@nexa-ai/riskguard`: 11 aturan brief, 95 test (ID & EN, evasi homoglyph/leet/spasi/zero-width), log hanya hash konten
- [x] `apps/worker`: antrian persetujuan (`enqueuePost`: RiskGuard -> cek commit -> antrian, tunda 15 menit) + CLI `review list|show|approve|reject`, 11 test integrasi Postgres
- [x] Red-team `riskguard-reviewer`: 96 test gagal -> 94 diperbaiki, 2 kebijakan dicatat; total 191 test RiskGuard lolos

## Tahap 1 — berjalan
- [x] `NexaLedger` + 24 test (unit + fuzz) lolos, `forge snapshot`, ABI di `packages/contracts-abi/abi/`
- [x] Vektor hash bersama `packages/shared/test-vectors/commit-reveal.json` (sisi Solidity)
- [x] Script deploy `contracts/script/DeployNexaLedger.s.sol` (belum dijalankan: butuh keystore + saldo)
- [x] Util hash TS (`computePredictionHash`) + Vitest memakai vektor yang sama (4 test lolos)
- [x] Deploy localhost (Anvil, alamat di addresses/localhost.json; agent = akun Anvil 1)
- [ ] Deploy testnet (butuh keystore deployer + saldo: BLOCKERS #2, #5)
- [x] Turborepo, docker-compose Postgres, `@nexa-ai/db` (Drizzle, 8 tabel, migrasi 0000 teruji di Postgres Docker)
- [ ] Indexer Envio (menunggu ABI + alamat Pons, BLOCKERS #6)

## HTML siap — integrasi desain (selesai)
- [x] `docs/html-design/mapping.md`: pemetaan bagian -> data/endpoint
- [x] `apps/web` (Next.js 15): 13 komponen dikonversi dari `nexa-1.html`, design tokens di `styles/tokens.css`, skrip gerak + three.js dipakai verbatim
- [x] `@nexa-ai/api-client`: skema zod + fixture (`docs/api/fixtures`) untuk `/proof`, `/predictions/:id`, `/rug-radar`, `/burn` (9 test)
- [x] Verifikasi Playwright (Edge, WebGL dimatikan untuk perbandingan): tata letak 12 section identik di desktop 1440 dan mobile 390; selisih piksel 0,015% / 0%
- [x] Pengikatan data (fixture terisi): hash contoh, "Day N of 7", gauge win rate
- [ ] TASK: endpoint `/rug-radar` -> kartu "Rug radar" dan "Pons V2 launches" masih ilustrasi statis
- [ ] TASK: halaman Burn tracker, detail prediksi, NEXA vs KOL (butuh desain, lihat BLOCKERS #10)
- [ ] TASK: `apps/api` (`/proof`, `/predictions/:id`) menggantikan fixture; lalu `NEXT_PUBLIC_USE_FIXTURES=false`

## Tahap 2 — selesai (backend)
- [x] `apps/worker/src/telegram.ts`: Notifier `DryTelegram`/`TelegramBot`, alert Pro saat post disetujui (CLI `review approve`); 3 test
- [x] `apps/api` (Fastify): `/proof`, `/predictions/:id`, `/rug-radar`, `/burn` (nol sampai BurnVault), `/healthz`, CORS `WEB_ORIGIN`, `docs/api/openapi.json` (diuji sinkron), 16 test
- [x] Migrasi `0001`: kolom data publik reveal (`revealed_text/asset/direction`); API tidak pernah mendekripsi preimage; draft tidak pernah terlihat publik
- [x] Terbukti end-to-end: web (`NEXT_PUBLIC_USE_FIXTURES=false`) -> API -> Postgres menampilkan hash dan "Day 4"
- [ ] Menunggu data: `/rug-radar` kosong sampai indexer Pons ada (BLOCKERS #7); tampilan web "Rug radar" masih ilustrasi
- [ ] Syarat selesai Tahap 2 terpenuhi (siklus prediksi penuh lolos). Berikutnya: Tahap 3 butuh perintah "Deploy testnet" dan keystore/saldo; Tahap 1 (indexer, deploy testnet) menunggu blocker #2, #5, #7

## Tahap 3 — DILEWATI atas permintaan pemilik proyek (31 Okt 2026)
Posting X selama 30 hari menunggu "Deploy testnet", keystore/saldo, dan izin X live. Dilanjutkan nanti.

## Tahap 4 — kontrak fee (selesai di sisi kode)
- [x] `CreatorFeeSplitter` (30/70), `ProtocolFeeSplitter` (20/80), `BurnVault`; 66 test Foundry (unit + fuzz + reentrancy + swapper jahat + timelock)
- [x] Tinjauan `contract-reviewer`: 4 temuan diperbaiki dengan test (renounceOwnership, setNexa, cek pasangan aset splitter, underflow), sisanya didokumentasikan
- [x] Script `DeployFees.s.sol`; ABI diekspor; dry run mainnet (tanpa broadcast): NexaLedger ~1,37M gas, fee ~2,01M gas
- [x] Paket audit `docs/audit/README.md`, checklist launch `docs/launch-checklist.md`
- [ ] Adaptor swapper Uniswap v4 (BLOCKERS #11); fork test dengan NVDA asli (#12); audit eksternal (#13)
- [ ] `/burn` terhubung ke event BurnVault (butuh indexer, BLOCKERS #7)
- 2026-10-31: `/burn` kini membaca tabel `burns` (event `Burned` BurnVault, migrasi 0002; total + daftar terbaru + link Blockscout), dengan test. `/rug-radar` sudah ada dan membaca `pons_tokens`. **Keduanya kosong sampai ada penulis datanya**: `burns` menunggu BurnVault ter-deploy + pembaca event; `pons_tokens` menunggu indexer Envio (BLOCKERS #7).
- 2026-10-31: Tahap 5 dimulai: `GET /signals` (header `x-api-key`, hash SHA-256 di tabel `api_keys`, batas 60 req/menit per kunci, 503 selama `PAID_FEATURES_ENABLED=false`), skema + fixture + openapi + `api-client.getSignals`, 5 test. Kunci dibuat dengan `pnpm --filter @nexa-ai/api keys:create "<label>"`. **Belum**: `/leaderboard` (butuh keputusan produk: sumber data KOL), `/ask` (butuh alamat USDG terverifikasi), SSE + Telegram Pro, SIWE.
- 2026-10-31: Alamat mainnet terverifikasi masuk `chains.ts` (Pons factory/hook/executor, Chainlink NVDA & ETH, USDG, PoolManager; NVDA 0xd0601CE1...). **Indexer Pons V2 dibuat** (`apps/indexer`, migrasi 0004: `pons_tokens.curve/pair_token`, tabel `indexer_state`): launch + trade + red flag creator tax, 5 test, diuji pada mainnet nyata (2 launch, 13 trade dari 1500 blok). `/rug-radar` kini punya penulis data. Menjalankan: `CHAIN_ENV=mainnet DATABASE_URL=... pnpm --filter @nexa-ai/indexer start`. **Belum**: graduation (butuh ABI, #7), holder concentration, deploy indexer ke Railway, sumber harga oracle untuk prediksi harian worker.
- 2026-10-31: Pembaca oracle untuk prediksi harian (`apps/worker/src/oracle.ts`): membaca feed Chainlink NVDA/USD dan ETH/USD mainnet, harga terformat tanpa float, membuang feed basi (>3 hari)/nol/gagal baca; 4 test + diuji pada feed nyata (NVDA $205.28, ETH $2236.56). Mengisi `PredictionCandidate` untuk `generatePredictionDraft`. **Belum disambungkan ke loop harian `main.ts`** (butuh `LLM_API_KEY` dan NexaLedger ter-deploy; feed harus terdaftar di ledger lewat `setFeed`).
- 2026-10-31: `POST /ask` (Tahap 5) dibuat: pembayaran USDG diverifikasi on-chain (receipt sukses, `Transfer` dari kontrak USDG asli ke penerima, nilai >= `ASK_PRICE_USDG_MICROS`) SEBELUM analisis; tx_hash unik di tabel `ask_payments` (migrasi 0005, anti replay, 409). Laporan hanya dari data indexer (red flag, pajak, jumlah trade, daftar "tidak tahu"); token < 1 jam atau tanpa data = 422 dan pembayaran tidak dihabiskan. Di belakang `PAID_FEATURES_ENABLED` (503 bila mati atau penerima belum diisi). Skema + fixture + openapi + `api-client.ask`, 5 test baru, test OpenAPI kini memeriksa semua metode. **Belum:** analisis LLM (butuh `LLM_API_KEY`), konsentrasi holder, migrasi 0005 belum diterapkan ke Supabase (terapkan saat PR berikutnya digabung), `ASK_PAYMENT_RECIPIENT`/`TREASURY_ADDRESS` belum diisi di Railway, aturan "kredit gratis holder $NEXA" (menunggu SIWE + `HOLDER_THRESHOLD`).
- 2026-10-31: `GET /leaderboard` (NEXA vs KOL) dibuat: tabel `kol_accounts`/`kol_calls` (migrasi 0006), `scoreCall` bersama (packages/shared, aturan identik NexaLedger), CLI `kol` (add-kol, add-call, score), skema + fixture + openapi + `api-client.getLeaderboard`; 9 test shared, 30 test API (leaderboard + CORS), 4 test KOL. CORS `WEB_ORIGIN` multi-asal (koma). **Belum:** migrasi 0005 dan 0006 diterapkan ke Supabase testnet; `WEB_ORIGIN` Railway diisi dua asal (menunggu kode ini ada di branch testnet); tampilan web leaderboard (menunggu HTML); pencatatan call KOL otomatis.
- 2026-10-31: 6 halaman dalam web dibuat dan diintegrasikan ke landing (lihat DECISIONS dan mapping.md): `/proof`, `/predictions/[id]`, `/rug-radar`, `/leaderboard`, `/burn`, `/ask` + bagian "Dashboards" di landing, tautan nav/footer. Build lolos; 6 halaman diperiksa dengan screenshot Playwright di 1440px dan 390px (tanpa overflow horizontal, menu mobile berfungsi). **Belum:** halaman Pro/Signals/Sponsored, `/privacy` dan terms (butuh teks pemilik), env `NEXT_PUBLIC_ASK_PAYMENT_ADDRESS` di Vercel.
- 2026-10-31: **Loop prediksi harian disambungkan ke worker** (`daily.ts` + `main.ts`): oracle -> LLM -> RiskGuard -> commit -> antrian, satu per hari UTC, idempoten, dibatasi percobaan; 6 test baru. Aktif otomatis bila `AGENT_PRIVATE_KEY`, `PREIMAGE_KEY`, `NEXA_LEDGER_ADDRESS`, `LLM_API_KEY`, dan `PREDICTION_ASSETS` (atau CHAIN_ID=4663) ada; log worker menyebut alasan bila nonaktif. **Syarat sebelum jalan di testnet:** NexaLedger ter-deploy, aset + feed mock didaftarkan (`setFeed`), saldo gas agent, kunci diisi di Railway.
- 2026-10-31: **NexaLedger ter-deploy di testnet 46630** (`0xEF1fBbd8ea7dC858Dc88332AcD43Ba58b9bD81C0`), diverifikasi on-chain; `addresses/testnet.json` dan `NEXA_LEDGER_ADDRESS` (Railway worker) terisi. Script `DeployTestnetMocks.s.sol` (feed + aset tiruan, simulasi sukses) menunggu dijalankan pemilik (BLOCKERS #22). Sisa sebelum prediksi harian testnet menyala: mock feed, saldo gas agent, `AGENT_PRIVATE_KEY`, `PREIMAGE_KEY`.
- 2026-10-31: Feed tiruan testnet ter-deploy dan terdaftar di NexaLedger (diverifikasi on-chain; alamat di `addresses/testnet.json`). Sisa prediksi harian testnet: saldo gas agent, `AGENT_PRIVATE_KEY`, `PREIMAGE_KEY`, dan mekanisme `push` harga (keeper).
- 2026-10-31: **Login wallet (SIWE) + benefit holder $NEXA** dibuat: 4 endpoint auth + `/ask` dengan kredit gratis, tabel `auth_nonces`/`auth_sessions`/`ask_credit_uses` (migrasi 0007), skema + fixture + openapi + `api-client` (`getNonce/verify/me/logout`, `ask(req, token)`), halaman web `/account` + tombol kredit gratis di `/ask`. 8 test auth baru (alur penuh, replay nonce, domain/tanda tangan/pesan basi, sesi kedaluwarsa, ambang holder, saldo tak terbaca, kredit bulanan); 38 test API lulus. Diuji end-to-end di browser dengan wallet palsu (tanda tangan SIWE sungguhan): login, bertahan setelah reload, logout. Bug ditemukan dan diperbaiki: nonce base64url bisa berisi `-`/`_` (dilarang EIP-4361). **Belum:** migrasi 0007 ke Supabase; alert Pro lebih cepat (alert stream belum ada); langganan Pro; `NEXA_TOKEN_ADDRESS`/`HOLDER_THRESHOLD` (menunggu launch dan keputusan final Tahap 5).
- 2026-10-31: Navbar diubah sesuai permintaan: connect wallet (SIWE) langsung di navbar (`WalletButton`, panel status di bawah tombol), ikon X bulat di kirinya, semua halaman di navbar, halaman `/account` dihapus, Privacy dihapus dari footer. Diperiksa dengan Playwright di 1440/1200/1150/1100/390/360/320px (tanpa overflow, menu mobile berisi 8 tautan, login wallet palsu: tampil, bertahan setelah reload, sign out). Perlu build ulang Vercel (variabel `NEXT_PUBLIC_API_URL` harus ada saat build agar tombol wallet menghubungi API).
- 2026-10-31: **Keeper harga testnet** dibuat (`keeper.ts`, 6 test, tersambung di `main.ts`; diuji terhadap mainnet dan testnet nyata dengan wallet tanpa saldo: membaca kedua sisi dan memutuskan push dengan benar). Aktif otomatis bila `KEEPER_PRIVATE_KEY` ada. Menunggu wallet keeper dari pemilik (BLOCKERS #23).
- 2026-10-31: **Indexer diperluas** (migrasi 0008 `token_holders`): graduation Pons (ABI dipulihkan dari chain), konsentrasi holder + red flag "Holders concentrated" (mengisi `topHolderShareBps` di `/rug-radar`), transfer whale (NVDA), dan pembaca event BurnVault (`/burn`). Semua tulis dalam satu transaksi dengan kursor. 15 test indexer (kasus: curve tidak dihitung, delta antar chunk, flag hilang saat menjual, riwayat tidak lengkap, whale, idempoten, burn). Diuji pada mainnet nyata: token DODO graduation terdeteksi, 153 holder, top holder 8,16%. **Belum:** `BURN_VAULT_ADDRESS` (BurnVault belum di-deploy), endpoint publik untuk transfer whale, redeploy indexer Railway.
