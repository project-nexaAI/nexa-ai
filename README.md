# NEXA

**The superintelligence influencer. Every call on-chain. No deleted tweets.**

NEXA is an AI agent on X that reads Robinhood Chain activity around the clock, publishes analysis, and proves every prediction on-chain *before* posting it. Win rate cannot be faked or deleted.

[Website](https://nexaagent.tech) · [X: @NexaAgentX](https://x.com/NexaAgentX) · [Explorer](https://robinhoodchain.blockscout.com)

---

## What NEXA does

- **Stock Token summary.** Biggest Stock Token moves and the gap between DEX price and the Chainlink oracle.
- **Pons V2 radar.** Busiest launches and graduations, with red flags such as high creator tax and concentrated holders.
- **Contract analysis.** Reply to a mention with a risk summary for an address.
- **Prediction of the Day.** One prediction committed on-chain, then scored automatically seven days later.

"Superintelligence" is a persona. The intelligence is shown with data, not claimed.

## Proof of Intelligence

Every prediction goes through commit-reveal in `NexaLedger`:

1. The agent builds the preimage and computes
   `keccak256(abi.encode(string text, address asset, uint8 direction, uint32 horizon, bytes32 salt))`.
2. `commit(hash)` is sent on-chain and confirmed. Only then is the post published.
3. The salt stays secret, encrypted at rest, until the horizon is reached.
4. `reveal()` publishes the preimage with Chainlink round IDs. The contract verifies round timestamps and scores the call automatically.

Nothing can be edited or removed after the commit.

## Architecture

| Layer | Component | Role |
| --- | --- | --- |
| Data | Indexer + Pons V2 events | Launches, trades, graduations, whale transfers, Stock Token prices |
| Data | Chainlink Data Feeds | Official prices for analysis and for scoring predictions |
| Brain | LLM with tool calling | Analysis and summaries, persona prompts |
| Filter | `RiskGuard` (plain code, not AI) | Blocks buy/sell calls and price targets, enforces disclaimers |
| Proof | `NexaLedger` (Solidity) | Commit before posting, reveal at maturity, automatic scoring |
| Publish | X API, Telegram, web dashboard | Public posts, Pro alerts, Proof of Intelligence page |

Pipeline rules:

1. No post leaves before it passes RiskGuard.
2. A prediction is never posted before its commit transaction is confirmed.
3. Data comes only from the indexer and the oracle. Every number in a post traces back to a tool result.
4. Human approval queue for posts, controlled by config.
5. Public X posts are delayed 15 minutes after Pro alerts.

## Repository layout

```
apps/
  api/        Fastify + zod + OpenAPI: proof, rug radar, burn, leaderboard, Pro, Ask NEXA, Signals
  indexer/    Pons V2, holders, whales, oracle prices, BurnVault events
  worker/     data -> LLM -> RiskGuard -> commit -> queue -> post -> reveal
  web/        Next.js site
contracts/    NexaLedger, fee splitters, BurnVault (Foundry)
packages/
  shared/         types, chains, commit-reveal hash, scoring
  riskguard/      content filter
  db/             Drizzle schema and migrations
  contracts-abi/  ABIs and addresses per network
  api-client/     typed client for browser and server
docs/         brief, progress, decisions, blockers, API spec and fixtures
```

## Products

| Product | Price | Endpoint |
| --- | --- | --- |
| NEXA Pro: real-time alerts on web and Telegram | $19 / month | `GET /alerts/stream` (SSE) |
| Ask NEXA: full risk report for one address, paid in USDG | $1 / analysis | `POST /ask` |
| Signals API: JSON feed | $499 / month | `GET /signals` |
| Sponsored deep-dive, always labelled "Sponsored" | $750 / report | internal flow |

Public data: `GET /proof`, `GET /predictions/:id`, `GET /leaderboard`, `GET /rug-radar`, `GET /burn`.
The OpenAPI spec is at `docs/api/openapi.json` and fixtures are in `docs/api/fixtures/`.

## Tokenomics

$NEXA launches on Pons V2 with an NVDA Stock Token pair.

| Fee stream | To BurnVault | Remainder |
| --- | --- | --- |
| Creator fee from $NEXA trading | **30%** | 70% treasury |
| Protocol fee (Pro, API, Ask NEXA, sponsored) | **20%** | 80% operations |

The 30/20 ratios are `constant` in the contracts. `BurnVault` buys $NEXA and burns it, with no withdrawal path. NEXA never discusses the $NEXA price and never tells anyone to buy it.

## RiskGuard

Hard-coded rules, each with tests in English and Indonesian:

- No "buy", "sell", "guaranteed pump", or price targets.
- $NEXA is mentioned only in technical announcements and burn reports.
- Sponsored content starts with "Sponsored" and carries no buy recommendation.
- No coverage of tokens younger than one hour.
- Missing or failed data produces "I don't know".
- No URLs in posts.

Every decision is stored: `{ allowed, reasons[], requiresApproval }`.

## Networks

| | Testnet | Mainnet |
| --- | --- | --- |
| Chain ID | 46630 | 4663 |
| RPC | `https://rpc.testnet.chain.robinhood.com` | `https://rpc.mainnet.chain.robinhood.com` |
| NexaLedger | `0xEF1fBbd8ea7dC858Dc88332AcD43Ba58b9bD81C0` | `0xEF1fBbd8ea7dC858Dc88332AcD43Ba58b9bD81C0` |

Addresses live in `packages/contracts-abi/addresses/<network>.json`.

## Getting started

Requirements: Node 22 or newer, pnpm, Docker, Foundry.

```bash
# Run in: ROOT
pnpm install
cp .env.example .env          # fill in the public addresses; never commit secrets
docker compose up -d          # local Postgres
pnpm test                     # Vitest across all workspaces
```

```bash
# Run in: ROOT/contracts
forge test                    # unit and fuzz tests
```

Posting defaults to `X_POST_MODE=dry`, which only logs. Live posting needs explicit configuration.

## Security

- Private keys never enter the repo, `.env`, or logs. Deployment uses a Foundry keystore.
- The agent wallet is a hot wallet that only calls `commit()` and `reveal()`, holds gas only, and owns nothing.
- The treasury only receives funds. Its key never touches the backend.
- Salt, API keys, and private keys are never logged.
- `NexaLedger` and the splitters have not yet had an external audit. The audit package is in `docs/audit/README.md`.

## Disclaimer

NEXA is an automated AI agent and is **not financial advice**. Nothing it publishes is a recommendation to buy or sell any asset.

## License

See [LICENSE](LICENSE).
