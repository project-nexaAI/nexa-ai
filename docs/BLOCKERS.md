# BLOCKERS

| # | Blocker | Tindakan manusia | Status |
| --- | --- | --- | --- |
| 1 | `gh`, `supabase`, `railway`, `vercel` belum dicek login | Jalankan `gh auth login`, `supabase login`, `railway login`, `vercel login` | Terbuka |
| 2 | Keystore `deployer` / `nexa-agent` belum dicek (Foundry baru dipasang) | Lihat `docs/SETUP-WALLETS.md` bagian 2 | Terbuka |
| 3 | `AGENT_ADDRESS` & `TREASURY_ADDRESS` kosong | Isi di `.env`, lalu ketik "Wallet sudah diisi" | Terbuka |
| 4 | `LLM_API_KEY` kosong | Isi sendiri; sampai itu pakai mock LLM | Terbuka |
| 5 | Saldo deployer testnet 0 (cek 2026-10-30) | Isi dari https://faucet.testnet.chain.robinhood.com | Terbuka |
| 6 | Alamat belum terverifikasi: Pons hook/graduation executor, Chainlink ETH/NVDA, USDG, Uniswap v4 PoolManager. Factory brief tidak punya code di testnet (ada di mainnet) | Berikan link dokumen resmi, atau Claude cari di Tahap 1; testnet memakai mock bila feed tidak ada | Terbuka |
