# M4 Commenting — Manual Demo Checklist

Use this checklist to verify the end-to-end commenting flow on a local or deployed build.
CI does not run these steps (no wallet / Sepolia RPC available there).

## Prerequisites

- [ ] MetaMask or Rabby installed in the browser
- [ ] Sepolia ETH in the wallet (faucet: `sepoliafaucet.com` or Alchemy Sepolia faucet)
- [ ] `.env` set up and site built with `PUBLIC_EAS_SCHEMA_UID` (see README M4 setup)

## Steps

1. **Env + schema**
   - [ ] `cp .env.example .env`
   - [ ] Run `pnpm run schema:register` with a funded throwaway key → copy the printed UID into `.env` as `PUBLIC_EAS_SCHEMA_UID`
   - [ ] (Or register the same schema string at [sepolia.easscan.org](https://sepolia.easscan.org) and copy the UID)

2. **Start the site**
   - [ ] `pnpm dev` (or `pnpm build && pnpm preview` for a static build)
   - [ ] Open `http://localhost:4321` (or preview URL)

3. **Enable comments**
   - [ ] Click the **Comments** toggle in the toolbar — it should turn on (active state)

4. **Connect wallet**
   - [ ] Click **Connect** in the toolbar
   - [ ] Approve the connection in MetaMask / Rabby

5. **Switch to Sepolia**
   - [ ] In MetaMask / Rabby, switch the network to **Sepolia** (chain id 11155111)
   - [ ] The UI should reflect the connected state without errors

6. **Select text**
   - [ ] In any chapter block, click and drag to select a phrase
   - [ ] A popover with a 💬 button should appear near the selection

7. **Open the Composer**
   - [ ] Click the 💬 button
   - [ ] The Composer panel should open, showing the selected quote

8. **Fill in the comment**
   - [ ] Write a short body (e.g. "Test comment for M4")

9. **Publish**
   - [ ] Click **Publish**
   - [ ] MetaMask / Rabby should prompt for transaction approval
   - [ ] Approve the transaction

10. **Optimistic badge**
    - [ ] A comment badge should appear on the selection immediately (optimistic state)
    - [ ] After the transaction confirms, the badge should resolve to confirmed state

11. **Verify on easscan**
    - [ ] Open [sepolia.easscan.org](https://sepolia.easscan.org) in a new tab
    - [ ] Search for your wallet address or the schema UID
    - [ ] Confirm the new attestation appears with the expected fields (spanPrefix, spanSuffix, blockId, blockHash, body, lang)

## Pass criteria

All checkboxes above completed without errors. The attestation is visible on easscan.org Sepolia within a few minutes of the transaction confirming.

## Notes

- Reading existing attestations back into the page (gutter thread view) is **M5** — the comments posted here will be visible in M5.
- If the Composer shows "Connect a wallet on Sepolia (and set PUBLIC_EAS_SCHEMA_UID)", the build was made without `PUBLIC_EAS_SCHEMA_UID` set. Rebuild after updating `.env`.
