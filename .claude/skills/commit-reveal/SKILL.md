---
name: commit-reveal
description: Dipakai saat menyentuh hash prediksi atau alur commit/reveal.
---
Hash: keccak256(abi.encode(string text, address asset, uint8 direction, uint32 horizon, bytes32 salt)), identik di Solidity (contracts/) dan TS (packages/shared). Vektor test JSON bersama di packages/shared/test-vectors/commit-reveal.json, dipakai forge test dan Vitest. Salt terenkripsi, tidak pernah di log. Brief bagian NexaLedger.
