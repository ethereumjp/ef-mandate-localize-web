# M5 Reading Comments — Manual Demo Checklist

Use this checklist to verify the end-to-end comment-reading flow on a local or deployed build.
CI does not run these steps (no wallet / Sepolia RPC available there).

Prerequisite: complete the M4 checklist first — you need at least one attestation in the schema before M5 reading is meaningful.

## Prerequisites

- [ ] MetaMask or Rabby installed in the browser
- [ ] Sepolia ETH in the wallet (faucet: `sepoliafaucet.com` or Alchemy Sepolia faucet)
- [ ] `.env` set up and site built with `PUBLIC_EAS_SCHEMA_UID` (see README M4 setup)
- [ ] At least one attestation already posted via the M4 flow

## Steps

1. **Env + build**
   - [ ] Confirm `.env` contains `PUBLIC_EAS_SCHEMA_UID=0x<uid>` (same UID as M4)
   - [ ] `pnpm dev` (or `pnpm build && pnpm preview` for a static artifact)
   - [ ] Open `http://localhost:4321` (or preview URL)

2. **Enable comments**
   - [ ] Click the **Comments** toggle in the toolbar — it should turn on (active state)

3. **Connect wallet (optional for reading)**
   - [ ] Click **Connect** in the toolbar and approve in MetaMask / Rabby
   - [ ] Switch to **Sepolia** (chain id 11155111)
   - [ ] Note: reading attestations does not require a connected wallet; the connect step is only needed to post new comments

4. **Post a comment (if none exist)**
   - [ ] In chapter 02, click and drag to select a phrase
   - [ ] Click the 💬 popover button → write a short body → click **Publish**
   - [ ] Approve the transaction in MetaMask / Rabby; wait for confirmation

5. **Reload and verify reading from chain**
   - [ ] Reload the page (with Comments still toggled on)
   - [ ] The phrase you commented on should appear **highlighted in amber**
   - [ ] The block's **gutter badge** (💬 + count) should appear on the left margin

6. **Open the thread panel**
   - [ ] Click the gutter badge
   - [ ] The **CommentThread** panel opens on the right side, showing:
     - [ ] The quoted text
     - [ ] The comment body
     - [ ] A short author address (0x…) and timestamp
     - [ ] Anchor-status badge: nothing for a freshly anchored comment

7. **Verify anchor status after a source edit**
   - [ ] Edit the source text of the commented block in the content file — change a few words around the quote
   - [ ] Rebuild (`pnpm build` or let `pnpm dev` hot-reload)
   - [ ] Reload the page with Comments on
   - [ ] Expected outcomes:
     - **Re-anchored**: the quote was found at a new position → amber **`re-anchored`** badge on the card; the phrase is still highlighted; the localized **"Comment for past version"** label appears
     - **Needs review**: the quote is gone or ambiguous → the comment moves to the **Needs Review** section at the bottom of the panel (not shown inline); a **`needs review`** badge appears; no highlight for that span

8. **Toggle off**
   - [ ] Click the Comments toggle to turn it **off**
   - [ ] All amber highlights, gutter badges, and the thread panel should disappear immediately

## Pass criteria

All checkboxes above completed without errors. Comments posted in M4 are visible in the thread panel when M5 reading is active. Anchor-status badges and the "Comment for past version" label appear correctly after a source edit.

## Notes

- ENS author name resolution and the reply Composer in the thread panel are deferred to later milestones.
- `needs-review` and `orphaned` comments never appear as inline highlights — they are always in the Needs Review section of the panel.
- If no highlights appear after reload, confirm `PUBLIC_EAS_SCHEMA_UID` was set at build time and that the schema has non-revoked attestations on Sepolia.
