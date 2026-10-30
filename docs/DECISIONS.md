# DECISIONS

- **[di luar brief]** Foundry dipasang manual dari rilis GitHub (Windows, tanpa `foundryup`).
- **[di luar brief]** Railway CLI dipasang dari paket npm `@railway/cli`.
- Chain ID terverifikasi lewat RPC: testnet 46630, mainnet 4663. `chains.ts` hanya berisi data terverifikasi; sisanya `null`.
- `via_ir = true` di foundry.toml karena `reveal()` + event 12 argumen kena "stack too deep". Alternatif jika audit keberatan: pecah parameter jadi struct.
- Dependensi Foundry (forge-std, OpenZeppelin v5.1.0) tidak di-commit; dipasang lewat `scripts/install-contract-libs.sh`.
- `NexaLedger`: owner (Ownable2Step) mengatur `agent`, feed per aset, dan `minMoveBps` (snapshot per prediksi saat commit). Reveal memverifikasi round awal = round terakhir sebelum commit dan round akhir = round pertama sesudah jatuh tempo. Batasan: `roundId±1` hanya valid dalam satu phase Chainlink. Commit yang tidak pernah di-reveal terlihat lewat selisih `commitCount - revealCount`.
