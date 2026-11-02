import { XApiError, verifyCredentials } from '../x'

const USAGE = `CLI X. Tidak memposting apa pun.
  pnpm --filter @nexa-ai/worker x:verify   (cek empat kunci X; membaca akun pemilik token)
Butuh X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET di environment.`

const [cmd] = process.argv.slice(2)
if (cmd !== 'verify') {
  console.error(USAGE)
  process.exit(1)
}

const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET, X_EXPECT_USERNAME } = process.env
const missing = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'].filter((k) => !process.env[k])
if (missing.length > 0) {
  console.error(`Belum di-set: ${missing.join(', ')}`)
  process.exit(1)
}

try {
  const me = await verifyCredentials({ apiKey: X_API_KEY!, apiSecret: X_API_SECRET!, accessToken: X_ACCESS_TOKEN!, accessSecret: X_ACCESS_SECRET! })
  console.log(`Kunci valid. Akun: @${me.username} (id ${me.id})`)
  if (X_EXPECT_USERNAME && X_EXPECT_USERNAME.replace(/^@/, '').toLowerCase() !== me.username.toLowerCase()) {
    console.error(`Peringatan: akun yang diharapkan @${X_EXPECT_USERNAME.replace(/^@/, '')}, tetapi token milik @${me.username}.`)
    process.exit(2)
  }
} catch (err) {
  console.error(err instanceof XApiError ? `Gagal: ${err.message}` : 'Gagal memeriksa kunci')
  process.exit(1)
}
