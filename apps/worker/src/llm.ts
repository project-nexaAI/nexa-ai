import { z } from 'zod'

export type ModelTier = 'small' | 'large'

export interface Usage {
  model: string
  tokensIn: number
  tokensOut: number
  /** 1e-6 USD */
  usdMicros: bigint
}

export interface ChatRequest {
  tier: ModelTier
  system: string
  user: string
  json?: boolean
}

export interface ChatResponse {
  text: string
  usage: Usage
}

/** Adapter penyedia LLM. Penyedia diganti lewat env tanpa mengubah pemanggil. */
export interface LlmClient {
  chat(req: ChatRequest): Promise<ChatResponse>
}

export interface LlmPricing {
  /** USD micro per 1 juta token */
  inPerMTokUsdMicros: bigint
  outPerMTokUsdMicros: bigint
}

/**
 * Harga SEMENTARA MiMo v2.6 (USD per 1 juta token, dalam USD micro). Sumber: agregator pihak ketiga (OpenRouter dan artikel
 * harga, 2026-10-31), BUKAN halaman harga resmi Xiaomi, dan harga cache-hit diabaikan: biaya tercatat adalah batas atas.
 * Ganti lewat env LLM_PRICE_* begitu harga resmi (atau tagihan nyata) diketahui.
 */
export const MIMO_V26_PRICING: Record<ModelTier, LlmPricing> = {
  small: { inPerMTokUsdMicros: 140_000n, outPerMTokUsdMicros: 280_000n }, // mimo-v2.6-flash: $0,14 / $0,28
  large: { inPerMTokUsdMicros: 435_000n, outPerMTokUsdMicros: 870_000n }, // mimo-v2.6-pro: $0,435 / $0,87
}

const priceEnv = z.coerce.bigint().nonnegative().optional()

/** Harga per tier dari env (USD micro per 1 juta token); yang tidak diisi memakai MIMO_V26_PRICING. */
export function pricingFromEnv(env: Record<string, string | undefined>): Record<ModelTier, LlmPricing> {
  const pick = (name: string, fallback: bigint) => priceEnv.parse(env[name] || undefined) ?? fallback
  const d = MIMO_V26_PRICING
  return {
    small: {
      inPerMTokUsdMicros: pick('LLM_PRICE_SMALL_IN_USD_MICROS', d.small.inPerMTokUsdMicros),
      outPerMTokUsdMicros: pick('LLM_PRICE_SMALL_OUT_USD_MICROS', d.small.outPerMTokUsdMicros),
    },
    large: {
      inPerMTokUsdMicros: pick('LLM_PRICE_LARGE_IN_USD_MICROS', d.large.inPerMTokUsdMicros),
      outPerMTokUsdMicros: pick('LLM_PRICE_LARGE_OUT_USD_MICROS', d.large.outPerMTokUsdMicros),
    },
  }
}

export function costMicros(pricing: LlmPricing, tokensIn: number, tokensOut: number): bigint {
  return (BigInt(tokensIn) * pricing.inPerMTokUsdMicros + BigInt(tokensOut) * pricing.outPerMTokUsdMicros) / 1_000_000n
}

export interface OpenAiCompatibleConfig {
  baseUrl: string
  apiKey: string
  modelSmall: string
  modelLarge: string
  /** Harga per tier. Tanpa ini biaya tercatat 0 (jumlah token tetap benar). */
  pricing?: Record<ModelTier, LlmPricing>
  fetchImpl?: typeof fetch
}

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional(),
})

/** API kompatibel OpenAI (Xiaomi MiMo; base URL lewat env LLM_BASE_URL). Kunci API tidak pernah di-log. */
export class OpenAiCompatibleLlm implements LlmClient {
  constructor(private readonly cfg: OpenAiCompatibleConfig) {}

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.tier === 'small' ? this.cfg.modelSmall : this.cfg.modelLarge
    const f = this.cfg.fetchImpl ?? fetch
    const res = await f(`${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    })
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
    const body = completionSchema.parse(await res.json())
    const tokensIn = body.usage?.prompt_tokens ?? 0
    const tokensOut = body.usage?.completion_tokens ?? 0
    const pricing = this.cfg.pricing?.[req.tier] ?? { inPerMTokUsdMicros: 0n, outPerMTokUsdMicros: 0n }
    return {
      text: body.choices[0]!.message.content ?? '',
      usage: { model, tokensIn, tokensOut, usdMicros: costMicros(pricing, tokensIn, tokensOut) },
    }
  }
}

/** LLM tiruan untuk test dan selama LLM_API_KEY kosong. */
export class MockLlm implements LlmClient {
  readonly calls: ChatRequest[] = []
  constructor(private readonly handler: (req: ChatRequest, callIndex: number) => string) {}

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const text = this.handler(req, this.calls.length)
    this.calls.push(req)
    return { text, usage: { model: `mock-${req.tier}`, tokensIn: 0, tokensOut: 0, usdMicros: 0n } }
  }
}

export class LlmOutputError extends Error {}

function stripFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
}

/**
 * MiMo mendukung JSON mode tetapi bukan json_schema native: output divalidasi zod dan di-retry jika gagal.
 */
export async function generateStructured<T>(
  llm: LlmClient,
  schema: z.ZodType<T>,
  req: Omit<ChatRequest, 'json'>,
  maxRetries = 2,
): Promise<{ value: T; usages: Usage[] }> {
  const usages: Usage[] = []
  let lastError = ''
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const user = attempt === 0 ? req.user : `${req.user}\n\nJawaban sebelumnya tidak valid (${lastError}). Balas HANYA JSON valid sesuai skema.`
    const res = await llm.chat({ ...req, user, json: true })
    usages.push(res.usage)
    try {
      return { value: schema.parse(JSON.parse(stripFence(res.text))), usages }
    } catch (e) {
      lastError = (e instanceof Error ? e.message : 'invalid').slice(0, 200)
    }
  }
  throw new LlmOutputError(`output LLM tidak valid setelah ${maxRetries + 1} percobaan: ${lastError}`)
}
