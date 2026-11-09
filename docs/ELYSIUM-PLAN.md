# Rencana NEXA di Elysium testnet (chain 99801)

Sumber: "NEXA on Elysium, Developer Brief (Testnet)", 9 Nov 2026, @ronald. Jika dokumen ini dan brief berbeda, ikuti brief dan catat di `DECISIONS.md`.

## Tujuan
- Deploy `NexaLedger` di Elysium testnet (99801) dan jalankan satu prediksi HYPE penuh: commit -> post `dry` -> reveal -> skor.
- Robinhood Chain tetap rumah utama. Produksi tidak boleh terganggu.

## Batasan
- Jangan ubah Railway `nexa-ai-mainnet` dan Supabase mainnet. Elysium memakai project Supabase dan Railway baru (dibuat pemilik).
- `CreatorFeeSplitter`, `ProtocolFeeSplitter`, `BurnVault` tidak di-deploy di Elysium.
- X tetap `dry` sampai ada izin tertulis pemilik. RiskGuard berlaku penuh, termasuk token < 1 jam dilarang.
- Elysium tidak tampil di landing sampai pemilik menyetujui pengumuman.

## Peran NEXA di Elysium
- Rug Calls (inti): kartu risiko token launchpad berumur >= 1 jam, hash dikunci on-chain sebelum post.
- Graduation Watch, HYPE Daily Call, rekam jejak lintas chain.
- Testnet hanya membuktikan mesin commit-reveal. Rug Calls on-chain menunggu keputusan pemilik (off-chain dulu, atau kontrak `NexaRiskLedger` yang wajib diaudit).

## Teknis jaringan
- Arbitrum Nitro; Foundry dan viem jalan tanpa perubahan. Gas: HYPE.
- RPC `https://testnet-rpc.elysium.kinetiq.xyz`; tanpa WebSocket publik.
- Blok ~130 ms: indexer memakai batch `getLogs` besar.
- `elysiumTestnet` bawaan viem adalah chain 1338 (salah). Pakai `defineChain` untuk 99801.
- Explorer: `https://elysium.kinetiq.xyz/testnet-explorer/address/<alamat>` dan `/transaction/<hash>` (bukan `/tx/`).
- Tidak ada Chainlink: `MockV3Aggregator` HYPE/USD dan ETH/USD (8 desimal) + keeper.

## Keputusan desain
- Satu codebase, `chainId` sebagai parameter di semua layer; tidak ada fork.
- Database terpisah: API Elysium berjalan sebagai service baru dengan `CHAIN_ID` dan `DATABASE_URL` sendiri. `?chain=robinhood|elysium-testnet` divalidasi terhadap chain service itu; default `robinhood`. Web memetakan chain ke URL API masing-masing.
- Setiap respons API memuat `chainId` dan `explorerBaseUrl` (+ path tx per chain).
- Perilaku Robinhood mainnet harus identik sebelum dan sesudah, dibuktikan test regresi.

## Pekerjaan per komponen
| Komponen | Pekerjaan |
| --- | --- |
| Kontrak | Deploy `NexaLedger` tanpa ubah kode; dua mock feed (HYPE, ETH); `setFeed`; agent `0x35Ca52DAd343a80A3Be6b09091B74Dd3e5864561`; verifikasi Blockscout; `addresses/elysium-testnet.json`; ekspor ke `packages/contracts-abi` |
| Worker | Job menerima `chainId`; service `worker-elysium-testnet`; keeper harga HYPE dari API Hyperliquid; prediksi harian HYPE (horizon uji 1 jam); `APPROVAL_MODE=manual`; Rug Calls off-chain lewat RiskGuard |
| Indexer | Konfigurasi per chain; event `NexaLedger` di 99801; riset alamat Pump.fun/Ascend/Montra dari docs resmi sebelum menulis kode launchpad; batch `getLogs` besar |
| API | `?chain=` di `/proof`, `/predictions/:id`, `/rug-radar`, `/leaderboard`; zod, `openapi.json`, fixture, `api-client` |
| Web | Pemilih chain di Proof dan Rug radar, label "Elysium testnet", tidak di landing |

## Env service Elysium
```
CHAIN_ID=99801
RPC_URL=https://testnet-rpc.elysium.kinetiq.xyz
RPC_WS_URL=<provider, opsional>
EXPLORER_BASE_URL=https://elysium.kinetiq.xyz/testnet-explorer
EXPLORER_TX_PATH=/transaction/
NEXA_LEDGER_ADDRESS=<setelah deploy>
FEED_HYPE_USD=<setelah deploy>
FEED_ETH_USD=<setelah deploy>
X_POST_MODE=dry
APPROVAL_MODE=manual
```
Nilai rahasia (`AGENT_PRIVATE_KEY`, `KEEPER_PRIVATE_KEY`, `DATABASE_URL`, kunci LLM, Telegram) diisi pemilik di dashboard.

## Urutan kerja (Claude)
1. Konfigurasi chain bersama (`chains.ts`, `defineChain`, pembuat URL explorer) + test regresi Robinhood.
2. Script deploy 99801: cek nonce, `NexaLedger`, mock feed HYPE/ETH, `setFeed`.
3. Worker: `chainId` per job, keeper HYPE, prediksi harian HYPE.
4. API `?chain=` + skema, openapi, fixture, api-client.
5. Riset launchpad dan indexer Elysium.
6. Pemilih chain di web (tersembunyi dari landing).
7. Catat di `DECISIONS.md`, `PROGRESS.md`, `BLOCKERS.md`.

## Langkah deploy (pemilik)
1. Cek nonce: `cast nonce 0x1f4cD14B5CDD15436950d626CBCb0e21084F462D --rpc-url https://testnet-rpc.elysium.kinetiq.xyz`. Harus sama dengan nonce saat ledger di-deploy di Robinhood agar alamat tetap `0xEF1f...81C0`. Jangan kirim transaksi lain dari deployer sebelum ledger.
2. Isi HYPE (faucet) ke deployer, agent `0x35Ca...4561`, dan keeper.
3. Deploy `NexaLedger` lebih dulu (butuh password keystore, dijalankan pemilik).
4. Deploy mock feed, lalu `setFeed`.
5. Verifikasi: `forge verify-contract <alamat> <path>:<Nama> --chain 99801 --verifier blockscout --verifier-url https://elysium.kinetiq.xyz/api/ --watch`.
6. Jalankan `worker-elysium-testnet`, commit satu prediksi HYPE horizon 1 jam.
7. Laporkan 9 link (ledger, tx deploy + blok, dua feed, `setFeed`, commit, reveal + skor, status verifikasi, API `/proof?chain=elysium-testnet`).

## Selesai bila
- [ ] `NexaLedger` ter-deploy dan terverifikasi di Elysium testnet
- [ ] Feed mock terdaftar via `setFeed` dan di-update keeper
- [ ] Satu prediksi ter-commit, ter-reveal, ter-skor di 99801
- [ ] API mengembalikan data Elysium lewat `chain`
- [ ] Semua link dilaporkan ke pemilik

## Pertanyaan terbuka
- Skor Rug Calls on-chain: off-chain atau `NexaRiskLedger` (wajib audit sebelum mainnet).
- Sumber harga mainnet Elysium (kandidat: adaptor precompile HyperCore, ~4 minggu setelah mainnet).
- Alamat launchpad Elysium belum dikonfirmasi.
- Nonce deployer di 99801 bila sudah terpakai: alamat ledger berbeda (aman, hanya kehilangan cerita "satu alamat"); laporkan sebelum deploy.
- Waktu ke mainnet Elysium: setelah reveal pertama Robinhood (14-15 Nov), testnet stabil 7 hari, sumber harga mainnet jelas.
