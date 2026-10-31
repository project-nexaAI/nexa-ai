# BLOCKERS

| # | Blocker                                                                                                                                                                 | Tindakan manusia                                                                                  | Status  |
| - | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------- |
| 1 | Login CLI dicek 2026-10-31: `gh` (akun Bayusmd; terpasang di `C:\Program Files\GitHub CLI`, tidak ada di PATH Git Bash), `supabase`, `railway`, `vercel` semuanya login | — | **Selesai** |
| 2 | Keystore `deployer` dan `nexa-agent` diimpor, dan alamatnya **cocok** (`deployer` = `0x1f4cD14B5CDD15436950d626CBCb0e21084F462D`; `nexa-agent` = `AGENT_ADDRESS`). Dikonfirmasi pemilik proyek 2026-10-31 (dicek dengan password; tidak dapat diverifikasi otomatis) | — | **Selesai** |
| 3 | `AGENT_ADDRESS` dan `TREASURY_ADDRESS` **terisi dan valid** di `.env`, ketiga alamat berbeda (diverifikasi 2026-10-31) | Ketik "Wallet sudah diisi" agar field `agent`/`treasury` di `addresses/<network>.json` diperbarui | Sebagian: menunggu perintah |
| 4 | `LLM_API_KEY` terisi dan terverifikasi 2026-10-31 (model besar dan kecil menjawab, mode JSON jalan) | — | **Selesai** |
| 5 | Saldo deployer testnet terisi: 0,01 ETH (dicek 2026-10-31 dengan `cast balance`) | — | **Selesai** |
| 6 | Alamat belum terverifikasi: Pons hook/graduation executor, Chainlink ETH/NVDA, USDG, Uniswap v4 PoolManager. Factory brief tidak punya code di testnet (ada di mainnet) | Berikan link dokumen resmi, atau Claude cari di Tahap 1; testnet memakai mock bila feed tidak ada | Terbuka |
| 7 | ABI Pons V2 tidak bisa diambil otomatis: Blockscout mainnet di balik Cloudflare (403), explorer testnet tidak mengenal alamat factory brief. Indexer Envio (launch/trade/graduation) tertahan | Berikan ABI/link dokumen resmi Pons V2 (factory, hook, graduation executor) atau ekspor ABI dari Blockscout lewat browser | Terbuka |
| 8 | HTML desain: `__X_HANDLE__` belum diberikan (tautan "Follow on X" saat ini `#`) | Isi `NEXT_PUBLIC_X_HANDLE` (tanpa @) dan `NEXT_PUBLIC_SITE_URL` | Terbuka |
| 9 | Halaman `/privacy` dirujuk footer desain tetapi tidak ada. (`og-image.png` sudah dibuat dari desain, lihat DECISIONS.) | Kirim teks kebijakan privasi | Terbuka |
| 10 | Desain belum mencakup halaman: detail prediksi, NEXA vs KOL (leaderboard), Rug radar penuh, Burn tracker | Kirim desain halaman tersebut; sementara hanya ada endpoint + fixture | Terbuka |
| 11 | Tahap 4: adaptor swapper Uniswap v4 (NVDA -> $NEXA) belum ada. Butuh alamat PoolManager/Universal Router yang terverifikasi dan PoolKey pool $NEXA (baru ada setelah graduation; sebelumnya $NEXA diperdagangkan di bonding curve Pons) | Berikan dokumen resmi Pons V2/Uniswap v4 di Robinhood Chain; tentukan jalur beli sebelum graduation | Terbuka |
| 12 | Alamat NVDA Stock Token (aset pasangan) dan feed Chainlink NVDA di mainnet belum terverifikasi; perilaku token (allowlist/pajak) belum diuji | Kirim alamat resmi; fork test sebelum launch (docs/launch-checklist.md B) | Terbuka |
| 13 | Audit eksternal NexaLedger + splitter (wajib sebelum launch) | Pilih auditor; serahkan `docs/audit/README.md` | Terbuka (manusia) |
| 14 | `TREASURY_ADDRESS` sudah terisi di `.env`. `KEEPER_ADDRESS` masih kosong (dibutuhkan deploy kontrak fee; Final: Tahap 4) | Isi `KEEPER_ADDRESS` di `.env` | Sebagian |
| 15 | `LLM_MODEL_SMALL` sebelumnya `mimo-v2.5-asr` (model suara, HTTP 400). Sudah diganti menjadi `mimo-v2.6-flash` oleh pemilik proyek; diverifikasi 2026-10-31 dengan smoke test (kecil dan besar menjawab, prediksi lolos RiskGuard) | — | **Selesai** |
| 16 | Harga token MiMo tidak diketahui, jadi biaya LLM tercatat 0 USD (jumlah token tercatat benar). Asumsi brief: LLM ~$800/bulan perlu diukur | Berikan harga per 1 juta token (masuk/keluar) agar `LlmPricing` bisa diisi | Terbuka |
| 17 | **Deploy NexaLedger ke testnet 46630** siap (simulasi sukses 2026-10-31: ~1,34 juta gas, ~0,000027 ETH; deployer 0,01 ETH; `owner` = deployer, `agent` = `AGENT_ADDRESS`). Meminta password keystore, jadi dijalankan pemilik proyek | Jalankan perintah di bagian "Perintah deploy testnet" di bawah tabel, lalu ketik "sudah deploy" | Menunggu pemilik |
| 18 | Saldo agent testnet 0 (faucet cooldown 24 jam, dari pemilik proyek 2026-10-31). Deploy tidak butuh saldo agent, tetapi `commit`/`reveal` dari worker butuh | Isi ~0,002 ETH ke `AGENT_ADDRESS` setelah cooldown | Menunggu pemilik |
| 19 | ~~Organisasi Supabase~~ project `nexa-ai-testnet` dibuat pemilik (us-east-1), `DATABASE_URL` tersimpan di `~/.config/nexa-ai/supabase-testnet.env`, migrasi sukses | — | **Selesai** |
| 20 | Deploy Railway `worker` dan `api` tertahan di status QUEUED sejak 2026-10-31 11:00 (+07). Penyebab belum diketahui (kemungkinan: akun Railway butuh verifikasi/plan, atau GitHub App Railway belum punya akses ke org `project-nexaAI`) | Buka project di dashboard Railway, cek pesan di tab Deployments; install GitHub App Railway di org bila diminta | Terbuka |
| 21 | Isi sendiri di dashboard Railway (service `worker`): `AGENT_PRIVATE_KEY`, `LLM_API_KEY`, `PREIMAGE_KEY` (32 byte hex, simpan cadangan). `NEXA_LEDGER_ADDRESS` setelah #17 | Dashboard Railway > worker > Variables | Menunggu pemilik |

## Perintah deploy testnet (jalankan sendiri)

```bash
# Jalankan di: ROOT/contracts
export AGENT_ADDRESS=$(grep -E '^AGENT_ADDRESS=' ../.env | cut -d= -f2 | tr -d '\r ')
echo "agent: $AGENT_ADDRESS"   # harus 0x35Ca52DAd343a80A3Be6b09091B74Dd3e5864561
forge script script/DeployNexaLedger.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account deployer --sender 0x1f4cD14B5CDD15436950d626CBCb0e21084F462D --broadcast
```

Akan diminta password keystore `deployer`. Output akhir mencetak `NexaLedger 0x...`. Setelah selesai, ketik "sudah deploy": saya membaca alamatnya dari `contracts/broadcast/DeployNexaLedger.s.sol/46630/run-latest.json`, memverifikasi kode, `owner`, dan `agent` on-chain, lalu mengisi `addresses/testnet.json`.
