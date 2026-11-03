# NEXA (nexa-ai) — Laporan Proyek

Tanggal: 3 November 2026 · Repo: https://github.com/project-nexaAI/nexa-ai · Situs: https://nexaagent.tech

NEXA adalah "superintelligence influencer" di Robinhood Chain: agent AI di X yang membaca aktivitas chain, menerbitkan analisis, dan mencatat setiap prediksi on-chain (commit-reveal) sebelum diposting. Sumber kebenaran: `docs/NEXA-Developer-Brief.md`.

## 1. Ringkasan status

| Area | Status |
| --- | --- |
| Backend (worker, API, indexer) | Berjalan di Railway **mainnet** (chain 4663), database Supabase mainnet |
| Web (`apps/web`, Next.js) | Tayang di `nexaagent.tech` (Vercel), memakai API mainnet |
| Kontrak `NexaLedger` | Ter-deploy di **testnet** 46630. **Mainnet belum** (menunggu saldo ETH deployer) |
| Kontrak fee (`CreatorFeeSplitter`, `ProtocolFeeSplitter`, `BurnVault`) | Selesai + teruji; belum di-deploy (menunggu audit dan launch $NEXA) |
| Posting X | Mode `dry` di mainnet. Uji `live` testnet (batas 2 post) sudah selesai dan berhasil |
| Fitur berbayar (Pro, Ask NEXA, Signals) | Menyala di mainnet atas perintah pemilik; pembayaran USDG nyata belum diuji |
| Halaman NEXA vs KOL | "Coming soon" (belum ada KOL yang sesuai) |
| Audit eksternal, launch $NEXA di Pons V2 | Belum (dilakukan pihak luar / manusia) |

## 2. Yang sudah dibangun

**Kontrak (Foundry, `contracts/`)**
- `NexaLedger`: `commit(hash)`, `reveal()`, skor otomatis dari harga Chainlink. Hash `keccak256(abi.encode(text, asset, direction, horizon, salt))`, vektor uji dipakai bersama Solidity dan TypeScript.
- `CreatorFeeSplitter` (30% BurnVault / 70% treasury) dan `ProtocolFeeSplitter` (20% / 80%), rasio `constant`; `BurnVault` tanpa jalan menarik dana. Tinjauan `contract-reviewer` menghasilkan 4 perbaikan dengan test.
- Test: unit + fuzz + reentrancy; ABI diekspor ke `packages/contracts-abi`.

**RiskGuard (`packages/riskguard`)** — filter berbasis kode, bukan AI: 11 aturan brief (ajakan beli/jual, target harga, $NEXA, sponsor, token < 1 jam, tautan, dll.), tahan evasi homoglyph/leet/spasi. Red-team dengan teks adversarial; ratusan test (ID & EN).

**Worker (`apps/worker`)** — alur: data → LLM (Xiaomi MiMo lewat adapter) → RiskGuard → commit on-chain → antrian persetujuan → post (jeda 15 menit dari alert Pro) → reveal → skor. Termasuk: prediksi harian, ringkasan Stock Token (harga oracle + selisih DEX vs oracle), laporan Pons, balasan mention, konten sponsor, CLI persetujuan, alert Telegram Pro, keeper harga (testnet), pencatatan token dan biaya LLM.

**Indexer (`apps/indexer`)** — event Pons V2 (launch, trade, graduation), red flag (creator tax, konsentrasi holder), transfer whale, event BurnVault.

**API (`apps/api`, Fastify + zod + OpenAPI)** — `/proof`, `/predictions/:id`, `/rug-radar`, `/burn`, `/leaderboard`, `/signals`, `/signals/whales`, `/ask` (verifikasi pembayaran USDG on-chain sebelum analisis), login wallet SIWE, NEXA Pro (`/pro/*`, `/alerts/stream` SSE), `/healthz`. Setiap endpoint punya skema, fixture (`docs/api/fixtures`), entri `openapi.json`, dan klien di `packages/api-client`.

**Web (`apps/web`)** — landing dari desain desainer, halaman Proof of Intelligence, detail prediksi, Rug radar, Burn tracker, NEXA vs KOL (Coming soon), Ask NEXA, Pro, Signals, Sponsored, connect wallet di navbar.

## 3. Infrastruktur mainnet

- **Supabase** `nexa-ai-mainnet` (database); testnet diarsipkan, datanya sudah dipindah ke mainnet.
- **Railway** `nexa-ai-mainnet`: service `worker`, `api` (`https://api-production-79c7.up.railway.app`), `indexer`. Deploy dipicu manual.
- **Vercel**: web di `nexaagent.tech` (domain Hostinger), variabel `NEXT_PUBLIC_API_URL` mengarah ke API mainnet.
- Rahasia (kunci X, LLM, Telegram, password database) hanya ada di Railway dan file lokal di luar repo; tidak ada di GitHub.

## 4. Alamat publik

| Item | Alamat |
| --- | --- |
| Deployer | `0x1f4cD14B5CDD15436950d626CBCb0e21084F462D` |
| Agent (commit/reveal) | `0x35Ca52DAd343a80A3Be6b09091B74Dd3e5864561` |
| Treasury | `0xb71e729b85908195B77Bd927554e8FC8dfF8CE84` |
| `NexaLedger` testnet (46630) | `0xEF1fBbd8ea7dC858Dc88332AcD43Ba58b9bD81C0` |
| Deploy tx testnet | `0x317fca74f2489444ded16aa7242f5bfd5be078613069455f719dd2f40838e54d` (blok 146.003.332) |
| USDG mainnet | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| NVDA Stock Token mainnet | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` |
| Pons V2 factory | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` |

## 5. Deploy NexaLedger mainnet — ditunda

Dry run (tanpa broadcast) sudah dilakukan: gas ≈ 1,34 juta, biaya ≈ 0,0000537 ETH. Deploy sungguhan **menunggu saldo ETH** di deployer (~0,001 ETH) dan agent (~0,001 ETH) di Robinhood Chain mainnet, lalu pemilik menjalankan perintah deploy sendiri (butuh password keystore). Langkah lengkap ada di `docs/BLOCKERS.md`. Sesuai permintaan, bagian ini dikerjakan **setelah laporan ini**.

Setelah ledger ter-deploy: isi `NEXA_LEDGER_ADDRESS` dan `addresses/mainnet.json`, daftarkan feed NVDA/ETH (`setFeed`), isi `AGENT_PRIVATE_KEY` dan `PREIMAGE_KEY` di Railway (oleh pemilik), lalu catat hash tx dan nomor blok untuk dikirim ke head dev.

## 6. Keputusan penting (rinci di `docs/DECISIONS.md`)

- Aset pasangan $NEXA: NVDA (diputuskan). LLM: Xiaomi MiMo. Bahasa post: Inggris.
- Harga awal prediksi: `roundId` Chainlink awal dan akhir dikirim saat reveal **[di luar brief]**.
- Mainnet memakai `APPROVAL_MODE=risky` (menyimpang dari brief: human-in-the-loop 30 hari) dan fitur berbayar dinyalakan lebih awal (menyimpang dari default `PAID_FEATURES_ENABLED=false`), keduanya atas arahan pemilik dan dapat dimatikan lewat variabel.
- Cek hukum/OJK dilewati atas keputusan pemilik; risiko tercatat.

## 7. Risiko dan hal yang belum selesai

1. **Posting X mainnet belum live**: butuh izin eksplisit (batas 4 post).
2. **Commit/reveal mainnet nonaktif** sampai ledger ter-deploy dan kunci agent diisi.
3. **Audit eksternal** `NexaLedger` dan splitter belum dilakukan (paket di `docs/audit/README.md`); wajib sebelum launch.
4. **Adaptor swap Uniswap v4** untuk `BurnVault` belum ada (menunggu alamat $NEXA) dan fork test NVDA nyata belum dijalankan.
5. **Kredit Railway** hampir habis (percobaan, ±$4,32 / 19 hari); perlu upgrade paket agar layanan tidak berhenti.
6. **Pembayaran USDG nyata** (Pro $19, Ask $1) dan login wallet di mainnet belum diuji end-to-end.
7. **Cek hukum (OJK)** belum tertulis, padahal fitur berbayar menyala.
8. Halaman Privacy/Terms menunggu teks dari pemilik; NEXA vs KOL menunggu keputusan KOL.
9. Branch `testnet`/`mainnet` belum menerima commit dokumentasi terbaru di `main` (tidak memengaruhi aplikasi).

## 8. Langkah berikutnya

1. Isi saldo deployer dan agent → deploy `NexaLedger` mainnet → catat alamat dan tx.
2. Isi kunci agent dan `PREIMAGE_KEY` di Railway → aktifkan commit prediksi harian mainnet.
3. Beri izin `live` (batas 4) untuk uji X + Telegram publik, atau nyalakan pulse dalam mode dry dulu.
4. Upgrade Railway; uji login wallet dan pembayaran USDG.
5. Audit eksternal → checklist launch (`docs/launch-checklist.md`) → launch $NEXA di Pons V2 oleh manusia.
