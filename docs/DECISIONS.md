# DECISIONS

- **[di luar brief]** Foundry dipasang manual dari rilis GitHub (Windows, tanpa `foundryup`).
- **[di luar brief]** Railway CLI dipasang dari paket npm `@railway/cli`.
- Chain ID terverifikasi lewat RPC: testnet 46630, mainnet 4663. `chains.ts` hanya berisi data terverifikasi; sisanya `null`.
- `via_ir = true` di foundry.toml karena `reveal()` + event 12 argumen kena "stack too deep". Alternatif jika audit keberatan: pecah parameter jadi struct.
