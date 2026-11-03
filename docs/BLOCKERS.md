# BLOCKERS

| # | Blocker                                                                                                                                                                 | Tindakan manusia                                                                                  | Status  |
| - | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------- |
| 1 | Login CLI dicek 2026-10-31: `gh` (akun Bayusmd; terpasang di `C:\Program Files\GitHub CLI`, tidak ada di PATH Git Bash), `supabase`, `railway`, `vercel` semuanya login | — | **Selesai** |
| 2 | Keystore `deployer` dan `nexa-agent` diimpor, dan alamatnya **cocok** (`deployer` = `0x1f4cD14B5CDD15436950d626CBCb0e21084F462D`; `nexa-agent` = `AGENT_ADDRESS`). Dikonfirmasi pemilik proyek 2026-10-31 (dicek dengan password; tidak dapat diverifikasi otomatis) | — | **Selesai** |
| 3 | `TREASURY_ADDRESS` sudah disalin ke `addresses/testnet.json` dan `mainnet.json` (2026-10-31). **`agent` sengaja masih `null`**: pemilik proyek menyatakan wallet agen belum siap (keystore `nexa-agent` belum dicek dan saldo testnet 0, lihat #18). `AGENT_ADDRESS` di `.env.example` sudah ada | Setelah wallet agen siap, ketik "Wallet agen sudah diisi": field `agent` diisi dan `pnpm check:wallets` dijalankan lagi | Sebagian |
| 4 | `LLM_API_KEY` terisi dan terverifikasi 2026-10-31 (model besar dan kecil menjawab, mode JSON jalan) | — | **Selesai** |
| 5 | Saldo deployer testnet terisi: 0,01 ETH (dicek 2026-10-31 dengan `cast balance`) | — | **Selesai** |
| 6 | **Sebagian selesai (2026-10-31), hanya MAINNET:** Pons factory/hook/graduation executor (docs.ponsfamily.com/v2), feed Chainlink ETH/USD & NVDA/USD (daftar resmi Chainlink), USDG (docs Robinhood), Uniswap v4 PoolManager (dibaca dari `hook.poolManager()`) sudah di `chains.ts`, semua dicek punya code di mainnet. **Testnet 46630: tidak ada satu pun alamat ini** (code kosong) -> testnet tetap pakai mock oracle/token | Konfirmasi ke Pons/Robinhood: apakah ada deployment Pons V2 & feed Chainlink di testnet | Sebagian |
| 7 | ~~ABI Pons V2~~ **Selesai (2026-10-31), tanpa menunggu pihak Pons:** event dipulihkan dari chain. `CurveCompleted(address,uint256,uint256)` (graduation) cocok dengan hash topic0 dan muncul tepat saat curve mencapai threshold; `HookFeeCollected`, `PoolFeesSwept`, `CreatorFeeRecipientUpdated`, `FeesSwept`, `CurveBuyRefunded`, `BuybackLocked` juga teridentifikasi. Indexer kini mencatat graduation, konsentrasi holder (+ red flag), transfer whale NVDA, dan event BurnVault. **Sisa:** fungsi (bukan event) Pons tetap hanya dari fragmen docs; nama parameter event adalah tebakan kita sendiri | — | **Selesai** |
| 8 | HTML desain: handle X = `NexaAgentX` (default di `apps/web/src/lib/site.ts`, env `NEXT_PUBLIC_X_HANDLE` dapat menimpa) | Selesai (1 Nov 2026) | Selesai |
| 9 | ~~Halaman `/privacy`~~ Tautan Privacy dihapus dari footer atas permintaan pemilik proyek (2026-10-31); halamannya tidak dibuat. Perlu dibuat lagi bila ada kewajiban hukum atau kebijakan privasi (tautan sesi/wallet memakai sessionStorage, tanpa cookie) | Teks kebijakan dari pemilik bila diperlukan | **Selesai (dihapus)** |
| 10 | **Diselesaikan sementara (2026-10-31):** halaman detail prediksi, NEXA vs KOL, Rug radar, Burn tracker, Proof, dan Ask NEXA dibuat tanpa desain HTML (lihat DECISIONS). Belum ada desain: Pro (alert), Signals API, Sponsored, `/privacy` dan terms | Desainer boleh menggantikan halaman ini kapan saja dengan "HTML revisi" | Sebagian |
| 11 | Tahap 4: adaptor swapper Uniswap v4 (NVDA -> $NEXA) belum ada. Butuh alamat PoolManager/Universal Router yang terverifikasi dan PoolKey pool $NEXA (baru ada setelah graduation; sebelumnya $NEXA diperdagangkan di bonding curve Pons) | Berikan dokumen resmi Pons V2/Uniswap v4 di Robinhood Chain; tentukan jalur beli sebelum graduation | Terbuka |
| 12 | NVDA Stock Token mainnet **sudah ditemukan**: `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` (api.robinhood.com/rhj/assets; name "NVIDIA • Robinhood Token", 18 desimal) dan feed NVDA/USD terverifikasi (harga terbaca ~$205). Belum diuji: perilaku token (allowlist/pajak) | Fork test sebelum launch (docs/launch-checklist.md B) | Sebagian |
| 13 | Audit eksternal NexaLedger + splitter (wajib sebelum launch) | Pilih auditor; serahkan `docs/audit/README.md` | Terbuka (manusia) |
| 14 | `TREASURY_ADDRESS` sudah terisi di `.env`. `KEEPER_ADDRESS` masih kosong (dibutuhkan deploy kontrak fee; Final: Tahap 4) | Isi `KEEPER_ADDRESS` di `.env` | Sebagian |
| 15 | `LLM_MODEL_SMALL` sebelumnya `mimo-v2.5-asr` (model suara, HTTP 400). Sudah diganti menjadi `mimo-v2.6-flash` oleh pemilik proyek; diverifikasi 2026-10-31 dengan smoke test (kecil dan besar menjawab, prediksi lolos RiskGuard) | — | **Selesai** |
| 16 | **Sebagian selesai (2026-10-31):** `LlmPricing` kini per tier dan terisi harga SEMENTARA dari sumber pihak ketiga (flash $0,14 masuk / $0,28 keluar; pro $0,435 / $0,87 per 1 juta token). **Belum dari halaman harga resmi Xiaomi** (tidak terjangkau dari pencarian), harga cache-hit diabaikan (biaya tercatat = batas atas), dan base URL "token-plan" Anda mungkin memakai tarif paket lain | Cocokkan dengan halaman harga/tagihan akun MiMo Anda; jika beda, isi `LLM_PRICE_*_USD_MICROS` di env (tanpa ubah kode) | Sebagian |
| 17 | ~~Deploy NexaLedger testnet~~ **Selesai 2026-10-31**: `0xEF1fBbd8ea7dC858Dc88332AcD43Ba58b9bD81C0` (tx `0x317fca74…e54d`, blok 145.675.140). Diverifikasi on-chain: `owner` = deployer, `agent` = `0x35Ca…4561`, `minMoveBps` = 0, kode ada. Tercatat di `addresses/testnet.json`; `NEXA_LEDGER_ADDRESS` sudah diisi di Railway worker | — | **Selesai** |
| 18 | ~~Saldo agent testnet 0~~ **Selesai 2026-11-01**: saldo agent `0x35Ca…4561` = 0,01 ETH testnet (diverifikasi on-chain). Cukup untuk ratusan commit/reveal | — | **Selesai** |
| 19 | ~~Organisasi Supabase~~ project `nexa-ai-testnet` dibuat pemilik (us-east-1), `DATABASE_URL` tersimpan di `~/.config/nexa-ai/supabase-testnet.env`, migrasi sukses | — | **Selesai** |
| 20 | ~~Deploy Railway tertahan QUEUED~~ Antrean trial ~1 jam; percobaan pertama gagal karena belum ada start command (source masih `main`). Setelah source dipindah ke `testnet` dan build/start diatur via API, `worker` dan `api` **Online** (2026-10-31) | — | **Selesai** |
| 21 | ~~Kunci worker~~ **Selesai 2026-11-01**: `AGENT_PRIVATE_KEY`, `PREIMAGE_KEY`, `LLM_API_KEY`, `NEXA_LEDGER_ADDRESS`, `KEEPER_PRIVATE_KEY` terisi; worker aktif. **Sisa: wallet keeper belum bersaldo** (push harga gagal) | Faucet ke alamat keeper | Sebagian |
| 22 | ~~Feed tiruan testnet~~ **Selesai 2026-10-31**: aset NVDA/ETH tiruan terdaftar di NexaLedger (`feedOf` diverifikasi on-chain). Feed NVDA `0xAB06…81Ed` (harga awal $205,28), feed ETH `0x8c32…c843` ($2236,56). `PREDICTION_ASSETS` sudah diisi di Railway. **Sisa:** reveal butuh round baru setelah jatuh tempo; keeper otomatis sudah dibuat (lihat #23) | Keputusan: keeper otomatis (saran) atau push manual | Sebagian: menunggu #23 |
| 23 | **Keeper harga testnet** dibuat (`apps/worker/src/keeper.ts`): menyalin harga Chainlink mainnet NVDA/ETH ke feed tiruan testnet (push saat heartbeat 6 jam habis atau harga bergeser >= 0,5%). Butuh **wallet khusus keeper** (BUKAN agent, deployer, atau treasury; agent hanya boleh commit/reveal) dengan ~0,002 ETH testnet. Perkiraan gas: 2 feed x 4 push/hari ~ murah (~0,00002 ETH per push). Tanpa `KEEPER_PRIVATE_KEY` worker memberi log "keeper NONAKTIF" | Buat wallet baru (mis. akun baru di MetaMask), isi saldo dari faucet, lalu isi `KEEPER_PRIVATE_KEY` di Railway worker (Variables). Jangan kirim key ke chat | Menunggu pemilik |
| 12 | **Disimpan untuk dipertimbangkan (2026-11-02):** halaman `/privacy` dan `/terms` (dibandingkan dengan apevisor.tech). Rencana: draf bahasa Inggris, non-kustodian (NEXA tidak memegang kunci/dana pengguna), klausul khusus NEXA (data on-chain tidak bisa dihapus, prediksi bisa salah, tidak membahas harga/ajakan beli $NEXA, konten Sponsored, tanpa refund dan tanpa perpanjangan otomatis, pembayaran dari wallet yang sama dengan login), data yang dikumpulkan (alamat wallet, hash pembayaran, alamat kontrak di Ask NEXA, chat ID Telegram, log server), pihak ketiga (Supabase, Railway, Vercel, RPC, Chainlink, Telegram, X, Xiaomi MiMo). Tidak meniru kekurangan Apevisor (tanpa hukum berlaku/penyelesaian sengketa, judul non-kustodian padahal kustodian). | Pemilik memutuskan lalu memberi: nama pengelola, email kontak privasi, hukum yang berlaku + tempat sengketa, lama retensi data. Sebaiknya ditinjau orang hukum sebelum publik | Ditunda |

## Perintah deploy testnet (jalankan sendiri)

```bash
# Jalankan di: ROOT/contracts
export AGENT_ADDRESS=$(grep -E '^AGENT_ADDRESS=' ../.env | cut -d= -f2 | tr -d '\r ')
echo "agent: $AGENT_ADDRESS"   # harus 0x35Ca52DAd343a80A3Be6b09091B74Dd3e5864561
forge script script/DeployNexaLedger.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account deployer --sender 0x1f4cD14B5CDD15436950d626CBCb0e21084F462D --broadcast
```

Akan diminta password keystore `deployer`. Output akhir mencetak `NexaLedger 0x...`. Setelah selesai, ketik "sudah deploy": saya membaca alamatnya dari `contracts/broadcast/DeployNexaLedger.s.sol/46630/run-latest.json`, memverifikasi kode, `owner`, dan `agent` on-chain, lalu mengisi `addresses/testnet.json`.

## Perintah mock testnet (jalankan sendiri, PowerShell)

```powershell
# Jalankan di: ROOT\contracts
$env:NEXA_LEDGER = "0xEF1fBbd8ea7dC858Dc88332AcD43Ba58b9bD81C0"
& "$env:USERPROFILE\.foundry\bin\forge.exe" script script/DeployTestnetMocks.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account deployer --sender 0x1f4cD14B5CDD15436950d626CBCb0e21084F462D --broadcast
```

Aset tiruan (deterministik): NVDA `0xaDfc1A4b4F6990753EF12aD5d29a55c718c84Dd0`, ETH `0xfcE985e2175b8667dF234961A3c1687b6A6Bcf0E`. Setelah selesai, ketik "mock sudah deploy": saya memverifikasi `feedOf` on-chain dan mencatat alamat feed.

## Token uji pembayaran testnet (jalankan sendiri, PowerShell)

Agar Pro dan Ask NEXA bisa dicoba di testnet tanpa uang asli. Simulasi sudah sukses; broadcast butuh password keystore.

```powershell
# Jalankan di: ROOT\contracts
& "$env:USERPROFILE\.foundry\bin\forge.exe" script script/DeployTestUsdg.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account deployer --sender 0x1f4cD14B5CDD15436950d626CBCb0e21084F462D --broadcast
```

Salin alamat `TestUSDG` dari keluaran, lalu ketik "tUSDG sudah deploy" beserta alamatnya. Saya mengisi env API testnet (`PAYMENT_CHAIN_ID=46630`, `PAYMENT_USDG_ADDRESS`, `PAYMENT_RPC_URL` kosong = RPC testnet) dan men-deploy API. Setelah itu, dari wallet uji panggil `faucet()` pada TestUSDG (1000 tUSDG per panggilan) lewat explorer testnet, atau minta saya `cast send`. Wallet juga butuh sedikit ETH testnet untuk gas (faucet testnet).

## Kunci X API untuk posting (diisi pemilik di dashboard Railway)

1. Di console.x.com (akun yang mendaftarkan App harus `@NexaAgentX`): buat App bertipe Automated, izin **Read and write**.
2. Di tab Keys and tokens, buat **API Key and Secret** (Consumer Keys) dan **Access Token and Secret** untuk `@NexaAgentX` (pastikan izin tokennya Read and write; buat ulang token bila izin diubah setelah dibuat).
3. Isi di service `worker` Railway: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`. Jangan tempel nilainya di chat atau repo.
3b. Cek kunci tanpa memposting (satu permintaan baca, sekitar $0,005): isi keempat variabel itu di shell lokal Anda sendiri (bukan di chat), lalu `# Jalankan di: ROOT` → `pnpm --filter @nexa-ai/worker x:verify`. Hasil yang benar: `Kunci valid. Akun: @NexaAgentX`. Opsional `X_EXPECT_USERNAME=NexaAgentX` untuk menolak token milik akun lain.
4. Kabari saya setelah terisi. Saya mengatur `X_POST_MODE=live`, `X_LIVE_POST_CAP=2` (testnet), `POST_INTERVAL_MINUTES=30`, dan `X_POST_KINDS` hanya jenis data, setelah kamu mengizinkan secara eksplisit.
5. Mainnet: `X_LIVE_POST_CAP=4`. Setelah uji selesai, kembalikan ke batas terakhir sampai hari launch; saat launch kamu mengizinkan `unlimited`.

## Dipertimbangkan (belum diputuskan)

- **Pulse melewati topik Stock Token saat bursa AS tutup (2026-11-02):** pasar yang dituju adalah AS, jadi jam UTC tetap dipakai (tanpa WIB). Harga saham (NVDA) hanya bergerak saat bursa AS buka (sekitar 13:30 sampai 20:00 UTC, hari kerja); di luar itu oracle Chainlink menahan harga terakhir, sehingga post pulse tentang NVDA di malam hari atau akhir pekan memuat harga lama dan perubahan 24 jam tampak datar. Opsi: pulse hanya membahas topik Pons saat bursa tutup. Diputuskan pemilik untuk **dibiarkan dulu**; tinjau kembali sebelum mainnet live atau sebelum ritme 30 menit penuh dinyalakan.
- **Papan peringkat NEXA vs KOL (2026-11-02):** head dev setuju diisi dulu "dengan data yang sesuai". Syarat data: hanya KOL yang bersedia dinilai (opt-in), setiap call punya link post X asli, dicatat segera setelah KOL memposting (harga awal diambil dari oracle saat dicatat, jadi call lama tidak boleh ditambahkan mundur), dan tidak ada data karangan di situs publik. Menunggu daftar KOL yang setuju beserta call barunya; templat CSV dan daftar persetujuan dapat disiapkan bila diminta.

## Keputusan head dev: call KOL yang bisa dinilai (2026-11-03)

Pencarian manual 2026-11-02/03 (sekitar 10 post dari @CryptoMichNL, @MaxCrypto, @TedPillows, @AshCrypto, @MerlijnTheTrader, dll.): **0 post memenuhi syarat** (ETH atau NVDA, arah tegas, horizon 1 sampai 90 hari, post segar, link asli). Sebagian besar berupa komentar dan pengamatan pasar, bukan tebakan terukur. Tiga akun terdaftar tanpa call di database testnet: @CryptoMichNL, @RaoulGMI, @milesdeutscher.

Pilihan yang perlu diputuskan:
1. **Jendela standar:** call tanpa horizon eksplisit diberi jendela tetap (mis. 30 hari) yang diberi tanda "horizon ditetapkan NEXA". Call dengan arah dan target jelas (mis. "$3.000 is coming next") bisa masuk. Menyimpang dari brief dan mengubah arti "menang".
2. **Hanya KOL yang mau dinilai (sesuai brief):** KOL setuju dan menyesuaikan post agar terukur; data terkumpul lebih lambat tetapi bersih.
3. **Kosongkan dulu** dan fokus ke Proof of Intelligence NEXA sendiri; isi NEXA vs KOL setelah ada KOL yang ikut.
4. **Tambah aset yang didukung** (butuh feed oracle baru di NexaLedger; perubahan kontrak, di luar brief).

Sampai ada keputusan, aturan yang berlaku: horizon harus dari post KOL sendiri, dicatat segera (maks. beberapa jam), dengan link post asli.

## Railway mainnet: batas paket gratis (2026-11-03)
Supabase `nexa-ai-mainnet` sudah dibuat dan dimigrasi, tetapi `railway init -n nexa-ai-mainnet` ditolak: "Free plan resource provision limit exceeded". Workspace punya dua project: `nexa-ai-testnet` (worker, api, indexer) dan `graceful-victory` (dibuat 2026-10-28, bukan milik repo ini). Pilihan: (1) upgrade paket Railway; (2) hapus `graceful-victory` bila tidak dipakai (hanya pemilik yang memutuskan); (3) environment `mainnet` di project testnet (tidak dianjurkan, resource ikut terbagi). Variabel yang akan diisi: `X_POST_MODE=dry`, `X_LIVE_POST_CAP=4`, `PULSE_ENABLED=false` sampai izin live.
