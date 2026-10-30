# Pemetaan desain → data/endpoint

Sumber: `docs/html-design/nexa-1.html` (satu halaman landing). Komponen di `apps/web/src/components/landing/`.
Data diambil lewat `@nexa-ai/api-client` (`NEXT_PUBLIC_USE_FIXTURES=true` → fixture di `docs/api/fixtures/`).

| Bagian (id) | Komponen | Isi | Sumber data | Endpoint | Status |
| --- | --- | --- | --- | --- | --- |
| Nav, mobile menu | `Nav` | Tautan jangkar, "Follow on X" | `NEXT_PUBLIC_X_HANDLE` | — | Statis |
| Hero (`#hero`) | `Hero` | Tagline, 3D scene, statistik "1 / day", "7 days" | Statis (copy dari brief) | — | Statis |
| Marquee | `Marquee` | Daftar fitur | Statis | — | Statis |
| Proof: kartu "Example commit" (`#exHash`, `#exCount`) | `Proof` | Hash, aset, arah, horizon, hitung mundur reveal | Commit terbaru | `GET /proof` → `current.prediction`; detail `GET /predictions/:id` | **Fixture**. Tanpa commit: contoh ilustrasi desain |
| Proof: gauge "Public win rate" (`#gArc`) | `Proof` | Win rate, rata-rata return | `stats`, `formatted` | `GET /proof` | **Fixture** (kosong = teks "Published after the first call is scored") |
| Proof: "Prediction of the Day" (`#days`, "Day 4 of 7") | `Proof` | Hari ke-N dari 7 | `current.day` | `GET /proof` | **Fixture** |
| Feed: grafik DEX vs Chainlink | `Feed` | Ilustrasi (label "Illustration") | — | — | Ilustrasi statis (belum ada data) |
| Feed: "Rug radar" + "Pons V2 launches" | `Feed` | Radar dan baris launch + red flag (label "Illustration") | Launch Pons + red flag | `GET /rug-radar` | **Task**: endpoint belum ada; tampilan masih ilustrasi desain |
| Feed: "Mentions" | `Feed` | Contoh percakapan (label "Example") | — | — | Statis |
| How (`#how`) | `How` | Pipeline commit → post → reveal | Statis | — | Statis |
| Pricing (`#pricing`) | `Pricing` | $19 / $1 / $499 / $750 | Statis (brief) | — | Statis; dibuka minggu 10+ (`PAID_FEATURES_ENABLED`) |
| Rules (`#rules`) | `Rules` | Karusel aturan RiskGuard | Statis, cermin `packages/riskguard` | — | Statis |
| Token (`#token`) | `Token` | Aliran fee 30/20, BurnVault | Statis (rasio hardcode) | `GET /burn` untuk burn tracker | **Task**: halaman burn tracker belum ada di desain |
| Roadmap, CTA, Footer | `Roadmap`, `Cta`, `Footer` | Statis | — | — | Statis |

## Placeholder & kekurangan di desain (lihat BLOCKERS.md)

- `__X_HANDLE__` (7 tautan + `twitter:site`): diisi `NEXT_PUBLIC_X_HANDLE`. Handle belum diberikan, jadi tautan menjadi `#`.
- `__SITE_URL__` (canonical, og:url, og:image): `NEXT_PUBLIC_SITE_URL`.
- `/og-image.png` dirujuk metadata tetapi tidak ada di `docs/html-design/`.
- Halaman `/privacy` dirujuk footer tetapi tidak ada (butuh teks hukum dari pemilik proyek).
- Halaman web lain di brief tanpa desain: detail prediksi (`/predictions/:id`), NEXA vs KOL (`/leaderboard`), Rug radar penuh, Burn tracker.
- Font dari Google Fonts (Geist, Geist Mono, Instrument Serif) dipakai apa adanya.
- three.js: desain memuat dari CDN jsdelivr; di web dipasang dari npm (`three@0.165.0`, versi sama).
