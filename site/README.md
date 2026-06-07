# EF Mandate — Commentary Site

A reading website with an on‑chain commentary layer. It is kept here under `site/` as a **separate project** from the translation sources in `../source/`.

## What it does

- Language toggle (EN / JA, more later), with the UI chrome localized to the selected language
- Commentary on/off
- Wallet‑authenticated commentary on any text span, recorded as **EAS** attestations, with anchoring that survives edits to the original and translations
- Delivery via **GitHub Pages** (`config.json`) or **IPFS + ENS `contenthash`**

## Design

- [`docs/specs/2026-06-07-onchain-commentary-design.md`](docs/specs/2026-06-07-onchain-commentary-design.md)

## Status

Demo (work in progress) on branch `feat/commentary` — Sepolia for the demo, Ethereum mainnet for production.

## Stack

Astro · Tailwind CSS · Base UI (headless) · wagmi (+ viem) · ethers v6 (via wagmi's adapter) · `@ethereum-attestation-service/eas-sdk` · EAS GraphQL. Fully static, no backend.
