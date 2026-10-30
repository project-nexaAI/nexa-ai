# DECISIONS

- **[di luar brief]** Foundry dipasang manual dari rilis GitHub (Windows, tanpa `foundryup`).
- **[di luar brief]** Railway CLI dipasang dari paket npm `@railway/cli`.
- Chain ID terverifikasi lewat RPC: testnet 46630, mainnet 4663. `chains.ts` hanya berisi data terverifikasi; sisanya `null`.
- `via_ir = true` di foundry.toml karena `reveal()` + event 12 argumen kena "stack too deep". Alternatif jika audit keberatan: pecah parameter jadi struct.
- Dependensi Foundry (forge-std, OpenZeppelin v5.1.0) tidak di-commit; dipasang lewat `scripts/install-contract-libs.sh`.
- `NexaLedger`: owner (Ownable2Step) mengatur `agent`, feed per aset, dan `minMoveBps` (snapshot per prediksi saat commit). Reveal memverifikasi round awal = round terakhir sebelum commit dan round akhir = round pertama sesudah jatuh tempo. Batasan: `roundId±1` hanya valid dalam satu phase Chainlink. Commit yang tidak pernah di-reveal terlihat lewat selisih `commitCount - revealCount`.
- RiskGuard: pemblokiran beli/jual sengaja ketat (termasuk bentuk lampau "sold/dijual"); laporan data memakai kata lain ("akumulasi", "distribusi", "transfer masuk/keluar"). Prompt persona harus mengikuti ini. Over-block ditangani reviewer manusia.
- RiskGuard: `dataComplete` default `false` (fail closed); jawaban "tidak tahu" lolos meski data tidak lengkap. Disclaimer wajib di `prediction`, `risk_report`, `mention_reply` (frasa: "bukan nasihat keuangan" / "not financial advice" / "NFA").
- RiskGuard: setiap alamat 0x di teks harus ada di `tokens` (tool result) dengan umur >= 3600 detik; selain itu diblokir.
