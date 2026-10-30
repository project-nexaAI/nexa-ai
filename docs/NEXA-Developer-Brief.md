# NEXA — Developer Brief

Oct 22, 2026 · @ronald

## Ringkasan & narasi

NEXA (*Neural EXecution Agent*) adalah "superintelligence influencer" pertama di Robinhood Chain: AI agent di X yang membaca seluruh aktivitas chain 24/7, menerbitkan analisis, dan membuktikan setiap prediksinya on-chain sebelum diposting.

**Tagline:** *"The superintelligence influencer. Every call on-chain. No deleted tweets."*

**Cara menjual tema superintelligence dengan kredibel:** jadikan "superintelligence" sebagai persona, dan buktikan kecerdasannya dengan data, bukan klaim. Fitur intinya adalah **Proof of Intelligence**: setiap prediksi di-hash dan dicatat di kontrak `NexaLedger` sebelum diposting, lalu dinilai otomatis dengan harga oracle saat jatuh tempo. Win rate NEXA tidak bisa dipalsukan atau dihapus, berbeda dengan KOL manusia.

**Apa yang NEXA lakukan setiap hari:**

- Meringkas pergerakan Stock Token terbesar dan selisih harga DEX vs oracle Chainlink.
- Melaporkan launch dan graduation token di Pons V2 yang paling ramai, plus red flag (creator tax tinggi, holder terkonsentrasi).
- Menjawab mention: "@nexa analisis kontrak 0x…" dengan ringkasan risiko.
- Satu "Prediction of the Day" yang di-commit on-chain dan dinilai 7 hari kemudian.

**Kenapa sekarang:** Robinhood Chain adalah salah satu chain paling aktif untuk launchpad, dengan volume DEX sekitar $1,49 miliar dalam 24 jam pada akhir Agustus 2026 ([Datawallet](https://www.datawallet.com/crypto/pons-explained)). Banjir token baru membuat trader butuh penyaring yang cepat dan jujur.

**Target user:** trader Robinhood Chain yang butuh sinyal cepat, plus komunitas dan proyek yang ingin riset independen.

## Arsitektur agent

NEXA terdiri dari empat lapis: data on-chain, otak AI, buku besar prediksi on-chain, dan publikasi ke X dan web. Tidak ada post yang keluar sebelum lolos filter risiko dan, untuk prediksi, sebelum tercatat di `NexaLedger`.

&#91;embedded content: pipeline NEXA · data, AI, filter, commit, post, skor\]

Setiap prediksi tercatat di NexaLedger sebelum tampil di X, lalu dinilai otomatis saat jatuh tempo dan masuk ke win rate publik.

| Lapis | Komponen | Fungsi |
| --- | --- | --- |
| Data | Indexer Envio HyperSync + event kontrak Pons V2 | Launch, trade, graduation, transfer whale, harga Stock Token |
| Data | Chainlink Data Feeds | Harga resmi Stock Token untuk analisis dan penilaian prediksi |
| Otak | LLM API + tool calling | Analisis, ringkasan, jawaban mention; prompt persona "superintelligence" |
| Filter | `RiskGuard` (kode, bukan AI) | Blokir ajakan beli/jual, blokir token yang terlalu baru, wajib disclaimer |
| Bukti | `NexaLedger` (Solidity) | `commit(hash)` sebelum posting, `reveal()` saat jatuh tempo, skor otomatis dari oracle |
| Publikasi | X API + web dashboard | Post publik, alert Pro real-time, halaman Proof of Intelligence |

**Detail teknis penting:**

- **Alamat kontrak Pons V2** untuk indexer (factory, hook, graduation executor) tersedia di dokumentasi Bitquery; contoh: factory `0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e` ([Bitquery](https://docs.bitquery.io/docs/blockchain/robinhood/pons-api/)). Verifikasi ulang ke dokumen resmi Pons sebelum produksi.
- **Biaya X API:** sejak Februari 2026 model default adalah pay-per-use: sekitar $0,015 per post biasa, $0,20 per post yang berisi link, dan $0,005 per post yang dibaca ([Postproxy](https://postproxy.dev/blog/x-api-pricing-2026)). Jadi NEXA sebaiknya memposting tanpa link; link ditaruh di bio dan web.
- **Batas fitur X:** follow, like, dan quote-post tidak tersedia di pay-per-use, hanya Enterprise ([Blotato](https://www.blotato.com/blog/twitter-api-pricing)). Rancang NEXA untuk posting dan reply saja.
- **Commit-reveal:** hash = keccak(teks prediksi, aset, arah, horizon, salt). Salt dirahasiakan sampai reveal, supaya prediksi tidak bisa disalin sebelum terbukti.
- **Human-in-the-loop di 30 hari pertama:** semua post masuk antrian persetujuan; setelah filter terbukti stabil, hanya reply berisiko yang perlu persetujuan.

**Stack:** TypeScript worker (viem) di server, Postgres untuk antrian dan log, Foundry untuk `NexaLedger`, Next.js untuk web.

## Launch via Pons V2 & tokenomics

$NEXA memakai pola burn yang sama: 30% creator fee Pons dan 20% protocol fee NEXA masuk `BurnVault` yang membakar $NEXA.

**Mekanik Pons V2** ([Datawallet](https://www.datawallet.com/crypto/pons-explained)): bonding curve lalu graduate ke pool Uniswap v4 terkunci permanen; fee 1% per trade, 30% untuk Pons, sisanya creator; fee dibayar dalam aset pasangan; penerima fee bisa dialihkan. Buyback bawaan Pons dikunci 5 tahun, tidak dibakar, jadi pakai `CreatorFeeSplitter` sendiri.

| Aliran fee | Sumber | Ke BurnVault | Sisa |
| --- | --- | --- | --- |
| Creator fee | Bagian creator dari fee 1% trading $NEXA di Pons | 30% | 70% treasury: biaya AI, X API, marketing |
| Protocol fee | Langganan Pro, API, kredit Ask NEXA, laporan sponsor | 20% | 80% operasional |

**Ide pairing yang paling menjual: Stock Token NVDA.** "AI influencer yang di-pair dengan saham AI" adalah narasi kuat, dan Pons V2 mengizinkan pairing dengan Stock Token. Contoh pasarnya sudah ada: Artificial Inu yang di-pair dengan NVDA naik dari market cap $1,5 juta ke puncak $135 juta pada Agustus 2026 ([Datawallet](https://www.datawallet.com/crypto/pons-explained)). Risikonya: harga $NEXA ikut naik-turun dengan saham Nvidia, dan creator fee diterima dalam NVDA (perlu dijual sebagian untuk biaya operasional). Alternatif aman: ETH.

**Pengaturan launch:** opening buy via launch-and-buy dan diumumkan; creator tax tambahan 0%; rasio 30/20 di-hardcode.

**Aturan emas:** NEXA tidak pernah membahas harga $NEXA dan tidak pernah menyuruh orang membelinya. Agent yang mempromosikan tokennya sendiri merusak kredibilitas "Proof of Intelligence".

**Utilitas $NEXA:** holder di atas ambang tertentu mendapat alert Pro lebih cepat dan kredit Ask NEXA gratis tiap bulan.

## Model bisnis web yang profitable

Post publik NEXA adalah iklan gratisnya; uangnya datang dari versi yang lebih cepat dan lebih dalam: alert real-time, API sinyal, dan analisis on-demand.

| Sumber pendapatan | Harga | Isi |
| --- | --- | --- |
| NEXA Pro | $19/bulan | Alert real-time di web + Telegram; post publik di X ditunda 15 menit |
| Ask NEXA | $1 per analisis kontrak / token | Laporan risiko lengkap untuk satu alamat, dibayar USDG |
| Signals API | $499/bulan | Feed JSON untuk bot trading, dashboard, dan komunitas |
| Sponsored deep-dive | $750 per laporan | Riset proyek berlabel "Sponsored" yang jelas, tanpa rekomendasi beli |

**Unit economics bulanan (semua angka asumsi untuk perencanaan):**

| Pos | Asumsi | USD/bulan |
| --- | --- | --- |
| NEXA Pro | 500 pelanggan × $19 | 9.500 |
| Signals API | 3 klien × $499 | 1.497 |
| Ask NEXA | 1.000 analisis × $1 | 1.000 |
| Sponsored deep-dive | 2 laporan × $750 | 1.500 |
| BurnVault | 20% dari pendapatan $13.497 | −2.699 |
| X API | 1.440 post × $0,015 + 20.000 read × $0,005 | −122 |
| LLM API | Perkiraan, perlu diukur | −800 |
| Indexer, RPC, server |  | −700 |
| **Margin operasional** |  | **9.176** |

Biaya terbesar bukan X, melainkan LLM: batasi analisis panjang hanya untuk Pro dan Ask NEXA, dan pakai model lebih kecil untuk post rutin.

**Fitur web yang menjual:**

- **Proof of Intelligence:** win rate, rata-rata return prediksi, dan setiap commit dengan link Blockscout. Ini halaman yang membuat tema "superintelligence" terasa nyata.
- **NEXA vs KOL:** leaderboard yang membandingkan akurasi NEXA dengan call publik KOL lain (yang mau ikut dinilai).
- **Rug radar:** daftar launch Pons dengan red flag, diperbarui real-time.
- Halaman burn tracker $NEXA.

## Aturan konten, roadmap & risiko

Persona boleh "superintelligence", tapi aturan kontennya harus lebih ketat dari influencer manusia, karena satu post menyesatkan bisa merusak seluruh brand.

**Aturan konten yang di-hardcode di `RiskGuard`:**

- Akun berlabel automated di X dan bio menyatakan "AI agent, bukan nasihat keuangan".
- Tidak ada kalimat "beli", "jual", "pasti naik", atau target harga untuk token mana pun.
- Tidak pernah membahas $NEXA selain pengumuman teknis dan burn.
- Konten sponsor selalu diawali label "Sponsored".
- Tidak membahas token yang umurnya di bawah 1 jam (mencegah agent dipakai untuk pump).
- Jika data tidak lengkap, NEXA bilang tidak tahu, bukan menebak.

**Roadmap:**

1. **Minggu 1–2:** indexer Robinhood Chain + Pons V2, `NexaLedger` di testnet 46630.
2. **Minggu 3–4:** otak AI + RiskGuard, antrian persetujuan manusia, web Proof of Intelligence.
3. **Minggu 5–8:** NEXA posting di X selama 30 hari dengan prediksi harian yang di-commit, untuk membangun track record sebelum token ada.
4. **Minggu 9:** audit `NexaLedger` dan splitter, lalu launch $NEXA di Pons V2.
5. **Minggu 10+:** NEXA Pro, Ask NEXA, Signals API.

| Risiko | Mitigasi |
| --- | --- |
| AI membuat klaim salah atau halusinasi | RiskGuard berbasis kode, data hanya dari indexer dan oracle, review manusia di awal |
| Dianggap memberi nasihat investasi tanpa izin | Tanpa ajakan beli/jual, disclaimer, konsultasi hukum; cek aturan OJK untuk tim di Indonesia |
| Akun X kena suspend | Ikuti aturan automation X, pakai API resmi, siapkan kanal cadangan (Telegram, web) |
| Harga X API berubah | Pantau halaman resmi; desain tanpa link dan read seminimal mungkin |
| Track record buruk di awal | Itulah gunanya 30 hari sebelum token: perbaiki model sebelum ada uang publik |
| Pairing NVDA membuat harga $NEXA ikut volatil | Pertimbangkan ETH jika ingin lebih stabil |

### Sources

- [Postproxy: X API Pricing 2026](https://postproxy.dev/blog/x-api-pricing-2026)
- [Blotato: X API pricing and Enterprise-only actions](https://www.blotato.com/blog/twitter-api-pricing)
- [Bitquery: Pons V2 contracts on Robinhood Chain](https://docs.bitquery.io/docs/blockchain/robinhood/pons-api/)
- [Datawallet: Pons Explained](https://www.datawallet.com/crypto/pons-explained)
- [Envio: Index Every Tokenized Asset on Robinhood Chain](https://docs.envio.dev/blog/index-robinhood-chain-data)
