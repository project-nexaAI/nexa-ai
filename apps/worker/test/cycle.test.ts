import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPublicClient, createTestClient, createWalletClient, defineChain, http, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { costLog, createDb, postQueue, proAlerts, predictions, riskguardLog } from '@nexa-ai/db'
import { nexaLedgerAbi } from '@nexa-ai/contracts-abi'
import { DIRECTION } from '@nexa-ai/shared'
import { approvePost } from '../src/queue'
import { createLedgerClient } from '../src/ledger'
import { MockLlm } from '../src/llm'
import {
  NoDataError,
  commitPrediction,
  draftPrediction,
  generatePredictionDraft,
  publishDue,
  queuePredictionPost,
  revealMatured,
  type CycleDeps,
} from '../src/cycle'

// Kunci akun bawaan Anvil: kunci uji publik yang terkenal, bukan rahasia proyek.
const OWNER_KEY: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const AGENT_KEY: Hex = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const ENC_KEY = '11'.repeat(32)
const PORT = 18545
const RPC = `http://127.0.0.1:${PORT}`
const ASSET: Address = '0x00000000000000000000000000000000000ae1da'
const NFA = 'Bukan nasihat keuangan.'

const url = process.env.TEST_DATABASE_URL ?? 'postgres://nexa:nexa@localhost:5432/nexa_test'
const { db, client } = createDb(url)

let dbUp = false
try {
  await client`select 1`
  dbUp = true
} catch {
  console.warn('Postgres test tidak tersedia: test siklus dilewati')
}

const exe = process.platform === 'win32' ? '.exe' : ''
const anvilBin = process.env.ANVIL_BIN ?? join(homedir(), '.foundry', 'bin', `anvil${exe}`)
const outDir = fileURLToPath(new URL('../../../contracts/out/', import.meta.url))
const ledgerArtifact = join(outDir, 'NexaLedger.sol', 'NexaLedger.json')
const feedArtifact = join(outDir, 'MockAggregator.sol', 'MockAggregator.json')
const chainReady = existsSync(anvilBin) && existsSync(ledgerArtifact) && existsSync(feedArtifact)
if (!chainReady) console.warn('anvil atau artifact forge (contracts/out) tidak ada: test on-chain dilewati')

function readArtifact(path: string) {
  const a = JSON.parse(readFileSync(path, 'utf8'))
  return { abi: a.abi, bytecode: a.bytecode.object as Hex }
}

async function clean() {
  await db.delete(proAlerts)
  await db.delete(postQueue)
  await db.delete(riskguardLog)
  await db.delete(predictions)
  await db.delete(costLog)
}

describe.skipIf(!dbUp)('LLM -> draft prediksi', () => {
  beforeEach(clean)
  afterAll(async () => {
    if (!chainReady) await client.end()
  })

  const candidates = [
    { symbol: 'NVDA', asset: ASSET, oraclePrice: '142.10' },
    { symbol: 'ETH', asset: '0x00000000000000000000000000000000000eeeee' as Address, oraclePrice: '3100.00' },
  ]
  const good = JSON.stringify({ symbol: 'NVDA', direction: 'up', text: `NVDA diprediksi ditutup lebih tinggi dalam 7 hari. ${NFA}` })

  it('memilih aset dari data dan mencatat biaya LLM', async () => {
    const llm = new MockLlm(() => good)
    const d = await generatePredictionDraft(llm, db, candidates)
    expect(d.asset).toBe(ASSET)
    expect(d.direction).toBe(DIRECTION.UP)
    expect(llm.calls[0]?.tier).toBe('small')
    expect(llm.calls[0]?.json).toBe(true)
    expect(await db.select().from(costLog)).toHaveLength(1)
  })

  it('retry jika JSON tidak valid, lalu berhasil', async () => {
    const llm = new MockLlm((_r, i) => (i < 2 ? 'bukan json' : good))
    const d = await generatePredictionDraft(llm, db, candidates)
    expect(d.direction).toBe(DIRECTION.UP)
    expect(llm.calls).toHaveLength(3)
    expect(llm.calls[1]?.user).toContain('tidak valid')
  })

  it('gagal setelah retry habis', async () => {
    const llm = new MockLlm(() => '{"symbol": 1}')
    await expect(generatePredictionDraft(llm, db, candidates)).rejects.toThrow(/tidak valid/)
  })

  it('menolak simbol di luar data (halusinasi)', async () => {
    const llm = new MockLlm(() => JSON.stringify({ symbol: 'TSLA', direction: 'down', text: `TSLA turun dalam 7 hari. ${NFA}` }))
    await expect(generatePredictionDraft(llm, db, candidates)).rejects.toThrow(/di luar data/)
  })

  it('tanpa data oracle: tidak ada prediksi dan LLM tidak dipanggil', async () => {
    const llm = new MockLlm(() => good)
    await expect(generatePredictionDraft(llm, db, [])).rejects.toThrow(NoDataError)
    expect(llm.calls).toHaveLength(0)
  })
})

describe.skipIf(!dbUp || !chainReady)('siklus prediksi penuh (Anvil + Postgres)', () => {
  let anvil: ChildProcess
  let deps: CycleDeps
  let feed: Address
  let owner: ReturnType<typeof createWalletClient>
  let feedAbi: unknown[]
  const chain = defineChain({
    id: 31337,
    name: 'anvil',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [RPC] } },
  })
  const pub = createPublicClient({ chain, transport: http(RPC) })
  const testClient = createTestClient({ chain, mode: 'anvil', transport: http(RPC) })

  async function pushRound(answer: bigint, updatedAt: bigint) {
    const hash = await owner.writeContract({
      account: owner.account!,
      chain,
      address: feed,
      abi: feedAbi as never,
      functionName: 'push',
      args: [answer, updatedAt],
    } as never)
    await pub.waitForTransactionReceipt({ hash })
  }

  beforeAll(async () => {
    anvil = spawn(anvilBin, ['--port', String(PORT), '--silent'], { stdio: 'ignore' })
    for (let i = 0; i < 50; i++) {
      try {
        await pub.getChainId()
        break
      } catch {
        await new Promise((r) => setTimeout(r, 200))
      }
    }

    const ownerAccount = privateKeyToAccount(OWNER_KEY)
    owner = createWalletClient({ account: ownerAccount, chain, transport: http(RPC) })
    const agentAddr = privateKeyToAccount(AGENT_KEY).address

    const feedArt = readArtifact(feedArtifact)
    feedAbi = feedArt.abi
    const feedTx = await owner.deployContract({ abi: feedArt.abi, bytecode: feedArt.bytecode, account: ownerAccount, chain })
    feed = (await pub.waitForTransactionReceipt({ hash: feedTx })).contractAddress!

    const ledgerArt = readArtifact(ledgerArtifact)
    const ledgerTx = await owner.deployContract({
      abi: ledgerArt.abi,
      bytecode: ledgerArt.bytecode,
      args: [ownerAccount.address, agentAddr],
      account: ownerAccount,
      chain,
    })
    const ledgerAddress = (await pub.waitForTransactionReceipt({ hash: ledgerTx })).contractAddress!

    const setFeed = await owner.writeContract({
      account: ownerAccount,
      chain,
      address: ledgerAddress,
      abi: nexaLedgerAbi,
      functionName: 'setFeed',
      args: [ASSET, feed],
    })
    await pub.waitForTransactionReceipt({ hash: setFeed })

    deps = {
      db,
      encKey: ENC_KEY,
      mode: 'dry',
      ledger: createLedgerClient({ rpcUrl: RPC, chainId: 31337, ledgerAddress, agentPrivateKey: AGENT_KEY }),
    }
  }, 60_000)

  beforeEach(clean)
  afterAll(async () => {
    anvil?.kill()
    await client.end()
  })

  const TEXT = `NVDA diprediksi ditutup lebih tinggi dalam 7 hari. ${NFA}`

  it('commit -> antrian -> post dry -> reveal -> skor dari oracle', async () => {
    const t0 = await deps.ledger.chainTime()
    await pushRound(100n * 10n ** 8n, t0 - 10n) // harga awal sebelum commit

    // 1. draft + commit on-chain
    const { id, hash } = await draftPrediction(deps, { text: TEXT, asset: ASSET, direction: DIRECTION.UP })
    let [row] = await db.select().from(predictions)
    expect(row?.status).toBe('draft')
    expect(row?.preimageEncrypted).not.toContain(TEXT)
    expect(Buffer.from(row!.preimageEncrypted, 'base64').toString('latin1')).not.toContain('Bukan nasihat')

    // post tidak boleh masuk antrian sebelum commit terkonfirmasi
    await expect(queuePredictionPost(deps, id)).rejects.toThrow(/belum ter-commit/)

    await commitPrediction(deps, id)
    ;[row] = await db.select().from(predictions)
    expect(row?.status).toBe('committed')
    expect(row?.hash).toBe(hash)
    expect(row?.commitTxHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(row?.ledgerId).toBe(0)

    // 2. antrian + persetujuan manusia
    const queued = await queuePredictionPost(deps, id)
    expect(queued.status).toBe('pending_approval')
    expect(await publishDue(deps, new Date(Date.now() + 3_600_000))).toEqual([])
    await approvePost(db, queued.id)

    // 3. ditunda 15 menit, lalu terbit (dry)
    expect(await publishDue(deps, new Date(Date.now() + 14 * 60_000))).toEqual([])
    expect(await publishDue(deps, new Date(Date.now() + 16 * 60_000))).toEqual([queued.id])
    ;[row] = await db.select().from(predictions)
    expect(row?.status).toBe('posted')
    const [post] = await db.select().from(postQueue)
    expect(post?.status).toBe('posted')
    expect(post?.externalId).toBe(`dry-${queued.id}`)

    // 4. belum jatuh tempo: tidak ada reveal
    expect(await revealMatured(deps)).toEqual([])

    // 5. 7 hari berlalu, oracle naik 10%
    await testClient.increaseTime({ seconds: 7 * 24 * 3600 + 5 })
    await testClient.mine({ blocks: 1 })
    await pushRound(110n * 10n ** 8n, await deps.ledger.chainTime())

    // 6. reveal + skor
    expect(await revealMatured(deps)).toEqual([id])
    ;[row] = await db.select().from(predictions)
    expect(row?.status).toBe('revealed')
    expect(row?.won).toBe(true)
    expect(row?.returnBps).toBe(1000)
    expect(row?.revealTxHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(Number(row?.endRoundId) - Number(row?.startRoundId)).toBeGreaterThanOrEqual(1)

    // reveal tidak diulang
    expect(await revealMatured(deps)).toEqual([])
  }, 60_000)

  it('prediksi arah salah dinilai kalah', async () => {
    const t0 = await deps.ledger.chainTime()
    await pushRound(200n * 10n ** 8n, t0 - 10n)
    const { id } = await draftPrediction(deps, { text: TEXT, asset: ASSET, direction: DIRECTION.UP })
    await commitPrediction(deps, id)
    await testClient.increaseTime({ seconds: 7 * 24 * 3600 + 5 })
    await testClient.mine({ blocks: 1 })
    await pushRound(180n * 10n ** 8n, await deps.ledger.chainTime())
    expect(await revealMatured(deps)).toEqual([id])
    const [row] = await db.select().from(predictions)
    expect(row?.won).toBe(false)
    expect(row?.returnBps).toBe(-1000)
  }, 60_000)

  it('teks yang melanggar RiskGuard tidak pernah disetujui meski sudah ter-commit', async () => {
    const { id } = await draftPrediction(deps, { text: 'NVDA pasti naik minggu ini', asset: ASSET, direction: DIRECTION.UP })
    await commitPrediction(deps, id)
    const queued = await queuePredictionPost(deps, id)
    expect(queued.status).toBe('rejected')
    await expect(approvePost(db, queued.id)).rejects.toThrow()
  }, 60_000)
})
