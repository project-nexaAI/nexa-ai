import { createDb } from '@nexa-ai/db'
import { readFileSync } from 'node:fs'
import { addCall, addKol, importKolCsv, scoreDueKolCalls } from '../kol'
import { MAINNET_ORACLE_ASSETS, createFeedReader } from '../oracle'

const USAGE = `CLI KOL (NEXA vs KOL). Hanya KOL yang bersedia dinilai.
  pnpm --filter @nexa-ai/worker kol add-kol <handle> "<nama tampilan>"
  pnpm --filter @nexa-ai/worker kol add-call <handle> <NVDA|ETH> <up|down> <hari> <link-post-x> "<teks call>"
  pnpm --filter @nexa-ai/worker kol import <file.csv>   (impor massal; kolom: handle,display_name,asset,direction,days,source_url,text)
  pnpm --filter @nexa-ai/worker kol score        (nilai call yang sudah jatuh tempo)
Harga dari oracle Chainlink mainnet (ORACLE_RPC_URL, default RPC mainnet).`

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL belum di-set')
  process.exit(1)
}
const [cmd, ...a] = process.argv.slice(2)
const { db, client } = createDb(url)
const read = createFeedReader(process.env.ORACLE_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com')

try {
  switch (cmd) {
    case 'add-kol': {
      if (!a[0] || !a[1]) throw new Error(USAGE)
      const k = await addKol(db, a[0], a[1])
      console.log(k ? `KOL @${k.handle} ditambahkan` : 'KOL sudah ada')
      break
    }
    case 'add-call': {
      const [handle, sym, dir, days, link, ...text] = a
      const asset = MAINNET_ORACLE_ASSETS.find((x) => x.symbol === sym?.toUpperCase())
      if (!handle || !asset || (dir !== 'up' && dir !== 'down') || !days || !link || text.length === 0) throw new Error(USAGE)
      const c = await addCall(db, read, { handle, asset, direction: dir, horizonDays: Number(days), sourceUrl: link, text: text.join(' ') })
      console.log(`call #${c.id} dicatat; harga awal ${c.startPrice} (${c.priceDecimals} desimal); jatuh tempo ${c.maturesAt.toISOString()}`)
      break
    }
    case 'import': {
      if (!a[0]) throw new Error(USAGE)
      const r = await importKolCsv(db, read, MAINNET_ORACLE_ASSETS, readFileSync(a[0], 'utf8'))
      console.log(`KOL baru: ${r.kols}, call dicatat: ${r.calls}, baris gagal: ${r.errors.length}`)
      for (const e of r.errors) console.log(`  baris ${e.line}: ${e.message}`)
      if (r.errors.length > 0) process.exitCode = 1
      break
    }
    case 'score': {
      const r = await scoreDueKolCalls(db, read, MAINNET_ORACLE_ASSETS)
      console.log(`dinilai: ${r.scored}, dilewati: ${r.skipped}`)
      break
    }
    default:
      console.log(USAGE)
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
} finally {
  await client.end()
}
