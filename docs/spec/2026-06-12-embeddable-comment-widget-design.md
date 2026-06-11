# Embeddable quote & comment widget — add to any site via `<script>`

- Date: 2026-06-12
- Status: Approved (design) → next: implementation plan (writing-plans)
- Target repo: `ef-mandate-localize-jp` (`site/`)
- Related code (reused): `site/src/anno/{canonicalUrl,read,locate,selector,schema,author}.ts`, `site/src/web3/{highlight,config,ethers,eas}.ts`, `site/src/components/comments/*`
- Related code (migration target): `site/src/components/comments/CommentApp.tsx`, `site/src/components/Document.astro`, `site/src/components/Toolbar.astro`, `site/src/scripts/toggles.ts`
- Prior design: `docs/superpowers/specs/2026-06-11-generalized-comment-schema-design.md` (the anno schema). This widget implements that effort's **Plan 2** as an *embeddable widget* (instead of a Chrome extension) and subsumes **Plan 3** (migrating the site onto the generalized schema).

## 1. Background and goal

The current on-chain (EAS) comment feature is embedded in the translation site (`site/`) as a React island `CommentApp` (`client:only`). We want to redesign it so any site can add "select text → comment" with a single `<script>` tag — an **embeddable widget**.

The hard parts already live in the `anno/` layer and are **delivery-agnostic**:
- `buildAnnoFields` (selection `Range` → `nearestContainer` + `selectorFor` + TextQuote; no `data-block-id` needed)
- `fetchAnno` (EAS Sepolia GraphQL read), `projectAnno`/`commentsForUrl`/`locate` (project onto live DOM), `canonicalizeUrl` (URL scoping)

`CommentApp` is also fully client-side React (`client:only`, no SSR). So the work is mainly **(a) decoupling from the host site** and **(b) packaging (Shadow DOM + two-stage load)**.

Current host couplings (to remove):
- Portals the connect button into the host's `#wallet-slot` via `createPortal` (`CommentApp.tsx:124-127,366`)
- Drives display on/off from the host's `data-comments` attribute (the site's `scripts/toggles.ts`) (`CommentApp.tsx:130-149`)
- Authoring is hardwired to `[data-block-id]` (`CommentApp.tsx:165,176,295`) — it does not use `buildAnnoFields`

## 2. Design decisions (decision log)

| # | Question | Decision | Rationale |
|---|---|---|---|
| Q1 | Ambition | **(A) Reusable embed for my own / known sites**. Wallet + gas friction is acceptable | Avoids the weight of a public SaaS (multi-tenancy, moderation, gasless). Fastest path via a thin shell |
| Q2 | Relationship to the translation site | **(i) Unify**: the widget is the single implementation, and the translation site embeds the same widget (the island is retired) | DRY, one code path. Subsumes Plan 3 from the prior memo |
| Isolation | UI isolation method | **Shadow DOM** (iframe ruled out) | An annotation widget must read the host's text selection and paint highlights on host text — impossible from an iframe |
| Delivery | Packaging / load | **Two-stage load**: a light loader (read/display) + a lazy app (authoring/wallet/EAS) | The read path is pure TS/DOM (no React/wallet), so pages without commenting stay light |
| Chain | Network | **Sepolia by default, overridable via `data-network`/`data-rpc`** | Keeps the status quo; sufficient for use case (A) |

## 3. Architecture (two-stage load + Shadow DOM)

```
<script src="embed.js" data-schema-uid=0x… data-network=sepolia></script>   ← the one line a site owner pastes
   │
   ├─ Stage 1  loader (small, immediate, IIFE)
   │     parse config → append a host element to document.body → attachShadow({mode:"open"})
   │     → inject the floating button → start the display controller
   │       (fetchAnno → projectAnno → Custom Highlight paint / on-off / count badge)
   │     no React, no wallet, no EAS SDK
   │
   └─ Stage 2  app (heavy, lazy import)
         on "open panel" / "select text → comment" / "click a highlight" it import()s for the first time
         → mounts React (CommentController) into the same shadow root, taking over from the display controller
         → wagmi connect · buildAnnoFields authoring · composer · thread · EAS write
```

## 4. Module boundaries

| Layer | Composition (new = 🆕 / reused = ♻️) | React/Wallet | Load |
|---|---|---|---|
| **`widget/core`** | ♻️ `anno/{canonicalUrl,read,locate,selector,schema,author}`, ♻️ `web3/highlight`, 🆕 `widget/display.ts` (display controller: fetch→project→paint→on/off→count), 🆕 `widget/config.ts` (parse data attrs), 🆕 `widget/mount.ts` (create shadow host, inject CSS) | none | Stage 1 |
| **`widget/loader.ts`** + 🆕 `widget/button.ts` | Stage 1 entry (IIFE): config→mount→`button.ts` (floating button + count badge + on/off)→start display→lazy trigger | none | Stage 1 |
| **`widget/app.tsx`** | 🆕 Stage 2 entry (lazy import). The host-decoupled ♻️ `CommentController` mounted into the shadow root. ♻️ `components/comments/*`, `web3/{config,ethers,eas}` | yes | Stage 2 |

### Deferred follow-up #1, done as part of this work (promote to a neutral `lib/`)
`anno/author.ts` and `anno/locate.ts` currently import `normalizedBlockText`/`selectionToOffsets`/`anchorFromSelection` from `web3/selection.ts` (a reusable layer depending on a site-specific one — a backwards dependency). To keep `widget/core` free of `web3/`, promote these to a neutral `lib/` module (e.g. `lib/anchor-dom.ts`) and point both `anno/` and `web3/selection.ts` at it.

## 5. Shadow DOM and isolation

- Append a single host element to `document.body` → `attachShadow({mode:"open"})`. **The button, panel, composer, and popover all render inside this shadow root** (no CSS bleed in either direction).
- React `createPortal` targets and the base-ui Dialog portal container point at **an element inside the shadow root** (replacing the current `document.body`/`#wallet-slot` portals).
- The Stage 1 button CSS is hand-written and tiny. The Stage 2 Tailwind v4 CSS is imported as a string via `import css from "./app.css?inline"` and **injected through `shadowRoot.adoptedStyleSheets`** (preflight stays contained in the shadow root).
- Highlights are painted on the host body via the Custom Highlight API (`CSS.highlights` is **document-global**). The `::highlight(comment)`/`::highlight(comment-focus)` **style rules do not apply inside a shadow root**, so inject one tiny `<style>` into `document.head` for them. Ranges reference host-document nodes (reuse `web3/highlight.ts`'s `rangeForOffsets`/`applyHighlights` as-is).

## 6. Button & display-toggle UX

- A floating button at `data-position` (default `bottom-right`), showing a comment-count badge.
- **Display on/off** = show/hide the highlights. Handled entirely in Stage 1 (light). The state lives inside the widget (replacing the old `data-comments` dependency).
- **Opening the panel** (list/reply/compose), **selecting text → "comment" popover**, or **clicking a highlight** lazily `import()`s Stage 2.
- After Stage 2 loads, ownership of highlights/focus is handed off to Stage 2 (React) and the Stage 1 controller is disposed (avoiding double painting).

## 7. Authoring generalization (removing host coupling)

- Change `CommentController`'s `selectionchange` handler: instead of walking up to `[data-block-id]`, resolve the stable ancestor via `nearestContainer(range.commonAncestorContainer)`.
- Replace AnnoFields construction `annoFieldsFromTarget` (which assumes `data-block-id`) with **`buildAnnoFields({ href, lang, range, body })`** (`rootSelector = selectorFor(container)`). This works on arbitrary DOM beyond the translation site.
- Remove the `#wallet-slot` portal and the host `data-comments` coupling → replace with the widget's own button state and toggle.

## 8. Configuration (script-tag data attributes)

The loader reads these from `document.currentScript`:

| Attribute | Required | Default | Purpose |
|---|---|---|---|
| `data-schema-uid` | ✓ | — | ANNO EAS schema UID |
| `data-network` | | `sepolia` | Chain |
| `data-rpc` | | publicnode | Write RPC |
| `data-eas-graphql` | | sepolia.easscan | Read endpoint |
| `data-position` | | `bottom-right` | Button position |
| `data-lang` | | `document.documentElement.lang` | Comment language tag |
| `data-theme` | | `auto` | light/dark/auto |

## 9. Wallet

- Reuse wagmi/injected, with the network/RPC injected from config (change the current `web3/config.ts` `wagmiConfig` into a function that builds the config from settings). Sign-in happens in the Stage 2 panel.
- Guard multiple includes with a singleton (do not mount twice if a host element already exists).
- **Read/display works without a connected wallet**; only writes require connecting. Prompt a chain switch if on the wrong network.

## 10. Translation-site migration (host-ification)

- The translation site drops the `CommentApp` island, `#wallet-slot`, the toolbar comments toggle, and the `data-block-id` authoring path, and instead **includes `embed.js` with one line, like any other host**.
- The existing `[data-block-id]` elements remain as stable containers (`selectorFor` produces/uses `[data-block-id="…"]`). The connect button and display toggle move into the widget.
- Language is passed via `data-lang` (the page's `lang`). This is the **final phase** (after the standalone widget works).

## 11. Build / packaging

- A new Vite library build (separate from the Astro build, e.g. `vite.config.widget.ts`). Two entries:
  - `loader` (single IIFE file `embed.js`).
  - `app` (a hashed chunk imported lazily).
- **The loader resolves the app chunk's base URL from its own `<script src>` (`document.currentScript.src`)** and dynamically imports it (so the include stays a single line). This is the trickiest build piece — use Vite's `base`/`experimental.renderBuiltUrl`, or resolve it loader-side (`import(/* @vite-ignore */ baseUrl + "app.js")`).
- The app CSS is bundled into the JS via `?inline` and injected into the shadow root (avoids shipping a separate `.css`, keeping the include one line).

## 12. Data / schema

- The ANNO schema UID is **not yet registered**. The embed requires a real UID → register via `pnpm anno:schema:register` (a funded Sepolia key) and set each site's `data-schema-uid`.
- Comments are scoped per page by `urlCanonical` (`commentsForUrl`). The schema also carries `origin` for a future site-level scope, but v1 is URL-scoped only.

## 13. Error handling / invariants

- No wallet → read/display continues; the write UI becomes a "connect" prompt.
- Wrong chain → prompt a switch. `data-schema-uid` unset → composing disabled, read-only (generalizing the existing `if (!signer || !SCHEMA_UID)` guard).
- Lazy app chunk fails to load → show an error on the button and a retry toast.
- Multiple includes → second and later ones are no-ops.

## 14. Testing

- Unit-test `widget/core` in jsdom: the display controller (fetch→project→paint→on/off→count), `buildAnnoFields`, `fetchAnno` (mocked fetch), projection.
- The loader's mount (shadow-root creation, button injection, config parsing) and a Shadow isolation smoke test.
- Keep the existing 106 tests green (follow the import-path changes from the `lib/` promotion).
- `.astro`/React UI components are out of scope for tests (logic is concentrated in core/pure functions).

## 15. Implementation phases (plan decomposition outlook)

1. **Core extraction + host decoupling**: promote `lib/anchor-dom.ts`; refactor `CommentController` to "own button/toggle + `buildAnnoFields` authoring + shadow-root portals". Still runs inside the translation site (island) for regression checking.
2. **Two-stage embed packaging**: add `widget/{config,mount,display,button,loader,app}`, the Vite widget build (two entries, lazy import, `?inline` CSS), `data-*` config, and turn `wagmiConfig` into a config-built function. Verify on a blank page and a known page.
3. **Translation-site migration**: remove the island and host couplings from `Document.astro`/`Toolbar.astro`/`toggles.ts` and switch to an `embed.js` include. Verify UX regression (connect button, display toggle, sidebar).

## 16. Out of scope (YAGNI)

- Public SaaS productization (multi-tenant config UI, moderation, billing, CDN distribution).
- Gasless / meta-transactions, L2 rollout (v1 is on-chain Sepolia, wallet + gas assumed).
- Element/media annotation (text-only continues).
- A Chrome-extension shell (addable later from the same `widget/core`, but out of scope here).
- The iframe approach.
