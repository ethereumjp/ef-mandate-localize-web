# Widget Theme: Terminal Cobalt

**Date:** 2026-06-15
**Status:** Design approved, ready for planning
**Topic:** Restyle the commentary widget from a neutral, host-adaptive "chameleon" into a fixed, opinionated blue-on-white terminal/developer aesthetic.

## Problem & Intent

Today the widget is designed to blend into whatever host site embeds it:

- Launcher and popover are monochrome (near-black `#1c1917` + stone grays), brandable via a `data-accent` CSS variable.
- Quotes and selection highlights use amber.
- The React panel uses Tailwind `stone` neutrals with `dark:` variants throughout.

We want the opposite. The commentary layer is a *separate system* that sits on top of someone else's content, and it should **read as a distinct tool, not as part of the article**. A crisp, fixed blue-and-white identity (inspired by `hermes-agent.nousresearch.com`) makes the "this is the annotation layer" boundary obvious and gives the widget its own product identity.

The refined direction is **terminal/developer flavored** rather than glossy/AI-flavored: monospace, square corners, a single electric blue, hierarchy via opacity.

## Design Decisions

### 1. Single color: `#0C0CFF`

- **Text and accent are the same color**, `#0C0CFF` (pure electric blue), everywhere.
- **Hierarchy is expressed only via `opacity`**, not via different gray text colors. Reference opacities from the mockup:
  - Primary body text: `1.0`
  - Quoted text / secondary: `~0.65`
  - Meta (author, timestamp), reply affordance: `~0.45–0.6`
  - Placeholder text: `~0.4`
- Borders use the same blue at low opacity (e.g. `rgba(12,12,255,0.30–0.45)`).
- **Gray is allowed only as a light surface background** (`#eef0f3`) — for the stage/page area behind the panel, the composer field, and alternating comment cards. **No gray text.**
- White (`#fff`) is the primary panel/card surface.

### 2. Remove host branding (`data-accent`)

- The `data-accent` override and the `--commentary-accent` / `--commentary-accent-fg` CSS variable system are **retired**. The widget is always `#0C0CFF` on white regardless of host.
- `accentForeground()` (the WCAG contrast computation in `config.ts`) and related accent plumbing are removed or simplified, since foreground is now fixed.

### 3. Retire amber

- All amber usage (quoted-text borders, highlight underline/focus, status badges) becomes blue (`#0C0CFF`, with opacity tints).
- The document-global highlight (CSS Custom Highlight API) underline/focus colors in `web3/highlight.ts` change from amber (`#fde68a` / `#fef3c7`) to blue.

### 4. Form & texture: terminal/developer

- **Square corners** — remove all `rounded-*` / `rounded-full` (pills become rectangles).
- **Monospace** font family applied across the widget UI.
- Panel is a "terminal window": thin blue border + a hard offset shadow (`5px 5px 0 rgba(12,12,255,0.10)`), no soft blur shadows.
- **Outline (ghost) treatment** for buttons, launcher, and selection popover: white background, blue border, blue text. (Not solid fills.)
- Terminal glyphs/affordances: header `▸ comments` with a `[3]` count badge, blinking caret `▌` in the composer placeholder, `↳ reply` affordance.
- Action labels uppercase with letter-spacing: `PUBLISH`, `CONNECT`.

### 5. Light mode only

- Drop dark-mode support for this theme. Remove the `dark:` Tailwind variants from the widget components; the widget is white + `#0C0CFF` on every host, including hosts in dark mode.
- (The document-global highlight no longer needs its `[data-theme="dark"]` branch.)

## Scope — files affected

| File | Change |
|---|---|
| `commentary/widget/src/loader.ts` | Launcher pill + selection popover inline styles → square, outline, mono, `#0C0CFF`. Remove `--commentary-accent` injection / `data-accent` reading. |
| `commentary/widget/src/config.ts` | Remove `accentForeground()` and accent-related config; simplify. |
| `commentary/widget/src/web3/highlight.ts` | Highlight underline/focus colors amber → blue; drop dark branch. |
| `commentary/widget/src/comments/Composer.tsx` | stone/amber → `#0C0CFF` + opacity; remove rounding; mono; `PUBLISH` uppercase; light-only. |
| `commentary/widget/src/comments/CommentCard.tsx` | Same token swap; left accent bar blue; alt-card gray surface; remove `dark:`. |
| `commentary/widget/src/comments/Panel.tsx` | Header `▸ comments` / `[3]`; square; mono; light-only. |
| `commentary/widget/src/comments/ConnectButton.tsx` | Outline blue, `CONNECT` uppercase, square. |
| `commentary/widget/src/comments/AnchorStatusBadge.tsx` | amber/stone badge colors → blue + opacity tints. |
| `commentary/widget/src/app.css` | Define the theme tokens (blue, gray surface, font) if a shared place is wanted. |

## Token reference (for implementation)

```
--blue:  #0C0CFF;   /* text + accent + borders (border via rgba opacity) */
--gray:  #eef0f3;   /* light surface bg only — never text */
surface: #ffffff;   /* panel / card */
font:    ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
panel border:  1px solid rgba(12,12,255,.45);
panel shadow:  5px 5px 0 rgba(12,12,255,.10);
radius:  0;         /* everywhere */
opacity ladder: 1.0 / .65 / .45 / .4 (primary / secondary / meta / placeholder)
```

## Out of scope

- No changes to comment data model, anchoring, or web3 wiring — visual only.
- No dark theme variant.
- No host-configurable theming (the point is a fixed identity).

## Open questions

None — all design decisions resolved during brainstorming.

## Reference mockups

`commentary/.superpowers/brainstorm/74156-1781499475/content/terminal-cobalt-v2.html` (final approved look). Earlier iterations (`blue-direction.html`, `terminal-cobalt.html`, `terminal-cobalt-final.html`) show the path to the decision.
