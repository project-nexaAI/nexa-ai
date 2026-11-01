import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
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
    curve: text('curve'), // kontrak bonding curve; event CurveBuy/CurveSell dipancarkan dari sini
    pairToken: text('pair_token'),
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

/** Posisi terakhir yang sudah diproses indexer (satu baris per nama indexer). */
export const indexerState = pgTable('indexer_state', {
  name: text('name').primaryKey(),
  lastBlock: bigint('last_block', { mode: 'bigint' }).notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

/** Event `Burned` dari BurnVault. $NEXA selalu 18 desimal (token Pons). */
export const burns = pgTable(
  'burns',
  {
    id: text('id').primaryKey(), // `${txHash}-${logIndex}`
    txHash: text('tx_hash').notNull(),
    nexaBurned: amount('nexa_burned').notNull(),
    pairSpent: amount('pair_spent').notNull(),
    at: ts('at').notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  },
  (t) => [index('burns_at_idx').on(t.at)],
)

/**
 * Saldo holder per token Pons (dari event Transfer sejak peluncuran). Dipakai untuk konsentrasi holder.
 * balance bisa negatif bila riwayat tidak lengkap; token seperti itu tidak diberi angka konsentrasi.
 */
export const tokenHolders = pgTable(
  'token_holders',
  {
    token: text('token').notNull(),
    holder: text('holder').notNull(),
    balance: amount('balance').notNull(),
  },
  (t) => [primaryKey({ columns: [t.token, t.holder] })],
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
    // Data publik yang dibuka saat reveal (API tidak pernah mendekripsi preimage).
    revealedText: text('revealed_text'),
    revealedAsset: text('revealed_asset'),
    revealedDirection: integer('revealed_direction'), // 1 = up, 2 = down
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

/** Kunci Signals API. Hanya hash SHA-256 yang disimpan; kunci asli ditampilkan sekali saat dibuat. */
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  keyHash: text('key_hash').notNull().unique(),
  label: text('label').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: ts('created_at').notNull().defaultNow(),
})

/** KOL yang bersedia dinilai (brief: "KOL yang mau ikut dinilai"). Hanya yang opted_in tampil di leaderboard. */
export const kolAccounts = pgTable('kol_accounts', {
  id: serial('id').primaryKey(),
  handle: text('handle').notNull().unique(), // huruf kecil, tanpa @
  displayName: text('display_name').notNull(),
  optedIn: boolean('opted_in').notNull().default(true),
  createdAt: ts('created_at').notNull().defaultNow(),
})

/** Call publik seorang KOL. source_url wajib (bukti call asli); harga awal diambil dari oracle saat dicatat. */
export const kolCalls = pgTable(
  'kol_calls',
  {
    id: serial('id').primaryKey(),
    kolId: integer('kol_id')
      .notNull()
      .references(() => kolAccounts.id),
    text: text('text').notNull(),
    asset: text('asset').notNull(),
    direction: integer('direction').notNull(), // 1 = up, 2 = down
    madeAt: ts('made_at').notNull(),
    maturesAt: ts('matures_at').notNull(),
    sourceUrl: text('source_url').notNull(),
    startPrice: amount('start_price').notNull(),
    priceDecimals: integer('price_decimals').notNull(),
    endPrice: amount('end_price'),
    scoredAt: ts('scored_at'),
    won: boolean('won'),
    returnBps: integer('return_bps'), // perubahan harga mentah; searah klaim dihitung di API
  },
  (t) => [index('kol_calls_kol_idx').on(t.kolId)],
)

/** Nonce SIWE sekali pakai (anti replay). */
export const authNonces = pgTable('auth_nonces', {
  nonce: text('nonce').primaryKey(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
})

/** Sesi login wallet. Hanya hash SHA-256 token yang disimpan. */
export const authSessions = pgTable(
  'auth_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    address: text('address').notNull(), // ber-checksum
    createdAt: ts('created_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [index('auth_sessions_address_idx').on(t.address)],
)

/** Kredit Ask NEXA gratis yang sudah dipakai holder $NEXA (per alamat per bulan UTC, `YYYY-MM`). */
export const askCreditUses = pgTable(
  'ask_credit_uses',
  {
    id: serial('id').primaryKey(),
    address: text('address').notNull(),
    month: text('month').notNull(),
    askedAddress: text('asked_address').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('ask_credit_uses_idx').on(t.address, t.month)],
)

/** Pembayaran Ask NEXA yang sudah dipakai. tx_hash unik: satu pembayaran = satu laporan (anti replay). */
export const askPayments = pgTable('ask_payments', {
  txHash: text('tx_hash').primaryKey(),
  payer: text('payer').notNull(),
  amount: amount('amount').notNull(), // unit terkecil USDG (6 desimal)
  askedAddress: text('asked_address').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

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

// ------------------------------------------------------------- NEXA Pro

/** Langganan Pro per alamat wallet (ber-checksum). Aktif selama `expires_at` di masa depan. */
export const proSubscriptions = pgTable('pro_subscriptions', {
  address: text('address').primaryKey(),
  expiresAt: ts('expires_at').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

/** Pembayaran langganan yang sudah diklaim (satu tx hash hanya boleh dipakai sekali). */
export const proPayments = pgTable('pro_payments', {
  txHash: text('tx_hash').primaryKey(),
  payer: text('payer').notNull(),
  amount: amount('amount').notNull(), // unit terkecil USDG (6 desimal)
  days: integer('days').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

/**
 * Alert Pro: dibuat saat post disetujui (atau lolos otomatis), 15 menit SEBELUM post publik di X.
 * Sumber stream SSE dan pengiriman Telegram; `telegram_dispatched_at` menandai fan-out ke pelanggan sudah dilakukan.
 */
export const proAlerts = pgTable(
  'pro_alerts',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .notNull()
      .unique()
      .references(() => postQueue.id),
    kind: text('kind').notNull(),
    content: text('content').notNull(),
    publicAt: ts('public_at'), // jadwal post publik di X
    createdAt: ts('created_at').notNull().defaultNow(),
    telegramDispatchedAt: ts('telegram_dispatched_at'),
  },
  (t) => [index('pro_alerts_dispatch_idx').on(t.telegramDispatchedAt)],
)

/** Chat Telegram pribadi milik pelanggan (satu alamat, satu chat). */
export const telegramLinks = pgTable('telegram_links', {
  address: text('address').primaryKey(),
  chatId: text('chat_id').notNull().unique(),
  linkedAt: ts('linked_at').notNull().defaultNow(),
})

/** Kode sekali pakai untuk menautkan chat Telegram ke alamat wallet (`/start <kode>` ke bot). */
export const telegramLinkCodes = pgTable('telegram_link_codes', {
  code: text('code').primaryKey(),
  address: text('address').notNull(),
  expiresAt: ts('expires_at').notNull(),
})
