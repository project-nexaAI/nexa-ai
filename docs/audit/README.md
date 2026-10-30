# Paket audit NEXA: NexaLedger, BurnVault, FeeSplitter

Untuk auditor eksternal. Audit wajib sebelum launch $NEXA (brief minggu 9). **Dokumen ini bukan hasil audit.**
Tinjauan internal yang sudah dilakukan hanya bantuan AI (subagent `contract-reviewer`) dan test; tidak menggantikan audit manusia.

## 1. Lingkup

| Berkas | Fungsi |
| --- | --- |
| `contracts/src/NexaLedger.sol` | Commit-reveal prediksi; skor otomatis dari harga Chainlink |
| `contracts/src/BurnVault.sol` | Menampung aset pasangan, menukar ke $NEXA, membakar. **Tanpa jalan menarik dana** |
| `contracts/src/FeeSplitter.sol` | `CreatorFeeSplitter` (30% BurnVault / 70% treasury), `ProtocolFeeSplitter` (20% / 80%) |
| `contracts/src/interfaces/` | `ISwapper`, `AggregatorV3Interface` |

Di luar lingkup (belum ada atau milik pihak lain): kontrak Pons V2, Uniswap v4, Chainlink, token NVDA/$NEXA, dan **adaptor swapper Uniswap v4 yang belum ditulis** (lihat BLOCKERS #11).

Toolchain: Solidity 0.8.28 (`via_ir`, optimizer 200), OpenZeppelin 5.1.0, Foundry 1.8.7. Pasang dependensi: `scripts/install-contract-libs.sh`.

```bash
# Jalankan di: ROOT/contracts
forge test          # 66 test (unit + fuzz 512 run)
forge snapshot      # .gas-snapshot
```

## 2. Aliran dana

```
Pons V2 (fee 1%, bagian creator, dibayar dalam NVDA)
   -> CreatorFeeSplitter.distribute()   [tanpa izin]
        30% -> BurnVault   70% -> treasury (akun MetaMask, hanya menerima)
Protokol (Pro, API, Ask NEXA, sponsor)
   -> ProtocolFeeSplitter.distribute()
        20% -> BurnVault   80% -> operasional (treasury)
BurnVault.burn(minNexaOut)  [keeper]
   -> swapper.swapExactInput(NVDA -> $NEXA) -> kirim seluruh $NEXA ke 0xdEaD
```

## 3. Peran dan kepercayaan

| Peran | Kemampuan | Tidak bisa |
| --- | --- | --- |
| Siapa pun | `distribute()`, `burnHeld()` | Mengubah rasio/alamat; menarik dana |
| Keeper (BurnVault) | `burn(minNexaOut)` | Menarik dana tanpa menerima >= `minNexaOut` $NEXA |
| Owner (BurnVault) | `setNexa` (sekali), `setKeeper`, `proposeSwapper` -> `executeSwapper` (timelock 3 hari), `cancelSwapper` | Menarik dana; `renounceOwnership` (dinonaktifkan) |
| Agent (NexaLedger) | `commit`, `reveal` | Mengubah feed/skor |
| Owner (NexaLedger) | `setAgent`, `setFeed`, `setMinMoveBps` | Mengubah prediksi yang sudah di-commit |

Splitter: tanpa owner, semua alamat `immutable`, rasio `constant`.

## 4. Invarian yang diklaim

1. **Rasio hardcode:** 3000 bps (creator) dan 2000 bps (protocol) adalah `constant`; tidak ada setter.
2. **Konservasi:** `distribute()` selalu: `toBurnVault + toTreasury == saldo`, tanpa debu tertinggal (sisa pembulatan ke treasury).
3. **BurnVault:** aset pasangan hanya keluar lewat `burn()`; keluar hanya jika saldo $NEXA vault naik >= `minNexaOut` (> 0) dari snapshot sebelum swap; seluruh $NEXA vault lalu dikirim ke `0xdEaD`; allowance swapper kembali 0.
4. Tidak ada fungsi transfer/rescue/sweep/execute dan tidak ada `receive`/`fallback` di BurnVault.
5. **NexaLedger:** hash `keccak256(abi.encode(string,address,uint8,uint32,bytes32))`; round awal = round terakhir sebelum commit, round akhir = round pertama sesudah jatuh tempo.

Test yang relevan: `contracts/test/*.t.sol` (mis. `test_noWithdrawSelectors`, `testFuzz_burnConservation`, `testFuzz_creator_conservesAndRatio`, `test_burn_reentrancyBlocked`).

## 5. Risiko yang diketahui dan diterima (tolong dinilai ulang)

1. **Swapper jahat / `minNexaOut` terlalu rendah** dapat menukar aset pada harga buruk (nilai bocor ke pihak lain). Dana tidak bisa dikirim ke alamat sembarang. Mitigasi: timelock swapper 3 hari; `minNexaOut` dihitung keeper di luar chain.
2. **Keeper dirotasi seketika** oleh owner (tanpa timelock) supaya keeper yang bocor bisa diganti cepat. Konsekuensi: owner yang bocor dapat memasang keeper jahat (dengan swapper sah, hanya bisa sandwich). Pertimbangkan batas per-burn atau interval minimum.
3. **Token Stock Token berpembatasan** (allowlist/blocklist): bila vault/treasury/splitter tidak boleh menerima NVDA, `distribute()` revert dan fee tertahan (splitter immutable, tanpa rescue). **Gerbang launch:** fork test dengan token asli (lihat `docs/launch-checklist.md`).
4. **Fee-on-transfer / rebasing** tidak didukung. `totalNexaBurned` ikut menghitung $NEXA yang disumbangkan (informasional).
5. "Burn" = transfer ke `0xdEaD`, bukan mengurangi `totalSupply`. Token $NEXA dari Pons harus mengizinkan transfer ke alamat itu dan ke vault tanpa pajak.
6. Token yang salah kirim ke splitter/vault (bukan aset pasangan) tertahan permanen (kecuali $NEXA di vault: `burnHeld()`).
7. Sandwich pada `burn()` mungkin; berkurang bila sequencer FIFO.
8. Swapper yang diusulkan tidak punya kedaluwarsa.

## 6. Temuan tinjauan internal AI dan statusnya

| # | Temuan | Tingkat | Status |
| --- | --- | --- | --- |
| 1 | `renounceOwnership` dapat mengunci vault | Medium | **Diperbaiki** (revert) di BurnVault dan NexaLedger + test |
| 2 | `setNexa` satu kali tanpa validasi | Medium | **Diperbaiki**: wajib kontrak (`code.length > 0`) + test. Tetap verifikasi di fork sebelum memanggil |
| 3 | Token berpembatasan dapat menggagalkan `distribute()` | Medium | **Didokumentasikan**: gerbang launch (risiko 3) |
| 4 | Splitter tidak memeriksa pasangan aset vault | Low | **Diperbaiki**: konstruktor memeriksa vault adalah kontrak, `pairAsset` cocok, treasury != vault + test |
| 5 | Rotasi keeper instan | Low | **Diterima/didokumentasikan** (risiko 2) |
| 6 | Underflow pada akuntansi `spent` | Low | **Diperbaiki**: pengurangan aman + test |
| 7 | Fee-on-transfer | Low | Didokumentasikan (risiko 4) |
| 8-10 | Token salah kirim, semantik burn, pembulatan | Info | Didokumentasikan |

Peninjau tidak menemukan jalan mengeluarkan aset pasangan dari BurnVault selain `burn()`. NexaLedger tidak ditinjau oleh peninjau itu.

## 7. Pertanyaan untuk auditor

- Apakah desain satu-kali `setNexa` + swapper ber-timelock cukup, atau sebaiknya swapper dikunci immutable setelah launch?
- Perlu batas on-chain pada `burn()` (jumlah per panggilan, interval) untuk membatasi keeper yang bocor?
- Pola pull per-sisi pada splitter agar satu penerima yang diblokir tidak menahan sisi lain?
- Verifikasi round Chainlink pada batas phase aggregator (`roundId +/- 1` hanya valid dalam satu phase).

## 8. Estimasi biaya deploy (dry run mainnet 4663, tanpa broadcast)

Simulasi `forge script` pada RPC mainnet, tanggal 2026-10-31, harga gas ~0,0201 gwei. **Alamat aset pasangan, treasury, dan keeper memakai placeholder** (belum terverifikasi), jadi angka hanya estimasi.

| Script | Gas | Perkiraan biaya |
| --- | --- | --- |
| `DeployNexaLedger` | 1.366.095 | ~0,000055 ETH |
| `DeployFees` (BurnVault + 2 splitter) | 2.012.627 | ~0,000081 ETH |

Perintah: lihat komentar di `contracts/script/DeployFees.s.sol`. Mainnet tidak pernah di-broadcast oleh Claude.
