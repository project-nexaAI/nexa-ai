import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// Konvensi: jumlah token/harga disimpan sebagai numeric(78,0) (string di TS, konversi ke bigint di batas)
// beserta kolom desimal eksplisit. Semua waktu UTC (timestamptz).
const amount = (name: string) => numeric(name, { precision: 78, scale: 0 })
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const predictionStatus = pgEnum('prediction_status', [
  'draft', // dibuat AI, belum commit
  'committed', // tx commit terkonfirmasi
  'posted', // sudah (atau dry) diposting
  'revealed', // reveal + skor selesai
  'failed',
])

export const postStatus = pgEnum('post_status', [
  'pending_approval',
  'approved',
  'rejected',
  'posted',
  'failed',
])

export const priceSource = pgEnum('price_source', ['dex', 'oracle'])
export const costCategory = pgEnum('cost_category', ['llm', 'x_api', 'infra'])

// ---------------------------------------------------------------- indexer

export const ponsTokens = pgTable(
  'pons_tokens',
  {
    address: text('address').primaryKey(),
    creator: text('creator').notNull(),
    name: text('name'),
    symbol: text('symbol'),
    launchedAt: ts('launched_at').notNull(),
    graduatedAt: ts('graduated_at'),
    creatorTaxBps: integer('creator_tax_bps'),
    topHolderShareBps: integer('top_holder_share_bps'),
    redFlags: jsonb('red_flags').$type<string[]>().notNull().default([]),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  },
  (t) => [index('pons_tokens_launched_idx').on(t.launchedAt)],
)

export const ponsTrades = pgTable(
  'pons_trades',
  {
    id: text('id').primaryKey(), // `${txHash}-${logIndex}`
    token: text('token').notNull(),
    trader: text('trader').notNull(),
    side: text('side', { enum: ['buy', 'sell'] }).notNull(),
    tokenAmount: amount('token_amount').notNull(),
    quoteAmount: amount('quote_amount').notNull(),
    quoteDecimals: integer('quote_decimals').notNull(),
    at: ts('at').notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  },
  (t) => [index('pons_trades_token_at_idx').on(t.token, t.at)],
)

export const whaleTransfers = pgTable(
  'whale_transfers',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull(),
    from: text('from').notNull(),
    to: text('to').notNull(),
    amount: amount('amount').notNull(),
    decimals: integer('decimals').notNull(),
    at: ts('at').notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  },
  (t) => [index('whale_transfers_at_idx').on(t.at)],
)

export const priceSnapshots = pgTable(
  'price_snapshots',
  {
    id: serial('id').primaryKey(),
    asset: text('asset').notNull(),
    source: priceSource('source').notNull(),
    price: amount('price').notNull(),
    decimals: integer('decimals').notNull(),
    roundId: amount('round_id'), // hanya untuk oracle
    at: ts('at').notNull(),
  },
  (t) => [index('price_snapshots_asset_at_idx').on(t.asset, t.at)],
)

// ----------------------------------------------------------------- worker

export const predictions = pgTable(
  'predictions',
  {
    id: serial('id').primaryKey(),
    ledgerId: integer('ledger_id'), // id di NexaLedger setelah commit
    hash: text('hash').notNull(),
    status: predictionStatus('status').notNull().default('draft'),
    commitTxHash: text('commit_tx_hash'),
    committedAt: ts('committed_at'),
    maturesAt: ts('matures_at'),
    // Preimage (teks, aset, arah, horizon, salt) terenkripsi. Salt tidak pernah disimpan/di-log plaintext.
    preimageEncrypted: text('preimage_encrypted').notNull(),
    revealTxHash: text('reveal_tx_hash'),
    revealedAt: ts('revealed_at'),
    startRoundId: amount('start_round_id'),
    endRoundId: amount('end_round_id'),
    won: boolean('won'),
    returnBps: integer('return_bps'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('predictions_hash_uq').on(t.hash), index('predictions_status_idx').on(t.status)],
)

export const postQueue = pgTable(
  'post_queue',
  {
    id: serial('id').primaryKey(),
    kind: text('kind').notNull(), // mis. prediction_of_the_day, daily_summary, mention_reply
    content: text('content').notNull(),
    status: postStatus('status').notNull().default('pending_approval'),
    riskguard: jsonb('riskguard').$type<{ allowed: boolean; reasons: string[]; requiresApproval: boolean }>(),
    predictionId: integer('prediction_id').references(() => predictions.id),
    scheduledAt: ts('scheduled_at'), // post publik ditunda 15 menit dari alert Pro
    postedAt: ts('posted_at'),
    externalId: text('external_id'),
    mode: text('mode', { enum: ['dry', 'live'] }).notNull().default('dry'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('post_queue_status_idx').on(t.status, t.scheduledAt)],
)

export const riskguardLog = pgTable('riskguard_log', {
  id: serial('id').primaryKey(),
  contentType: text('content_type').notNull(),
  contentHash: text('content_hash').notNull(),
  allowed: boolean('allowed').notNull(),
  reasons: jsonb('reasons').$type<string[]>().notNull().default([]),
  requiresApproval: boolean('requires_approval').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const costLog = pgTable(
  'cost_log',
  {
    id: serial('id').primaryKey(),
    category: costCategory('category').notNull(),
    ref: text('ref').notNull(), // model / endpoint / layanan
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    usdMicros: bigint('usd_micros', { mode: 'bigint' }).notNull(), // 1e-6 USD
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('cost_log_cat_at_idx').on(t.category, t.createdAt)],
)
