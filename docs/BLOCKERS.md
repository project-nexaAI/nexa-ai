# BLOCKERS

| # | Blocker                                                                                                                                                                 | Tindakan manusia                                                                                  | Status  |
| - | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------- |
| 1 | Login CLI dicek 2026-10-31: `gh` (akun Bayusmd; terpasang di `C:\Program Files\GitHub CLI`, tidak ada di PATH Git Bash), `supabase`, `railway`, `vercel` semuanya login | — | **Selesai** |
| 2 | Keystore `deployer` dan `nexa-agent` diimpor, dan alamatnya **cocok** (`deployer` = `0x1f4cD14B5CDD15436950d626CBCb0e21084F462D`; `nexa-agent` = `AGENT_ADDRESS`). Dikonfirmasi pemilik proyek 2026-10-31 (dicek dengan password; tidak dapat diverifikasi otomatis) | — | **Selesai** |
| 3 | `TREASURY_ADDRESS` sudah disalin ke `addresses/testnet.json` dan `mainnet.json` (2026-10-31). **`agent` sengaja masih `null`**: pemilik proyek menyatakan wallet agen belum siap (keystore `nexa-agent` belum dicek dan saldo testnet 0, lihat #18). `AGENT_ADDRESS` di `.env.example` sudah ada | Setelah wallet agen siap, ketik "Wallet agen sudah diisi": field `agent` diisi dan `pnpm check:wallets` dijalankan lagi | Sebagian |
| 4 | `LLM_API_KEY` terisi dan terverifikasi 2026-10-31 (model besar dan kecil menjawab, mode JSON jalan) | — | **Selesai** |
| 5 | Saldo deployer testnet terisi: 0,01 ETH (dicek 2026-10-31 dengan `cast balance`) | — | **Selesai** |
| 6 | **Sebagian selesai (2026-10-31), hanya MAINNET:** Pons factory/hook/graduation executor (docs.ponsfamily.com/v2), feed Chainlink ETH/USD & NVDA/USD (daftar resmi Chainlink), USDG (docs Robinhood), Uniswap v4 PoolManager (dibaca dari `hook.poolManager()`) sudah di `chains.ts`, semua dicek punya code di mainnet. **Testnet 46630: tidak ada satu pun alamat ini** (code kosong) -> testnet tetap pakai mock oracle/token | Konfirmasi ke Pons/Robinhood: apakah ada deployment Pons V2 & feed Chainlink di testnet | Sebagian |
| 7 | Alamat Pons V2 mainnet sudah ada (lihat #6); **indexer launch+trade sudah jalan** (apps/indexer). **ABI lengkap belum ada**: docs Pons hanya memberi tanda tangan event `TokenLaunched/CurveBuy/CurveSell` + fragmen fungsi; source tidak dipublikasikan, Blockscout di balik Cloudflare. Event lain (`CurveCompleted`, `PoolGraduated`, dst.) tanpa tanda tangan lengkap. Indexer bisa mulai dari 3 event berdokumen; sisanya butuh ABI | Minta ABI/kontak ke contact@ponsfamily.com, atau ekspor ABI dari Blockscout lewat browser (tab Contract -> Code -> ABI) | Sebagian |
| 8 | HTML desain: `__X_HANDLE__` belum diberikan (tautan "Follow on X" saat ini `#`) | Isi `NEXT_PUBLIC_X_HANDLE` (tanpa @) dan `NEXT_PUBLIC_SITE_URL` | Terbuka |
| 9 | Halaman `/privacy` dirujuk footer desain tetapi tidak ada. (`og-image.png` sudah dibuat dari desain, lihat DECISIONS.) | Kirim teks kebijakan privasi | Terbuka |
| 10 | Desain belum mencakup halaman: detail prediksi, NEXA vs KOL (leaderboard), Rug radar penuh, Burn tracker | Kirim desain halaman tersebut; sementara hanya ada endpoint + fixture | Terbuka |
| 11 | Tahap 4: adaptor swapper Uniswap v4 (NVDA -> $NEXA) belum ada. Butuh alamat PoolManager/Universal Router yang terverifikasi dan PoolKey pool $NEXA (baru ada setelah graduation; sebelumnya $NEXA diperdagangkan di bonding curve Pons) | Berikan dokumen resmi Pons V2/Uniswap v4 di Robinhood Chain; tentukan jalur beli sebelum graduation | Terbuka |
| 12 | NVDA Stock Token mainnet **sudah ditemukan**: `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` (api.robinhood.com/rhj/assets; name "NVIDIA • Robinhood Token", 18 desimal) dan feed NVDA/USD terverifikasi (harga terbaca ~$205). Belum diuji: perilaku token (allowlist/pajak) | Fork test sebelum launch (docs/launch-checklist.md B) | Sebagian |
| 13 | Audit eksternal NexaLedger + splitter (wajib sebelum launch) | Pilih auditor; serahkan `docs/audit/README.md` | Terbuka (manusia) |
| 14 | `TREASURY_ADDRESS` sudah terisi di `.env`. `KEEPER_ADDRESS` masih kosong (dibutuhkan deploy kontrak fee; Final: Tahap 4) | Isi `KEEPER_ADDRESS` di `.env` | Sebagian |
| 15 | `LLM_MODEL_SMALL` sebelumnya `mimo-v2.5-asr` (model suara, HTTP 400). Sudah diganti menjadi `mimo-v2.6-flash` oleh pemilik proyek; diverifikasi 2026-10-31 dengan smoke test (kecil dan besar menjawab, prediksi lolos RiskGuard) | — | **Selesai** |
| 16 | **Sebagian selesai (2026-10-31):** `LlmPricing` kini per tier dan terisi harga SEMENTARA dari sumber pihak ketiga (flash $0,14 masuk / $0,28 keluar; pro $0,435 / $0,87 per 1 juta token). **Belum dari halaman harga resmi Xiaomi** (tidak terjangkau dari pencarian), harga cache-hit diabaikan (biaya tercatat = batas atas), dan base URL "token-plan" Anda mungkin memakai tarif paket lain | Cocokkan dengan halaman harga/tagihan akun MiMo Anda; jika beda, isi `LLM_PRICE_*_USD_MICROS` di env (tanpa ubah kode) | Sebagian |
| 17 | **Deploy NexaLedger ke testnet 46630** siap (simulasi sukses 2026-10-31: ~1,34 juta gas, ~0,000027 ETH; deployer 0,01 ETH; `owner` = deployer, `agent` = `AGENT_ADDRESS`). Meminta password keystore, jadi dijalankan pemilik proyek | Jalankan perintah di bagian "Perintah deploy testnet" di bawah tabel, lalu ketik "sudah deploy" | Menunggu pemilik |
| 18 | Saldo agent testnet 0 (faucet cooldown 24 jam, dari pemilik proyek 2026-10-31). Deploy tidak butuh saldo agent, tetapi `commit`/`reveal` dari worker butuh | Isi ~0,002 ETH ke `AGENT_ADDRESS` setelah cooldown | Menunggu pemilik |
| 19 | ~~Organisasi Supabase~~ project `nexa-ai-testnet` dibuat pemilik (us-east-1), `DATABASE_URL` tersimpan di `~/.config/nexa-ai/supabase-testnet.env`, migrasi sukses | — | **Selesai** |
| 20 | ~~Deploy Railway tertahan QUEUED~~ Antrean trial ~1 jam; percobaan pertama gagal karena belum ada start command (source masih `main`). Setelah source dipindah ke `testnet` dan build/start diatur via API, `worker` dan `api` **Online** (2026-10-31) | — | **Selesai** |
| 21 | Isi sendiri di dashboard Railway (service `worker`): `AGENT_PRIVATE_KEY`, `LLM_API_KEY`, `PREIMAGE_KEY` (32 byte hex, simpan cadangan). `NEXA_LEDGER_ADDRESS` setelah #17 | Dashboard Railway > worker > Variables | Menunggu pemilik |

## Perintah deploy testnet (jalankan sendiri)

```bash
# Jalankan di: ROOT/contracts
export AGENT_ADDRESS=$(grep -E '^AGENT_ADDRESS=' ../.env | cut -d= -f2 | tr -d '\r ')
echo "agent: $AGENT_ADDRESS"   # harus 0x35Ca52DAd343a80A3Be6b09091B74Dd3e5864561
forge script script/DeployNexaLedger.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account deployer --sender 0x1f4cD14B5CDD15436950d626CBCb0e21084F462D --broadcast
```

Akan diminta password keystore `deployer`. Output akhir mencetak `NexaLedger 0x...`. Setelah selesai, ketik "sudah deploy": saya membaca alamatnya dari `contracts/broadcast/DeployNexaLedger.s.sol/46630/run-latest.json`, memverifikasi kode, `owner`, dan `agent` on-chain, lalu mengisi `addresses/testnet.json`.
