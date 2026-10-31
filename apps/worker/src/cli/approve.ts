import { createDb } from '@nexa-ai/db'
import { getPost, listPending, rejectPost } from '../queue'
import { DryTelegram, TelegramBot, approveAndAlert, type Notifier } from '../telegram'

const USAGE = `CLI persetujuan post NEXA
  pnpm --filter @nexa-ai/worker review list
  pnpm --filter @nexa-ai/worker review show <id>
  pnpm --filter @nexa-ai/worker review approve <id>
  pnpm --filter @nexa-ai/worker review reject <id>`

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL belum di-set')
  process.exit(1)
}

const [cmd, idArg] = process.argv.slice(2)
const { db, client } = createDb(url)
// Alert Pro: chat PRIBADI (TELEGRAM_PRO_CHAT_ID), bukan kanal publik (TELEGRAM_CHAT_ID), karena alert Pro harus
// lebih awal 15 menit dari publik. Tanpa token dan chat id Pro: dry (hanya log).
const notifier: Notifier =
  process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_PRO_CHAT_ID
    ? new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_PRO_CHAT_ID)
    : new DryTelegram()

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
      await approveAndAlert(db, notifier, idOrExit())
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
