import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export * from './schema'
export { schema }

/** Koneksi langsung/session (bukan transaction pooler) supaya cocok dengan pg-boss dan proses long-running. */
export function createDb(url: string) {
  const client = postgres(url, { max: 10 })
  return { db: drizzle(client, { schema }), client }
}
