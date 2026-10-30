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
- RiskGuard (hasil red-team, 96 temuan): 94 diperbaiki. Dua diterima sebagai over-block yang disengaja dan ekspektasi test dibalik: kata buy/sell/beli/jual tetap diblokir juga di laporan data ("buy volume", "40 buys"), dan `xxx.info`/TLD tanpa spasi setelah titik ("stabil.Info") diblokir karena identik dengan domain.
- RiskGuard: target harga hanya diblokir bila ada isyarat ke depan (will/akan/menuju/target/fair value, atau "to $X" tanpa kata kerja laporan). Laporan lampau ("moved to $142.10", "bergerak ke Rp 16000") lolos.
- RiskGuard: jawaban "tidak tahu" hanya lolos jika tanpa angka dan tanpa kata sambung kontras (tapi/but/however...). Token angka murni tidak di-leet ("531 holders" aman).
- RiskGuard: harga/ajakan terkait NEXA diblokir walau tanpa `$` bila kata harga berdampingan dengan "NEXA" (maks. satu kata di antara). Batasan diketahui: leet spasi pada digit ("s e 1 1") belum terdeteksi.
- Catatan tooling: tool Write mengubah escape `\uXXXX` di source menjadi karakter sungguhan. Gunakan `\p{..}` / `String.fromCharCode`, atau tulis lewat Bash.
