---
name: post-pipeline
description: Dipakai saat menyentuh alur posting.
---
Urutan wajib: AI -> RiskGuard -> commit terkonfirmasi (tx hash tersimpan) -> antrian persetujuan -> post. Mode X_POST_MODE=dry|live. Post publik ditunda 15 menit dari alert Pro. Tanpa URL di post.
