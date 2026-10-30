import { createDb } from '@nexa-ai/db'
import { approvePost, getPost, listPending, rejectPost } from '../queue'

const USAGE = `CLI persetujuan post NEXA
  pnpm --filter @nexa-ai/worker approve list
  pnpm --filter @nexa-ai/worker approve show <id>
  pnpm --filter @nexa-ai/worker approve approve <id>
  pnpm --filter @nexa-ai/worker approve reject <id>`

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL belum di-set')
  process.exit(1)
}

const [cmd, idArg] = process.argv.slice(2)
const { db, client } = createDb(url)

function idOrExit(): number {
  const id = Number(idArg)
  if (!Number.isInteger(id) || id <= 0) {
    console.error(USAGE)
    process.exit(1)
  }
  return id
}

try {
  switch (cmd) {
    case 'list': {
      const rows = await listPending(db)
      if (rows.length === 0) console.log('Tidak ada post yang menunggu persetujuan.')
      for (const r of rows) {
        console.log(`#${r.id} [${r.kind}] mode=${r.mode} jadwal=${r.scheduledAt?.toISOString()}\n  ${r.content.replace(/\n/g, '\n  ')}\n`)
      }
      break
    }
    case 'show': {
      const row = await getPost(db, idOrExit())
      console.log(row ? JSON.stringify(row, null, 2) : 'Post tidak ditemukan.')
      break
    }
    case 'approve':
      await approvePost(db, idOrExit())
      console.log(`Post #${idArg} disetujui.`)
      break
    case 'reject':
      await rejectPost(db, idOrExit())
      console.log(`Post #${idArg} ditolak.`)
      break
    default:
      console.log(USAGE)
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
} finally {
  await client.end()
}
