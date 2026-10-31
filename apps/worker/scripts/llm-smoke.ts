// Jalankan di: ROOT/apps/worker
//   node --env-file=../../.env --import tsx scripts/llm-smoke.ts
// Memanggil LLM sungguhan dengan jumlah token minimal. TIDAK pernah mencetak kunci API atau isi env.
import { evaluate } from '@nexa-ai/riskguard'
import { PERSONA_SYSTEM, buildPredictionPrompt, candidateFacts } from '../prompts/persona'
import { OpenAiCompatibleLlm, generateStructured } from '../src/llm'
import { z } from 'zod'

const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL_SMALL, LLM_MODEL_LARGE, LLM_PROVIDER } = process.env
console.log('env terisi:', {
  LLM_PROVIDER: LLM_PROVIDER ?? null,
  LLM_BASE_URL: LLM_BASE_URL ?? null,
  LLM_API_KEY: Boolean(LLM_API_KEY),
  LLM_MODEL_SMALL: LLM_MODEL_SMALL ?? null,
  LLM_MODEL_LARGE: LLM_MODEL_LARGE ?? null,
})
if (!LLM_BASE_URL || !LLM_API_KEY || !LLM_MODEL_SMALL || !LLM_MODEL_LARGE) {
  console.error('LLM_* belum lengkap di .env')
  process.exit(1)
}

const llm = new OpenAiCompatibleLlm({ baseUrl: LLM_BASE_URL, apiKey: LLM_API_KEY, modelSmall: LLM_MODEL_SMALL, modelLarge: LLM_MODEL_LARGE })

async function tier(t: 'small' | 'large') {
  const started = Date.now()
  try {
    const r = await llm.chat({ tier: t, system: 'Balas HANYA JSON.', user: 'Balas {"ok": true, "kata": "satu kata sapaan"}', json: true })
    console.log(`[${t}] OK ${Date.now() - started}ms model=${r.usage.model} token(in/out)=${r.usage.tokensIn}/${r.usage.tokensOut} -> ${r.text.slice(0, 120)}`)
    return true
  } catch (e) {
    console.error(`[${t}] GAGAL: ${e instanceof Error ? e.message : String(e)}`)
    return false
  }
}

const smallOk = await tier('small')
const largeOk = await tier('large')

// Prediction of the Day dengan data oracle contoh (bukan data nyata) -> output terstruktur -> RiskGuard.
const RUNS = Number(process.env.SMOKE_RUNS ?? 1)
for (let run = 0; run < RUNS && smallOk; run++) {
  const candidates = [
    { symbol: 'NVDA', asset: '0x00000000000000000000000000000000000ae1da' as const, oraclePrice: '142.10', dexVsOracleBps: 35 },
    { symbol: 'ETH', asset: '0x00000000000000000000000000000000000eeeee' as const, oraclePrice: '3100.00' },
  ]
  const schema = z.object({ symbol: z.string(), direction: z.enum(['up', 'down']), text: z.string().min(10).max(280) })
  try {
    const { value, usages } = await generateStructured(llm, schema, {
      tier: 'small',
      system: PERSONA_SYSTEM,
      user: buildPredictionPrompt(candidates, 7),
    })
    const chosen = candidates.find((c) => c.symbol === value.symbol)
    const decision = evaluate({ type: 'prediction', text: value.text, dataComplete: true, ...(chosen ? { facts: candidateFacts(chosen, 7) } : {}) })
    console.log('[prediksi]', JSON.stringify(value))
    console.log('[prediksi] panggilan LLM:', usages.length, 'token total:', usages.reduce((a, u) => a + u.tokensIn + u.tokensOut, 0))
    console.log('[riskguard]', JSON.stringify(decision))
  } catch (e) {
    console.error('[prediksi] GAGAL:', e instanceof Error ? e.message : String(e))
  }
}
process.exit(smallOk && largeOk ? 0 : 1)
