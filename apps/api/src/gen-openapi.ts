// Jalankan di: ROOT/apps/api -> pnpm openapi. Menulis docs/api/openapi.json.
import { writeFileSync } from 'node:fs'
import { buildOpenApi } from './openapi'

const out = new URL('../../../docs/api/openapi.json', import.meta.url)
writeFileSync(out, JSON.stringify(buildOpenApi(), null, 2) + '\n')
console.log('ditulis:', out.pathname)
