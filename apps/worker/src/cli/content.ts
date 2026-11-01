import { createDb } from '@nexa-ai/db'
import { llmFromEnv } from '../llm'
import { answerMention } from '../mention'
import { SponsoredError, createSponsoredPost } from '../sponsored'

const USAGE = `CLI konten NEXA (hasilnya selalu masuk antrian persetujuan, mode dry; tinjau dengan "review")
  pnpm --filter @nexa-ai/worker content sponsored "<nama klien>" <alamat-token> "<bukti-pembayaran>"
  pnpm --filter @nexa-ai/worker content mention <id-post-x> "<teks mention>"
Butuh DATABASE_URL, LLM_API_KEY, LLM_BASE_URL.`

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL belum di-set')
  process.exit(1)
}
const llm = llmFromEnv(process.env)
if (!llm) {
  console.error('LLM_API_KEY dan LLM_BASE_URL wajib diisi: konten tidak dibuat tanpa LLM nyata.')
  process.exit(1)
}

const [cmd, ...a] = process.argv.slice(2)
const { db, client } = createDb(url)

try {
  switch (cmd) {
    case 'sponsored': {
      if (!a[0] || !a[1] || !a[2]) throw new Error(USAGE)
      const r = await createSponsoredPost({ db, llm, mode: 'dry' }, { client: a[0], token: a[1], paymentRef: a[2] })
      console.log(`Konten sponsor #${r.reportId} -> post #${r.postId} (${r.status}). ${r.status === 'rejected' ? 'Diblokir RiskGuard; lihat riskguard_log.' : 'Tinjau: review show ' + r.postId}`)
      break
    }
    case 'mention': {
      if (!a[0] || !a[1]) throw new Error(USAGE)
      const r = await answerMention({ db, llm, mode: 'dry' }, { id: a[0], text: a[1] })
      if (r.kind === 'ignored') console.log(`Diabaikan: ${r.reason === 'no_address' ? 'tidak ada alamat kontrak di mention' : 'mention ini sudah dibalas'}`)
      else console.log(`Balasan -> post #${r.postId} (${r.status})${r.unknown ? ' [jawaban "tidak tahu"]' : ''}. Tinjau: review show ${r.postId}`)
      break
    }
    default:
      console.log(USAGE)
  }
} catch (e) {
  console.error(e instanceof SponsoredError ? `Ditolak: ${e.message}` : e instanceof Error ? e.message : e)
  process.exitCode = 1
} finally {
  await client.end()
}
