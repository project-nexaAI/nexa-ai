# PROMPT — NEXA (Neural EXecution Agent) · Backend First

Kamu adalah **lead backend engineer** proyek **NEXA** (slug: `nexa-ai`). Folder tempat Claude Code dijalankan adalah root proyek (`ROOT` = `nexa-ai/`). Semua perintah bash wajib diberi komentar direktori, contoh: `# Jalankan di: ROOT/contracts`.

**Sumber kebenaran: `docs/NEXA-Developer-Brief.md` (22 Okt 2026, @ronald).** Seluruh isi file ini diturunkan dari brief. Aturannya:

- Jika file ini dan brief berbeda, **ikuti brief**, catat perbedaannya di `docs/DECISIONS.md`, lalu lanjutkan.
- Pilihan teknis yang tidak disebut brief ditandai **[di luar brief]**. Boleh diganti jika tim memutuskan lain, dan setiap penggantian dicatat di `docs/DECISIONS.md`.
- Jangan menambah fitur produk yang tidak ada di brief.

Jalankan pengembangan **berurutan mengikuti roadmap brief (bagian 12) tanpa menunggu konfirmasi di antara langkah**. Berhenti hanya untuk hal yang wajib dilakukan manusia (bagian 13). Langsung mulai setelah saya mengetik **"Mulai"**.

---

## 1. Ringkasan produk (dari brief)

NEXA adalah **"superintelligence influencer" pertama di Robinhood Chain**: AI agent di X yang membaca seluruh aktivitas chain 24/7, menerbitkan analisis, dan membuktikan setiap prediksinya on-chain sebelum diposting.

- **Tagline:** *"The superintelligence influencer. Every call on-chain. No deleted tweets."*
- **Prinsip:** "superintelligence" adalah persona. Kecerdasannya dibuktikan dengan data, bukan klaim.
- **Fitur inti, Proof of Intelligence:** setiap prediksi di-hash dan dicatat di `NexaLedger` sebelum diposting, lalu dinilai otomatis dengan harga oracle saat jatuh tempo. Win rate tidak bisa dipalsukan atau dihapus.
- **Target user:** trader Robinhood Chain yang butuh sinyal cepat, serta komunitas dan proyek yang ingin riset independen.

**Kegiatan harian NEXA:**

1. Ringkasan pergerakan Stock Token terbesar dan selisih harga DEX vs oracle Chainlink.
2. Launch dan graduation token Pons V2 paling ramai, plus red flag (creator tax tinggi, holder terkonsentrasi).
3. Jawab mention "@nexa analisis kontrak 0x…" dengan ringkasan risiko.
4. Satu **Prediction of the Day** yang di-commit on-chain dan dinilai 7 hari kemudian.

---

## 2. Status desain: BACKEND DULU

HTML, logo, dan aset brand **belum diberikan**. Brief menetapkan Next.js untuk web, tetapi web dibuat **setelah HTML dari desainer tersedia**.

- **Jangan** membuat UI, halaman Next.js, CSS, logo, favicon, ilustrasi, atau warna brand.
- **Jangan** membuat `apps/web` sebelum saya mengetik **"HTML siap"** (bagian 8).
- Halaman web di brief (Proof of Intelligence, NEXA vs KOL, Rug radar, Burn tracker) disiapkan sebagai **endpoint API + skema data + fixture JSON**, supaya saat HTML datang pekerjaannya tinggal menyambungkan data (bagian 8).

---

## 3. Data tetap

| Item | Nilai |
| --- | --- |
| Repo GitHub | https://github.com/project-nexaAI/nexa-ai (remote `origin`, sudah ada; jangan membuat repo baru) |
| Root folder | `nexa-ai/` |
| Scope package | `@nexa-ai/*` |
| Testnet NexaLedger (brief) | Robinhood Chain Testnet, chain ID **46630** |
| Wallet deployer | **`0x1f4cD14B5CDD15436950d626CBCb0e21084F462D`**. Jangan tanyakan lagi. Pakai di semua script, config, dan dokumentasi: `DEPLOYER_ADDRESS=0x1f4cD14B5CDD15436950d626CBCb0e21084F462D` di `.env.example` (alamat publik, aman di-commit) dan field `deployer` di `packages/contracts-abi/addresses/<network>.json`. Keystore Foundry bernama `deployer`: `cast wallet address --account deployer` **harus** menghasilkan alamat ini; jika tidak cocok, berhenti dan catat di `BLOCKERS.md`, jangan deploy dengan alamat lain |
| Wallet agent | **Hot wallet, terpisah dari deployer dan treasury.** Key-nya hanya ada di server worker (diisi manusia di dashboard Railway). Tugasnya **hanya** memanggil `NexaLedger.commit()` dan `reveal()`. Saldo: sedikit ETH untuk gas, tidak lebih. Tidak boleh menjadi owner kontrak apa pun dan tidak boleh menerima fee. Keystore Foundry: `nexa-agent`. **Alamat diisi manual oleh saya** di `.env` → `AGENT_ADDRESS` (panduan: `docs/SETUP-WALLETS.md`). Jangan tanyakan alamatnya; baca dari `.env`. Jika kosong saat dibutuhkan, catat di `BLOCKERS.md` dan lanjutkan dengan alamat Anvil di localhost |
| Wallet treasury | **Akun MetaMask biasa (tidak wajib multisig), dengan seed phrase terpisah.** Menerima 70% creator fee dan 80% protocol fee untuk biaya AI, X API, dan operasional. **Hanya menerima dana**: backend tidak pernah mengirim transaksi dari treasury, dan penggunaan dana dilakukan manual oleh pemiliknya lewat MetaMask. **Private key treasury tidak boleh masuk ke backend dalam bentuk apa pun** (repo, `.env`, Railway, Supabase, Foundry keystore, log, atau `docs/`). Claude Code hanya memakai **alamat publiknya** sebagai parameter kontrak/config (`TREASURY_ADDRESS`). Jika ada task yang tampak membutuhkan private key treasury, berhenti dan catat di `BLOCKERS.md`. **Alamat diisi manual oleh saya** di `.env` → `TREASURY_ADDRESS` (panduan: `docs/SETUP-WALLETS.md`). Jangan tanyakan alamatnya; baca dari `.env` |

---

## 4. Chain & alamat

Data jaringan di bawah **bukan dari brief** (kecuali chain ID testnet). Verifikasi dengan `cast chain-id` dan dokumen resmi saat Tahap 0.

|           | Testnet                                      | Mainnet                                 |
| --------- | -------------------------------------------- | --------------------------------------- |
| Chain ID  | 46630 (brief)                                | 4663 (verifikasi)                       |
| RPC       | https://rpc.testnet.chain.robinhood.com      | https://rpc.mainnet.chain.robinhood.com |
| Explorer  | https://explorer.testnet.chain.robinhood.com | https://robinhoodchain.blockscout.com   |
| Faucet    | https://faucet.testnet.chain.robinhood.com   | —                                       |
| Gas token | ETH                                          | ETH                                     |

Wajib diverifikasi sebelum dipakai (tulis di `packages/shared/src/chains.ts` beserta sumbernya; jangan menebak alamat):

- **Pons V2** (factory, hook, graduation executor). Brief merujuk Bitquery, contoh factory `0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e`. Brief mewajibkan verifikasi ulang ke dokumen resmi Pons sebelum produksi.
- **Chainlink Data Feeds** untuk Stock Token (minimal NVDA) dan ETH. Jika tidak ada di testnet, pakai mock aggregator dan catat di `docs/BLOCKERS.md`.
- **USDG** untuk pembayaran Ask NEXA.
- **Uniswap v4** (tempat pool $NEXA setelah graduation), dibutuhkan BurnVault untuk membeli $NEXA.

---

## 5. Stack

| Bagian | Brief | Implementasi |
| --- | --- | --- |
| Worker | TypeScript worker (viem) di server | Node ≥ 22, TypeScript strict |
| Database | Postgres untuk antrian dan log | Postgres: Docker di lokal, Supabase di testnet/mainnet **[di luar brief]**; migrasi Drizzle **[di luar brief]**; antrian pg-boss **[di luar brief]** |
| Hosting backend | TypeScript worker di server | Railway: `worker`, `indexer`, `api` **[di luar brief]** |
| Hosting web | — | Vercel untuk `apps/web` (setelah HTML ada) **[di luar brief]** |
| Kontrak | Foundry untuk `NexaLedger` | Foundry + OpenZeppelin |
| Indexer | Envio HyperSync + event Pons V2 | Envio |
| Oracle | Chainlink Data Feeds | `AggregatorV3Interface` |
| Otak | LLM API + tool calling | **Xiaomi MiMo** (API kompatibel OpenAI, base URL `https://api.xiaomimimo.com/v1`). Model kecil untuk post rutin: `mimo-v2-flash`; model besar untuk Pro & Ask NEXA: `mimo-v2.5-pro`. Verifikasi nama model dan dukungan tool calling di dokumentasi resmi (https://platform.xiaomimimo.com) saat Tahap 2. MiMo mendukung JSON mode tetapi bukan `json_schema` native, jadi setiap output terstruktur divalidasi dengan zod dan di-retry jika gagal. Tetap lewat adapter, supaya penyedia bisa diganti lewat env |
| Publikasi | X API + web dashboard; Telegram untuk alert Pro & kanal cadangan | X API v2 pay-per-use, Telegram Bot API |
| Web | Next.js | **Menunggu HTML** |
| HTTP API | — | Fastify + zod + OpenAPI **[di luar brief]** |
| Monorepo | — | pnpm workspaces + Turborepo **[di luar brief]** |
| Test | — | Vitest, `forge test` (unit + fuzz) |

Worker dan indexer berjalan 24/7, jadi keduanya di-host sebagai proses long-running di Railway, bukan serverless (Vercel/Supabase Edge Functions tidak dipakai untuk worker). Detail infrastruktur ada di bagian 10b.

```
nexa-ai/                       # ROOT
├── CLAUDE.md
├── .claude/
│   ├── settings.json
│   ├── skills/                # skill proyek (bagian 6)
│   └── agents/                # subagent reviewer (bagian 7)
├── contracts/                 # NexaLedger, CreatorFeeSplitter, BurnVault
├── apps/
│   ├── indexer/               # Envio: Pons V2, whale transfer, harga Stock Token
│   ├── worker/                # data → AI → RiskGuard → commit → antrian → post → reveal
│   │   └── prompts/           # persona "superintelligence" & template post
│   ├── api/                   # endpoint untuk web & produk berbayar
│   └── web/                   # BELUM DIBUAT — menunggu HTML
├── packages/
│   ├── shared/                # tipe, config, chains.ts, util hash commit-reveal
│   ├── riskguard/             # filter konten berbasis kode (BUKAN AI)
│   ├── db/                    # skema + migrasi
│   ├── contracts-abi/         # ABI + alamat per network
│   └── api-client/            # typed client + fixture untuk frontend
├── docs/                      # di ROOT, sejajar dengan apps/ dan packages/
│   ├── NEXA-Developer-Brief.md
│   ├── PROGRESS.md
│   ├── BLOCKERS.md
│   ├── DECISIONS.md
│   ├── infrastructure.md
│   ├── SETUP-WALLETS.md       # panduan manual wallet (untuk manusia)
│   ├── api/
│   │   ├── openapi.json
│   │   └── fixtures/
│   └── html-design/           # HTML dari desainer
├── docker-compose.yml
└── .env.example
```

| Environment | Branch | Database | Backend | Web | Chain | Posting X |
| --- | --- | --- | --- | --- | --- | --- |
| localhost | `main` | Postgres Docker | `pnpm dev` | — | Anvil fork testnet (31337) | `X_POST_MODE=dry` (hanya log) |
| testnet | `testnet` | Supabase `nexa-ai-testnet` | Railway `nexa-ai-testnet` | Vercel (nanti) | Robinhood Chain Testnet 46630 | `dry`, atau `live` setelah saya izinkan |
| mainnet | `mainnet` | Supabase `nexa-ai-mainnet` (disiapkan) | Railway `nexa-ai-mainnet` (disiapkan, service mati) | Vercel production (nanti) | Robinhood Chain: dry run saja | `live` hanya dengan persetujuan saya |

---

## 6. Skill Claude Code

Buat di Tahap 0, di `.claude/skills/<nama>/SKILL.md`:

```markdown
---
name: <nama-skill>
description: <satu kalimat: kapan skill ini dipakai>
---
<langkah, file yang disentuh, perintah dengan komentar direktori, checklist selesai, rujukan ke bagian brief>
```

| Skill | Dipakai saat | Isi utama |
| --- | --- | --- |
| `commit-reveal` | Menyentuh hash prediksi | Skema hash brief, test vektor JSON yang dipakai bersama `forge test` dan Vitest |
| `riskguard-rule` | Menambah/mengubah aturan konten | Aturan di `packages/riskguard`, test lolos + diblokir (ID & EN), sinkron dengan bagian 9 |
| `post-pipeline` | Menyentuh alur posting | Urutan wajib brief: AI → RiskGuard → commit terkonfirmasi → antrian → post; mode `dry/live` |
| `new-endpoint` | Menambah endpoint | zod → route → `openapi.json` → `api-client` → fixture → test |
| `contract-change` | Mengubah kontrak | Test unit + fuzz, `forge snapshot`, export ABI, rasio 30/20 tetap hardcode |
| `deploy-contracts` | Deploy localhost/testnet/dry run | Cek chain ID, alamat keystore, saldo, perintah untuk saya jika butuh password |
| `integrate-html` | HTML datang | Bagian 8 |
| `progress-log` | Akhir setiap task | Update `PROGRESS.md`, `BLOCKERS.md`, `DECISIONS.md` |

Muat skill yang cocok sebelum mengerjakan task. Pola kerja yang muncul ≥ 2 kali dan belum punya skill dijadikan skill baru, lalu dicatat di `PROGRESS.md`.

---

## 7. Subagent

Di `.claude/agents/`:

- `contract-reviewer`: meninjau `contracts/`, terutama keamanan, rasio fee 30/20, dan tidak adanya jalan menarik dana BurnVault. Hanya meninjau, tidak menulis kode.
- `riskguard-reviewer`: mencoba membobol RiskGuard dengan teks adversarial, lalu melaporkan celah sebagai test yang gagal. Ini mitigasi risiko "AI membuat klaim salah atau halusinasi" di brief.

Workstream kontrak, indexer, dan worker boleh paralel dengan subagent. Hasil subagent diverifikasi dengan test sebelum di-merge.

---

## 8. Persiapan integrasi HTML

Sambil menunggu desain:

- Setiap endpoint punya fixture di `docs/api/fixtures/` dengan bentuk yang sama persis dengan response asli.
- `packages/api-client` dapat dipakai di browser maupun server.
- API menyediakan nilai mentah dan nilai terformat, plus **link Blockscout** untuk setiap commit (brief: halaman Proof of Intelligence).
- CORS lewat env `WEB_ORIGIN`.

### Perintah "HTML siap"

Saya akan menaruh file desain di `docs/html-design/` (HTML, CSS, gambar, logo, font), lalu mengetik **"HTML siap"**. Saat itu:

1. **Hentikan task yang sedang berjalan di titik aman**: selesaikan langkah kecil yang sedang dikerjakan, pastikan test hijau, commit (`wip:` jika belum selesai), lalu catat di `PROGRESS.md` task mana yang dijeda.
2. **Cek isi `docs/html-design/`.** Jika kosong atau ada file yang dirujuk HTML tetapi tidak ada (gambar, font, CSS), catat daftarnya di `BLOCKERS.md`, beri tahu saya, lalu kerjakan bagian yang filenya sudah lengkap.
3. **Jalankan skill `integrate-html` sampai selesai** (langkah di bawah), tanpa menunggu konfirmasi dan di tahap roadmap mana pun. Endpoint yang belum ada dibangun dengan fixture dulu, lalu dicatat sebagai task di `PROGRESS.md`.
4. Setelah integrasi selesai, laporkan ke saya:
   - halaman yang sudah tersambung
   - halaman yang masih memakai fixture
   - perbedaan tampilan dengan HTML asli
5. Lanjutkan task yang dijeda di langkah 1.

Deploy ke Vercel **tidak** ikut dijalankan; itu menunggu perintah "Deploy web".

Jika desainer mengirim revisi, saya akan mengetik **"HTML revisi"**. Bandingkan file baru dengan versi sebelumnya (`git diff docs/html-design/`), lalu perbarui hanya komponen yang berubah.

**Langkah skill `integrate-html`:**

1. Petakan setiap halaman/komponen ke endpoint di `docs/html-design/mapping.md`. Data tanpa endpoint menjadi task baru.
2. Buat `apps/web` (Next.js, sesuai brief). Ubah HTML jadi komponen tanpa mengubah tampilan desainer; ekstrak warna/font/spacing ke design tokens.
3. Kembangkan dengan fixture dulu (`NEXT_PUBLIC_USE_FIXTURES=true`), lalu sambungkan ke API.
4. Pakai logo dan aset dari desainer apa adanya; jangan membuat logo sendiri.
5. Verifikasi dengan screenshot Playwright dibandingkan dengan HTML asli.

---

## 9. Spesifikasi inti (dari brief)

### Arsitektur: empat lapis

| Lapis | Komponen | Fungsi |
| --- | --- | --- |
| Data | Indexer Envio HyperSync + event Pons V2 | Launch, trade, graduation, transfer whale, harga Stock Token |
| Data | Chainlink Data Feeds | Harga resmi Stock Token untuk analisis dan penilaian prediksi |
| Otak | LLM API + tool calling | Analisis, ringkasan, jawaban mention; prompt persona "superintelligence" |
| Filter | `RiskGuard` (kode, bukan AI) | Blokir ajakan beli/jual, blokir token terlalu baru, wajib disclaimer |
| Bukti | `NexaLedger` (Solidity) | `commit(hash)` sebelum posting, `reveal()` saat jatuh tempo, skor otomatis dari oracle |
| Publikasi | X API + web dashboard | Post publik, alert Pro real-time, halaman Proof of Intelligence |

**Aturan pipeline:**

1. Tidak ada post yang keluar sebelum lolos RiskGuard.
2. Prediksi tidak diposting sebelum tercatat di `NexaLedger` (tx terkonfirmasi, tx hash disimpan).
3. Data hanya dari indexer dan oracle. Setiap angka di post harus bisa dilacak ke tool result.
4. **Human-in-the-loop 30 hari pertama:** semua post masuk antrian persetujuan. Setelah filter terbukti stabil, hanya reply berisiko yang perlu persetujuan. Buat sebagai config flag, plus CLI persetujuan karena UI admin belum ada.
5. Post publik di X **ditunda 15 menit** dari alert Pro.

### NexaLedger (commit-reveal)

- `commit(hash)` sebelum posting; `reveal()` saat jatuh tempo; skor otomatis dari harga oracle.
- **Hash = keccak(teks prediksi, aset, arah, horizon, salt).** Implementasi: `keccak256(abi.encode(string text, address asset, uint8 direction, uint32 horizon, bytes32 salt))`, identik di Solidity dan TS.
- **Salt dirahasiakan sampai reveal**, supaya prediksi tidak bisa disalin sebelum terbukti. Simpan terenkripsi, jangan pernah di log.
- Horizon Prediction of the Day: 7 hari.
- **[di luar brief]** Karena aset tersembunyi saat commit, harga awal tidak bisa diambil saat commit. Default: saat reveal kirim `roundId` Chainlink awal dan akhir, lalu kontrak memverifikasi timestamp lewat `getRoundData`. Catat di `DECISIONS.md`.

### Tokenomics & kontrak fee

Mekanik Pons V2: bonding curve, lalu graduate ke pool Uniswap v4 terkunci permanen. Fee 1% per trade: 30% untuk Pons, sisanya creator. Fee dibayar dalam aset pasangan, dan penerima fee bisa dialihkan.

| Aliran fee | Sumber | Ke BurnVault | Sisa |
| --- | --- | --- | --- |
| Creator fee | Bagian creator dari fee trading $NEXA di Pons | **30%** | 70% treasury: biaya AI, X API, marketing |
| Protocol fee | Langganan Pro, API, kredit Ask NEXA, laporan sponsor | **20%** | 80% operasional |

- **Rasio 30/20 di-hardcode** (`constant`).
- **Jangan pakai buyback bawaan Pons**: dikunci 5 tahun dan tidak dibakar. Pakai `CreatorFeeSplitter` sendiri, dengan penerima fee Pons dialihkan ke splitter.
- `BurnVault` membeli dan membakar $NEXA.
- **Aset pasangan: NVDA Stock Token (sudah diputuskan).** Narasinya "AI influencer di-pair dengan saham AI". Konsekuensinya:
  - Creator fee diterima dalam NVDA. `CreatorFeeSplitter` membagi NVDA: 30% ke BurnVault, 70% ke treasury.
  - `BurnVault` menukar NVDA → $NEXA lalu membakarnya.
  - Treasury perlu menjual sebagian NVDA untuk biaya operasional (dilakukan pemegang treasury, bukan kontrak).
  - Feed Chainlink NVDA wajib tersedia di chain tempat kontrak berjalan.
  
  Alamat aset pasangan tetap berupa parameter deploy (bukan hardcode), supaya test bisa memakai mock token.
- **Utilitas $NEXA:** holder di atas ambang tertentu mendapat alert Pro lebih cepat dan kredit Ask NEXA gratis tiap bulan.

### RiskGuard (di-hardcode, setiap aturan wajib punya test)

Aturan konten dari brief:

| Aturan brief | Implementasi |
| --- | --- |
| Akun berlabel automated di X; bio "AI agent, bukan nasihat keuangan" | Checklist setup akun + disclaimer wajib di post yang membutuhkannya |
| Tidak ada "beli", "jual", "pasti naik", atau target harga untuk token mana pun | Blokir frasa ID & EN, tahan spasi/simbol sisipan; blokir pola target harga |
| Tidak pernah membahas $NEXA selain pengumuman teknis dan burn | Sebutan $NEXA hanya di tipe `technical_announcement` / `burn_report` |
| Konten sponsor selalu diawali label "Sponsored" | Tipe `sponsored` wajib berawalan "Sponsored", tanpa rekomendasi beli |
| Tidak membahas token berumur di bawah 1 jam | Umur dari indexer; tolak jika < 1 jam |
| Jika data tidak lengkap, bilang tidak tahu | Tool result kosong/gagal → jawaban "tidak tahu" |
| Post tanpa link (biaya X) | Blokir URL; link ditaruh di bio dan web |

**Aturan emas:** NEXA tidak pernah membahas harga $NEXA dan tidak pernah menyuruh orang membelinya.

Output RiskGuard: `{ allowed, reasons[], requiresApproval }`, dan setiap keputusan disimpan di log.

### X API (dari brief)

- Pay-per-use sejak Februari 2026: sekitar **$0,015 per post**, **$0,20 per post berlink**, **$0,005 per post yang dibaca**. Posting tanpa link, read seminimal mungkin.
- Follow, like, dan quote-post hanya tersedia di Enterprise. **Rancang untuk posting dan reply saja.**
- Pakai API resmi, ikuti aturan automation X, dan siapkan kanal cadangan (Telegram, web).
- Pantau halaman harga resmi X, dan catat biaya setiap request.

### Model bisnis & endpoint

| Produk (brief) | Harga | Isi | Endpoint |
| --- | --- | --- | --- |
| NEXA Pro | $19/bulan | Alert real-time di web + Telegram; X ditunda 15 menit | `GET /alerts/stream` (SSE) + bot Telegram |
| Ask NEXA | $1 per analisis | Laporan risiko lengkap satu alamat, dibayar USDG | `POST /ask` (verifikasi pembayaran on-chain sebelum memanggil LLM) |
| Signals API | $499/bulan | Feed JSON untuk bot, dashboard, komunitas | `GET /signals` (API key + rate limit) |
| Sponsored deep-dive | $750 per laporan | Riset berlabel "Sponsored", tanpa rekomendasi beli | Alur internal + tipe konten `sponsored` |

| Fitur web (brief) | Endpoint |
| --- | --- |
| Proof of Intelligence: win rate, rata-rata return, setiap commit + link Blockscout | `GET /proof`, `GET /predictions/:id` |
| NEXA vs KOL: leaderboard akurasi (KOL yang mau ikut dinilai) | `GET /leaderboard` |
| Rug radar: launch Pons dengan red flag, real-time | `GET /rug-radar` |
| Burn tracker $NEXA | `GET /burn` |

Login wallet untuk Pro dan benefit holder: SIWE **[di luar brief]**.

**Unit economics (asumsi perencanaan di brief):** pendapatan $13.497/bulan, BurnVault −$2.699, X API −$122, LLM −$800 (perlu diukur), indexer/RPC/server −$700, margin $9.176. **Biaya terbesar adalah LLM**: analisis panjang hanya untuk Pro dan Ask NEXA, model lebih kecil untuk post rutin. Catat token dan biaya LLM, X, dan infra per request supaya asumsi ini bisa diverifikasi.

---

## 10. Wallet & deploy

- Private key tidak boleh ada di repo, `.env`, atau log. Testnet dan dry run memakai Foundry keystore (`--account deployer`). Localhost memakai impersonate Anvil.
- Sebelum deploy, `cast chain-id`, alamat keystore, dan `cast balance` harus cocok. Jika tidak cocok atau saldo 0, **berhenti** dan catat di `docs/BLOCKERS.md`.
- Perintah yang meminta password keystore **saya jalankan sendiri**. Siapkan perintah lengkap di `docs/BLOCKERS.md`, lalu kerjakan task lain.
- **Jangan pernah broadcast ke mainnet.** Mainnet hanya dry run (`forge script` tanpa `--broadcast`), dengan laporan biaya.
- **Audit `NexaLedger` dan splitter wajib sebelum launch** (brief minggu 9). Claude menyiapkan paket audit; audit dilakukan pihak luar.
- **Launch $NEXA di Pons V2 dilakukan manusia.** Claude hanya menyiapkan checklist: opening buy via launch-and-buy dan diumumkan, creator tax tambahan 0%, rasio 30/20 hardcode, penerima fee = `CreatorFeeSplitter`.

---

## 10b. Infrastruktur: Supabase, Railway, Vercel

**Deploy hanya setelah perintah saya.** Sebelum itu, Claude Code boleh menyiapkan file konfigurasi di repo (misalnya `railway.json`, Dockerfile/Nixpacks config, script migrasi), tetapi **tidak membuat project, tidak mengubah resource cloud, dan tidak deploy**.

| Perintah saya | Yang dikerjakan |
| --- | --- |
| **"Deploy testnet"** | Supabase + Railway untuk testnet (langkah di bawah), lalu PR `main` → `testnet` |
| **"Siapkan mainnet"** | Buat project Supabase & Railway mainnet, isi env vars, **service Railway tidak dijalankan** |
| **"Deploy web"** | Vercel untuk `apps/web` (hanya setelah HTML terintegrasi) |
| **"HTML siap"** / **"HTML revisi"** | Integrasi desain (bagian 8); tidak men-deploy apa pun |

**Supabase (database):**

1. Buat project `nexa-ai-<env>` di region `ap-southeast-1` (Singapura, terdekat dengan Indonesia).
2. Password database dibuat acak oleh Claude Code dan disimpan di `~/.config/nexa-ai/supabase-<env>.env` (`chmod 600`, di luar repo). Password **tidak pernah ditampilkan** di layar, log, commit, atau `docs/`.
3. `supabase link`, lalu jalankan migrasi Drizzle ke database tersebut.
4. pg-boss dan koneksi long-running memakai **direct/session connection**, bukan transaction pooler.
5. Service role key tidak dipakai backend (backend memakai koneksi Postgres langsung). Jangan disalin ke Railway, Vercel, atau repo.

**Railway (worker, indexer, api):**

1. Buat project `nexa-ai-<env>` dengan tiga service dari repo `project-nexaAI/nexa-ai`, branch `testnet` (atau `mainnet`), root masing-masing `apps/worker`, `apps/indexer`, `apps/api`.
2. Push ke branch `testnet` otomatis memicu deploy ulang (integrasi GitHub Railway). Jika integrasi GitHub butuh persetujuan di dashboard, catat di `BLOCKERS.md`.
3. Env vars diisi dengan `railway variables`. `DATABASE_URL` dibaca dari file `~/.config/nexa-ai/supabase-<env>.env` dan dikirim langsung tanpa ditampilkan.
4. **Private key wallet agent tidak pernah dipegang Claude Code.** Tulis instruksi di `BLOCKERS.md` agar saya memasukkan `AGENT_PRIVATE_KEY` sendiri lewat dashboard Railway (service `worker`). Sebelum variable itu ada, worker berjalan dengan commit dinonaktifkan.
5. API key X, LLM, dan Telegram juga saya masukkan sendiri di dashboard Railway. Claude Code hanya menulis daftar nama variabelnya.
6. Indexer Envio: cek di Tahap 1 apakah self-hosted Envio bisa memakai Supabase (schema terpisah `envio`). Jika tidak, catat opsi (Postgres Railway atau Envio hosted) di `DECISIONS.md` dan pilih yang paling sederhana.

**Vercel (nanti):** project dari repo yang sama, Root Directory `apps/web`, Production Branch `mainnet`, branch `testnet` sebagai preview. `NEXT_PUBLIC_API_URL` mengarah ke service `api` di Railway.

Semua resource (nama project, region, URL service, nama env vars, **tanpa nilai rahasia**) dicatat di `docs/infrastructure.md`.

---

## 11. Git & setup

**Tahap 0, setup:**

1. Tulis `.claude/settings.json`:
   ```json
   {
     "attribution": { "commit": "", "pr": "" },
     "permissions": {
       "allow": [
         "Bash(pnpm:*)", "Bash(npm:*)", "Bash(npx:*)", "Bash(node:*)",
         "Bash(forge:*)", "Bash(cast:*)", "Bash(anvil:*)",
         "Bash(docker:*)", "Bash(git:*)", "Bash(gh:*)",
         "Bash(supabase:*)", "Bash(railway:*)", "Bash(vercel:*)",
         "Bash(curl:*)", "Bash(mkdir:*)", "Bash(chmod:*)"
       ]
     }
   }
   ```
   Jika izin belum aktif, minta saya restart Claude Code sekali.
2. Pasang Node ≥ 22, pnpm, Foundry, Docker, GitHub CLI, Supabase CLI, Railway CLI, Vercel CLI. Cek `gh auth status`, `supabase projects list`, `railway whoami`, `vercel whoami`, dan `git config user.name/email`. Jika belum login, jalankan perintah login-nya dan minta saya konfirmasi di browser. Login hanya dicek di Tahap 0; **membuat project dan deploy menunggu perintah saya** (bagian 10b).
3. Hubungkan `origin` ke https://github.com/project-nexaAI/nexa-ai. Jika remote berisi commit, fetch lalu gabungkan tanpa menimpa; jika bentrok, catat di `BLOCKERS.md`. Buat branch `testnet` dan `mainnet`.
4. Salin brief ke `docs/NEXA-Developer-Brief.md`.
5. Buat skill (bagian 6), subagent (bagian 7), dan `docs/PROGRESS.md`, `BLOCKERS.md`, `DECISIONS.md`.
6. Wallet:
   - `docs/SETUP-WALLETS.md` sudah disediakan; jangan ditimpa, hanya diperbarui jika ada nama variabel yang berubah.
   - Pastikan `.env.example` berisi `DEPLOYER_ADDRESS=0x1f4cD14B5CDD15436950d626CBCb0e21084F462D`, `AGENT_ADDRESS=`, `TREASURY_ADDRESS=`, dan `.env` ada di `.gitignore`.
   - Buat script `pnpm check:wallets` sesuai bagian 6 panduan itu. Script hanya membaca alamat publik dan keystore, tidak pernah menampilkan atau membaca private key.
   - Jika keystore `deployer`/`nexa-agent` belum ada atau `AGENT_ADDRESS`/`TREASURY_ADDRESS` kosong, catat di `BLOCKERS.md` dengan rujukan ke `docs/SETUP-WALLETS.md`, lalu lanjutkan task lain.
   - Saat saya mengetik **"Wallet sudah diisi"**, jalankan `pnpm check:wallets` dan perbarui field `agent` dan `treasury` di `packages/contracts-abi/addresses/<network>.json`.

**Aturan git:**

- Jangan pernah force-push. Commit dan PR atas nama identitas git saya, tanpa atribusi AI.
- Hooks di `.githooks/` (`git config core.hooksPath .githooks`):
  - `commit-msg` membuang baris atribusi AI.
  - `pre-push` menjalankan lint, typecheck, `pnpm test`, dan `forge test`.
- Conventional Commits, commit kecil ke `main`, lalu PR `main` → `testnet`.

---

## 12. Tahapan (mengikuti roadmap brief)

| Tahap | Brief | Pekerjaan backend | Selesai jika |
| --- | --- | --- | --- |
| 0 | — | Setup (bagian 11), verifikasi alamat (bagian 4) | Repo terhubung; skill & docs ada; `chains.ts` bersumber |
| 1 | **Minggu 1–2:** indexer Robinhood Chain + Pons V2, `NexaLedger` di testnet 46630 | Monorepo, Postgres, indexer Envio (launch, trade, graduation, whale, Stock Token), red flag; `NexaLedger` + test + deploy testnet | Data Pons tersimpan; commit/reveal jalan di testnet |
| 2 | **Minggu 3–4:** otak AI + RiskGuard, antrian persetujuan manusia, web Proof of Intelligence | Tools LLM, prompt persona, RiskGuard + test adversarial, antrian + CLI approve, X & Telegram mode `dry`; endpoint `/proof`, `/predictions/:id`, `/rug-radar` + fixture | Satu siklus prediksi penuh (commit → post `dry` → reveal → skor) lolos |
| 3 | **Minggu 5–8:** NEXA posting di X selama 30 hari dengan prediksi harian ter-commit, sebelum token ada | Deploy Supabase + Railway setelah perintah "Deploy testnet", X `live` setelah saya izinkan, human-in-the-loop, monitoring biaya, perbaikan model dari hasil | Track record 30 hari tampil di `/proof` |
| 4 | **Minggu 9:** audit `NexaLedger` dan splitter, lalu launch $NEXA di Pons V2 | `CreatorFeeSplitter` + `BurnVault` + test, paket audit, dry run mainnet, checklist launch, endpoint `/burn` | Paket audit & checklist diserahkan; launch dilakukan manusia |
| 5 | **Minggu 10+:** NEXA Pro, Ask NEXA, Signals API | SSE + Telegram Pro, `/ask` dengan USDG, `/signals`, SIWE + benefit holder, alur sponsored, `/leaderboard`, protocol fee → splitter 20% | Semua endpoint punya test + fixture; cek hukum (OJK) selesai sebelum fitur berbayar aktif |
| HTML | — | Bagian 8, mulai saat HTML ada di `docs/html-design/` | Halaman tersambung ke API; screenshot cocok dengan desain |

Tahap HTML tidak terikat urutan roadmap: dimulai kapan pun saya mengetik **"HTML siap"** (bagian 8). Endpoint yang belum ada memakai fixture dulu.

---

## 13. Cara kerja

- Jangan menunggu konfirmasi di antara langkah. Keputusan teknis ambigu: pilih opsi paling masuk akal, catat satu baris di `DECISIONS.md` (tandai **[di luar brief]** jika relevan), lalu lanjutkan.
- Task gagal 3 kali dengan pendekatan berbeda: catat di `BLOCKERS.md`, lanjutkan task lain.
- Berhenti hanya untuk:
  - konfirmasi login di browser (GitHub, Supabase, Railway, Vercel)
  - perintah deploy dari saya ("Deploy testnet", "Siapkan mainnet", "Deploy web")
  - memasukkan private key agent dan API key di dashboard Railway
  - import keystore
  - dana faucet
  - perintah yang butuh password keystore
  - mengaktifkan X `live`
  - mengaktifkan fitur berbayar
  - keputusan final di bagian 14, **hanya** saat tahap di kolom "Final sebelum" akan dimulai (sebelum itu pakai default sementara)
- Konvensi kode:
  - TypeScript strict
  - input eksternal divalidasi dengan zod
  - uang dan harga selalu `bigint` + desimal eksplisit
  - waktu dalam UTC
  - rahasia hanya di `.env`; perbarui `.env.example` setiap ada variabel baru
  - salt, API key, dan private key tidak pernah di log
- `PROGRESS.md` dan `BLOCKERS.md` selalu terkini. Laporkan ke saya hanya saat tahap selesai atau ada blocker baru.

**Sesi berikutnya:** baca `PROGRESS.md`, `BLOCKERS.md`, `DECISIONS.md`, cek blocker yang sudah saya selesaikan, cek apakah `docs/html-design/` sudah berisi HTML, lalu lanjutkan dari task terakhir.

### Risiko & mitigasi (dari brief)

| Risiko | Mitigasi |
| --- | --- |
| AI membuat klaim salah atau halusinasi | RiskGuard berbasis kode, data hanya dari indexer dan oracle, review manusia di awal |
| Dianggap memberi nasihat investasi tanpa izin | Tanpa ajakan beli/jual, disclaimer, konsultasi hukum; cek aturan OJK |
| Akun X kena suspend | Ikuti aturan automation X, API resmi, kanal cadangan (Telegram, web) |
| Harga X API berubah | Pantau halaman resmi; desain tanpa link dan read seminimal mungkin |
| Track record buruk di awal | 30 hari sebelum token untuk memperbaiki model |
| Pairing NVDA membuat harga $NEXA volatil | Pertimbangkan ETH |

---

## 14. Keputusan

### Sudah diputuskan (jangan tanyakan lagi)

| Keputusan | Hasil | Rincian |
| --- | --- | --- |
| Pairing $NEXA | **NVDA Stock Token** | Bagian 9, Tokenomics |
| Penyedia LLM | **Xiaomi MiMo** | Bagian 5. Env: `LLM_PROVIDER=mimo`, `LLM_BASE_URL=https://api.xiaomimimo.com/v1`, `LLM_API_KEY=` (saya isi sendiri), `LLM_MODEL_SMALL=mimo-v2-flash`, `LLM_MODEL_LARGE=mimo-v2.5-pro`. Selama `LLM_API_KEY` kosong, pakai mock LLM dan catat di `BLOCKERS.md` |
| Wallet deployer | `0x1f4cD14B5CDD15436950d626CBCb0e21084F462D` | Bagian 3 |
| Ketentuan wallet agent | Hot wallet terpisah, hanya `commit()`/`reveal()`, sedikit ETH untuk gas | Bagian 3 |
| Ketentuan wallet treasury | Akun MetaMask biasa (tidak wajib multisig), hanya menerima 70% creator fee + 80% protocol fee; private key tidak pernah masuk backend, hanya alamat publik `TREASURY_ADDRESS` | Bagian 3 |
| Alamat agent & treasury | Sudah ada; diisi manual oleh saya di `.env` (`AGENT_ADDRESS`, `TREASURY_ADDRESS`) | `docs/SETUP-WALLETS.md`; perintah "Wallet sudah diisi" |

### Masih terbuka (pakai default sementara, jangan menunggu)

Keputusan di bawah belum ditetapkan brief. **Jangan berhenti karenanya.** Pakai default sementara, buat semuanya bisa diubah lewat config/parameter (bukan hardcode), dan catat di `DECISIONS.md` sebagai "sementara". Tagih keputusan final ke saya (lewat `BLOCKERS.md`) hanya saat tahap di kolom "Final sebelum" akan dimulai.

| Keputusan | Default sementara | Final sebelum |
| --- | --- | --- |
| Definisi "menang" | Arah saja, dengan parameter `minMoveBps` yang default `0` (bisa dinaikkan tanpa mengubah kontrak lain) | Tahap 3 (posting 30 hari) |
| Ambang holder $NEXA | Config `HOLDER_THRESHOLD`, default kosong (benefit holder nonaktif) | Tahap 5 |
| Chain commit 30 hari | Pengembangan di testnet 46630 dengan mock oracle; cek di Tahap 0 apakah feed Chainlink Stock Token ada di testnet dan laporkan hasilnya | Tahap 3 |
| Konsultasi hukum (OJK) | Fitur berbayar dibangun tetapi di belakang flag `PAID_FEATURES_ENABLED=false` | Tahap 5 diaktifkan |
