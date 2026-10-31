// Hanya membaca alamat publik dan keystore. Tidak pernah membaca/menampilkan private key.
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { isAddress, getAddress, createPublicClient, http, formatEther } from 'viem'

const DEPLOYER = '0x1f4cD14B5CDD15436950d626CBCb0e21084F462D'
const RPC = 'https://rpc.testnet.chain.robinhood.com'

const env = {}
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2]
  }
}
let failed = false
const ok = (m) => console.log(`OK    ${m}`)
const bad = (m) => { failed = true; console.log(`FAIL  ${m}`) }

const agent = env.AGENT_ADDRESS ?? ''
const treasury = env.TREASURY_ADDRESS ?? ''
for (const [name, v] of [['AGENT_ADDRESS', agent], ['TREASURY_ADDRESS', treasury]]) {
  if (!v) bad(`${name} kosong di .env`)
  else if (!isAddress(v)) bad(`${name} bukan alamat valid/checksum salah`)
  else ok(`${name} valid`)
}
const set = new Set([DEPLOYER, agent, treasury].filter(isAddress).map((a) => a.toLowerCase()))
if (agent && treasury && set.size === 3) ok('ketiga alamat berbeda')
else if (agent && treasury) bad('alamat deployer/agent/treasury harus berbeda')

function keystoreAddress(name) {
  try {
    return execFileSync('cast', ['wallet', 'address', '--account', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim()
  } catch { return null }
}
for (const [name, expected] of [['deployer', DEPLOYER], ['nexa-agent', agent]]) {
  const a = keystoreAddress(name)
  if (!a) bad(`keystore ${name} tidak terbaca (belum diimpor, atau butuh password: jalankan manual)`)
  else if (expected && a.toLowerCase() === expected.toLowerCase()) ok(`keystore ${name} cocok`)
  else bad(`keystore ${name} tidak cocok dengan alamat yang diharapkan`)
}

const client = createPublicClient({ transport: http(RPC) })
for (const [name, a] of [['deployer', DEPLOYER], ['agent', agent]]) {
  if (!isAddress(a)) continue
  try {
    const bal = await client.getBalance({ address: getAddress(a) })
    if (bal > 0n) ok(`saldo ${name} testnet: ${formatEther(bal)} ETH`)
    else bad(`saldo ${name} testnet 0 (faucet: https://faucet.testnet.chain.robinhood.com)`)
  } catch (e) { bad(`gagal cek saldo ${name}: ${e.shortMessage ?? e.message}`) }
}
process.exit(failed ? 1 : 0)
