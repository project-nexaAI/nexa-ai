# PROGRESS

## Tahap 0 — Setup (selesai kecuali blocker manusia)
- [x] `.claude/settings.json`, `.gitignore`, `.env.example`, hooks `.githooks/` (`core.hooksPath` aktif)
- [x] pnpm, gh, supabase, vercel, railway terpasang (login belum dicek: lihat BLOCKERS #1)
- [x] Foundry v1.8.7 terpasang di ~/.foundry/bin (tambahkan ke PATH)
- [x] Skill (8) & subagent (2)
- [x] `pnpm check:wallets`, `addresses/<network>.json`
- [x] Branch `testnet` & `mainnet` (lokal)
- [~] `chains.ts`: chain ID terverifikasi; alamat Pons/Chainlink/USDG/Uniswap masih `null` (BLOCKERS #6)

## Tahap 2 — RiskGuard
- [x] `@nexa-ai/riskguard`: 11 aturan brief, 95 test (ID & EN, evasi homoglyph/leet/spasi/zero-width), log hanya hash konten
- [x] `apps/worker`: antrian persetujuan (`enqueuePost`: RiskGuard -> cek commit -> antrian, tunda 15 menit) + CLI `review list|show|approve|reject`, 11 test integrasi Postgres
- [ ] Red-team oleh subagent `riskguard-reviewer`

## Tahap 1 — berjalan
- [x] `NexaLedger` + 24 test (unit + fuzz) lolos, `forge snapshot`, ABI di `packages/contracts-abi/abi/`
- [x] Vektor hash bersama `packages/shared/test-vectors/commit-reveal.json` (sisi Solidity)
- [x] Script deploy `contracts/script/DeployNexaLedger.s.sol` (belum dijalankan: butuh keystore + saldo)
- [x] Util hash TS (`computePredictionHash`) + Vitest memakai vektor yang sama (4 test lolos)
- [x] Deploy localhost (Anvil, alamat di addresses/localhost.json; agent = akun Anvil 1)
- [ ] Deploy testnet (butuh keystore deployer + saldo: BLOCKERS #2, #5)
- [x] Turborepo, docker-compose Postgres, `@nexa-ai/db` (Drizzle, 8 tabel, migrasi 0000 teruji di Postgres Docker)
- [ ] Indexer Envio (menunggu ABI + alamat Pons, BLOCKERS #6)
