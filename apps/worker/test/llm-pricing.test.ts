import { describe, expect, it } from 'vitest'
import { MIMO_V26_PRICING, OpenAiCompatibleLlm, costMicros, pricingFromEnv } from '../src/llm'

describe('harga LLM', () => {
  it('costMicros: 1 juta token masuk + 1 juta keluar = jumlah harga per juta', () => {
    expect(costMicros(MIMO_V26_PRICING.large, 1_000_000, 1_000_000)).toBe(435_000n + 870_000n)
    expect(costMicros(MIMO_V26_PRICING.small, 1_000, 500)).toBe(140n + 140n)
  })

  it('pricingFromEnv: default sementara, override per field', () => {
    expect(pricingFromEnv({})).toEqual(MIMO_V26_PRICING)
    const p = pricingFromEnv({ LLM_PRICE_LARGE_OUT_USD_MICROS: '1000000', LLM_PRICE_SMALL_IN_USD_MICROS: '' })
    expect(p.large.outPerMTokUsdMicros).toBe(1_000_000n)
    expect(p.large.inPerMTokUsdMicros).toBe(435_000n)
    expect(p.small).toEqual(MIMO_V26_PRICING.small)
  })

  it('adapter memakai harga sesuai tier model yang dipakai', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 2_000_000, completion_tokens: 1_000_000 } }))) as typeof fetch
    const llm = new OpenAiCompatibleLlm({ baseUrl: 'https://x.test/v1', apiKey: 'k', modelSmall: 's', modelLarge: 'l', pricing: MIMO_V26_PRICING, fetchImpl })
    expect((await llm.chat({ tier: 'small', system: '', user: '' })).usage.usdMicros).toBe(2n * 140_000n + 280_000n)
    expect((await llm.chat({ tier: 'large', system: '', user: '' })).usage.usdMicros).toBe(2n * 435_000n + 870_000n)
  })
})
