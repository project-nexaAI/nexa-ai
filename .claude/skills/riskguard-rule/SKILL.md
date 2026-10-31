---
name: riskguard-rule
description: Dipakai saat menambah atau mengubah aturan konten RiskGuard.
---
Aturan di packages/riskguard. Setiap aturan wajib test lolos + diblokir (ID & EN), sinkron dengan CLAUDE.md bagian 9. Output: { allowed, reasons[], requiresApproval }, keputusan dicatat di log. Jalankan: pnpm --filter @nexa-ai/riskguard test
