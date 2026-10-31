import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL belum di-set')

const client = postgres(url, { max: 1 })
await migrate(drizzle(client), { migrationsFolder: new URL('../migrations', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') })
await client.end()
console.log('migrasi selesai')
