# Checklist launch $NEXA di Pons V2

**Dilakukan oleh manusia.** Claude hanya menyiapkan daftar ini dan tidak pernah men-deploy ke mainnet atau meluncurkan token.
Centang berurutan; jangan lompat. Rincian risiko: `docs/audit/README.md`.

## A. Prasyarat

- [ ] Audit eksternal NexaLedger, BurnVault, dan splitter selesai; semua temuan High/Medium ditutup dan test diperbarui.
- [ ] Alamat **NVDA Stock Token** (aset pasangan) terverifikasi dari dokumen resmi, dan feed **Chainlink NVDA/USD** ada di mainnet.
- [ ] Konsultasi hukum (OJK) selesai sebelum fitur berbayar aktif (`PAID_FEATURES_ENABLED`).
- [ ] 30 hari prediksi harian ter-commit sudah tampil di `/proof` (Tahap 3).
- [ ] `TREASURY_ADDRESS` (akun MetaMask treasury; kunci tidak pernah di backend) dan `KEEPER_ADDRESS` terisi.

## B. Gerbang teknis (fork test dengan token asli)

- [ ] Fork mainnet: NVDA dapat ditransfer ke BurnVault, treasury, dan splitter; `distribute()` berhasil.
- [ ] Tidak ada allowlist/blocklist/pajak transfer NVDA yang memblokir vault, splitter, swapper, atau pool.
- [ ] Adaptor swapper (Uniswap v4 atau jalur Pons) ditulis, diaudit, dan lolos fork test: NVDA -> $NEXA dengan `minNexaOut` > 0.

## C. Deploy kontrak fee (manusia, keystore `deployer`)

- [ ] Cek: `cast chain-id` = 4663, `cast wallet address --account deployer` = `0x1f4cD14B5CDD15436950d626CBCb0e21084F462D`, saldo cukup.
- [ ] Dry run dulu (tanpa `--broadcast`), cocokkan estimasi biaya.
- [ ] Deploy `DeployFees` (BurnVault, CreatorFeeSplitter, ProtocolFeeSplitter); verifikasi sumber di Blockscout.
- [ ] Baca on-chain: `CREATOR_FEE_BURN_BPS() == 3000`, `PROTOCOL_FEE_BURN_BPS() == 2000`, `burnVault()`, `treasury()`, `pairAsset()` sesuai.
- [ ] Catat alamat di `packages/contracts-abi/addresses/mainnet.json`.

## D. Launch $NEXA (di Pons V2)

- [ ] Opening buy lewat **launch-and-buy** dan **diumumkan**.
- [ ] Creator tax tambahan **0%**.
- [ ] Penerima fee creator = alamat **CreatorFeeSplitter**.
- [ ] Rasio 30/20 terbaca hardcode on-chain (lihat C).

## E. Setelah launch

- [ ] Verifikasi alamat token $NEXA di fork: kontrak, transfer ke `0xdEaD` diizinkan, tidak ada pajak untuk transfer ke vault.
- [ ] `BurnVault.setNexa(<token>)` (hanya sekali; salah alamat mengunci vault).
- [ ] `proposeSwapper(<adaptor>)`, tunggu 3 hari, `executeSwapper()`.
- [ ] Uji `burn(minNexaOut)` dengan jumlah kecil; pastikan hasil terbakar dan allowance swapper 0.
- [ ] Pindahkan kepemilikan (Ownable2Step): `transferOwnership` lalu `acceptOwnership`; `renounceOwnership` memang dinonaktifkan.
- [ ] Aktifkan burn tracker (`/burn`) setelah indexer membaca event `Burned`.

## F. Aturan emas

NEXA tidak pernah membahas harga $NEXA dan tidak pernah menyuruh membelinya. RiskGuard memblokirnya di kode; pengumuman hanya bertipe `technical_announcement` / `burn_report`.

## Laporan dry run mainnet (chain 4663, 2026-10-31)

Tanpa `--broadcast`; memakai `--sender` deployer (keystore tidak dibuka). Gas price saat simulasi ~0,02 gwei (base fee).

| Script | Gas (estimasi) | Biaya (estimasi) | Hasil |
| --- | --- | --- | --- |
| `DeployNexaLedger` | 1.342.632 | ~0,0000538 ETH | Sukses |
| `DeployFees` (BurnVault + CreatorFeeSplitter + ProtocolFeeSplitter) | 2.017.333 | ~0,0000808 ETH | Sukses |

Catatan: `DeployFees` disimulasikan dengan **placeholder**: `PAIR_ASSET` = `0x…dEaD` (NVDA belum terverifikasi, BLOCKERS #12) dan `KEEPER_ADDRESS` = alamat agent (belum ditentukan, #14). Angka gas valid; alamat hasil simulasi bukan alamat final. Saldo deployer di mainnet 0 ETH: perlu diisi sebelum deploy sungguhan (dilakukan manusia).
