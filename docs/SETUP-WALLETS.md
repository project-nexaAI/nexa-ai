# Setup Wallet NEXA (manual)

Panduan ini untuk **manusia**, bukan untuk Claude Code. Semua langkah yang menyentuh private key dilakukan sendiri di terminal atau dashboard Anda. Private key **tidak pernah** ditempel ke chat, Claude Code, repo, atau file `.env`.

| Wallet   | Alamat publik (0x…) masuk ke    | Private key masuk ke                                                                         |
| -------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| Deployer | Sudah diisi di `CLAUDE.md`     | Foundry keystore `deployer` (laptop Anda)                                                  |
| Agent    | `.env` → `AGENT_ADDRESS`    | Foundry keystore `nexa-agent` (laptop Anda) **dan** Railway → `AGENT_PRIVATE_KEY` |
| Treasury | `.env` → `TREASURY_ADDRESS` | **Tidak ke mana pun.** Tetap hanya di MetaMask                                         |

Alamat publik aman dibagikan. Private key tidak.

---

## 1. Alamat publik → `.env`

```bash
# Jalankan di: ROOT (nexa-ai/)
cp .env.example .env      # hanya jika .env belum ada
```

Buka `.env` dengan editor, lalu isi dua baris ini (salin alamat dari MetaMask):

```bash
AGENT_ADDRESS=0x...       # alamat akun "NEXA Agent"
TREASURY_ADDRESS=0x...    # alamat akun "NEXA Treasury"
```

`.env` tidak ikut ter-commit (sudah ada di `.gitignore`). Claude Code membaca alamat dari sini.

---

## 2. Private key agent → Foundry keystore (laptop)

Dipakai untuk mengecek alamat dan untuk script yang dijalankan manual dari laptop.

1. MetaMask → ⋮ di akun **NEXA Agent** → Detail akun → **Tampilkan kunci pribadi** → salin.
2. Di terminal:
   ```bash
   # Jalankan di: terminal Anda (folder mana saja)
   cast wallet import nexa-agent --interactive
   ```

   Tempel private key (tidak terlihat saat diketik), lalu buat password keystore.
3. Cek hasilnya. Output harus sama persis dengan `AGENT_ADDRESS`:
   ```bash
   cast wallet address --account nexa-agent
   ```

---

## 3. Private key agent → Railway (server)

Lakukan **setelah** Claude Code menjalankan perintah "Deploy testnet" dan project Railway sudah ada.

1. Buka dashboard Railway → project `nexa-ai-testnet` → service **worker** → tab **Variables**.
2. Tambah variable:
   - Name: `AGENT_PRIVATE_KEY`
   - Value: private key NEXA Agent (salin dari MetaMask, tempel, simpan)
3. Railway akan me-restart worker. Commit/reveal otomatis aktif setelah variable ini ada.

Jangan isi `AGENT_PRIVATE_KEY` di service `api` atau `indexer`, karena hanya `worker` yang butuh.

---

## 4. Treasury: cukup alamat

- Jangan ekspor private key treasury.
- Jangan import ke Foundry, Railway, atau mana pun.
- Alamatnya dipakai saat deploy `CreatorFeeSplitter` (minggu 9) sebagai penerima 70% fee.

---

## 5. Isi saldo

| Wallet   | Testnet                                             | Mainnet (nanti)                     |
| -------- | --------------------------------------------------- | ----------------------------------- |
| Deployer | ETH dari https://faucet.testnet.chain.robinhood.com | ETH secukupnya untuk deploy         |
| Agent    | Sedikit ETH dari faucet                             | Sedikit ETH untuk gas commit/reveal |
| Treasury | Tidak perlu                                         | Tidak perlu (hanya menerima)        |

---

## 6. Cek semuanya

```bash
# Jalankan di: ROOT (nexa-ai/)
pnpm check:wallets
```

Script ini (dibuat Claude Code) hanya membaca alamat publik dan keystore, tanpa pernah menampilkan private key. Yang dicek:

- format dan checksum `AGENT_ADDRESS` dan `TREASURY_ADDRESS`
- ketiga alamat berbeda satu sama lain
- `cast wallet address --account deployer` dan `--account nexa-agent` cocok dengan alamatnya
- saldo ETH deployer dan agent di testnet

Setelah semuanya hijau, beri tahu Claude Code: **"Wallet sudah diisi"**.

---

## Jika private key bocor

Misalnya tertempel di chat, ter-commit, atau ter-screenshot:

1. Buat akun baru di MetaMask.
2. Pindahkan saldo dari akun lama ke akun baru.
3. Ulangi panduan ini dengan alamat baru.
4. Jika yang bocor adalah agent: ganti `AGENT_PRIVATE_KEY` di Railway, dan minta Claude Code memperbarui alamat agent di `NexaLedger`.
