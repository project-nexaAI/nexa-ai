// Jalankan di: ROOT. Ekspor ABI hasil `forge build` ke TS bertipe (as const) + JSON.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const SRC = { CreatorFeeSplitter: 'FeeSplitter', ProtocolFeeSplitter: 'FeeSplitter' } // beberapa kontrak berbagi satu file
const contracts = ['NexaLedger', 'BurnVault', 'CreatorFeeSplitter', 'ProtocolFeeSplitter']
mkdirSync('packages/contracts-abi/abi', { recursive: true })
let index = '// DIHASILKAN oleh scripts/export-abi.mjs dari contracts/out. Jangan diedit manual.\n'
for (const name of contracts) {
  const art = JSON.parse(readFileSync(`contracts/out/${SRC[name] ?? name}.sol/${name}.json`, 'utf8'))
  writeFileSync(`packages/contracts-abi/abi/${name}.json`, JSON.stringify(art.abi, null, 2) + '\n')
  const camel = name[0].toLowerCase() + name.slice(1)
  index += `export const ${camel}Abi = ${JSON.stringify(art.abi, null, 2)} as const\n`
}
writeFileSync('packages/contracts-abi/src/index.ts', index)
