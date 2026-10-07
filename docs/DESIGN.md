# Design system: Agent Run Reliability Desk

Independent concept by Ayo Ahmed. Not affiliated with Checkly.

This file was written **before any application code**. It records what was observed on Checkly's public website and docs on **2026-10-07** and turns that into rules for this prototype. The visual guide is in [`brand-guide.html`](brand-guide.html), and reference captures are in [`brand/`](brand/).

## 1. What was inspected

| Surface | URL | What it taught us |
|---|---|---|
| Marketing home | https://www.checklyhq.com/ | Dark navy canvas, white display type, Checkly blue accent, terminal and code imagery, "active reliability layer for developers & agents" positioning |
| Docs home | https://www.checklyhq.com/docs/ | Light, dense technical layout: left nav rail, thin borders, blue links, navy text, raccoon logo lockup |
| Synthetic monitoring docs | https://www.checklyhq.com/docs/detect/synthetic-monitoring/ | Product vocabulary: checks, assertions, retries, locations, alerts |
| API check assertions | https://www.checklyhq.com/docs/detect/synthetic-monitoring/api-checks/assertions/ | Assertions are explicit `source / property / comparison / target` rows. We reuse that shape for invariants |
| AI overview, Rocky AI, MCP tools | https://www.checklyhq.com/docs/ai/overview/ | Public agent-facing direction: Skills, MCP, CLI, AI root-cause analysis |
| Alerts overview | https://www.checklyhq.com/docs/communicate/alerts/overview/ | State transitions (passing → degraded → failing), retries and channels inform the alert preview |

Captures: `brand/site-home-desktop.jpg`, `brand/site-home-mobile.jpg`, `brand/docs-home-desktop.jpg`, `brand/docs-synthetic-desktop.jpg`.

## 2. Logo

- These are the **literal official assets**, downloaded from the logo files used on Checkly's public docs (`mintcdn.com/checkly-422f444a/.../logo/light.svg` and `dark.svg`). They are not redrawn.
  - `brand/checkly-logo-on-light.svg`: navy wordmark (`#002652`) with the blue raccoon tile (`#0075FF`). Use it on white.
  - `brand/checkly-logo-on-dark.svg`: white wordmark with the blue raccoon tile. Use it on navy.
- In this app the logo appears **once**, in the top bar at 24px tall, and sits directly next to the non-affiliation label. It is never recoloured, stretched, animated or used as a product mark for this concept.
- The concept's own name, "Agent Run Reliability Desk", is plain Inter text and is visually separated from the logo by a divider.

## 3. Colour

| Token | Hex | Observed where | Used for |
|---|---|---|---|
| `--navy-950` | `#061220` | Marketing canvas | Top bar, alert preview "terminal" |
| `--navy-900` | `#0A1A33` | Marketing cards on dark | Code and JSON panels |
| `--navy-700` | `#002652` | Logo wordmark, docs headings | Primary text on light surfaces |
| `--blue-500` | `#0075FF` | Logo tile, CTAs, links | Primary buttons, focus ring, selection |
| `--blue-300` | `#80BBFF` | Marketing highlights | Accent text on navy |
| `--blue-50` | `#EEF5FF` | Docs active nav item | Selected rows |
| `--ink-600` | `#4B5B73` | Docs body copy | Secondary text |
| `--line` | `#E3E8EF` | Docs dividers | Borders and table rules |
| `--canvas` | `#F7F9FC` | Docs page background | App background |
| `--pass` | `#0E9F6E` | Check status (green dot) | Passed assertion |
| `--fail` | `#E0364F` | Check status (failing) | Failed assertion and blocked verdict |
| `--warn` | `#B76E00` | Degraded state | Needs human review / abstained |

The status colours follow the familiar passing, degraded and failing convention from Checkly's alert docs. Text contrast is AA or better: white on `#0075FF` is 4.6:1, and `#002652` on white is 14:1. Status is **never shown by colour alone**. Every chip also carries a word (PASS, FAIL, REVIEW) and an icon glyph.

## 4. Typography

- **Inter** is Checkly's site typeface; it was read from computed styles on the marketing and docs pages. Inter is open source (SIL OFL), so we use it from the `@fontsource/inter` package, bundled locally with no CDN call. The fallback is `system-ui, sans-serif`.
- **Monospace**: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`. It is used for tool names, JSON, assertion paths and IDs, which matches the docs code blocks.
- Scale: 12 / 13 / 14 (body) / 16 / 20 / 28. Headings use weight 600–700 with tight letter-spacing (-0.01em), as on the marketing headings.

## 5. Shape, density, motion

- Radii are 6px on controls and 10px on panels. This matches the observed 6–8px on buttons and inputs and the softer docs cards.
- Borders are 1px `--line`. No drop shadows on light surfaces, only one subtle shadow on popovers. This mirrors the flat docs treatment.
- The layout is dense and tool-like, closer to the docs and product than to the marketing hero. There is no hero section, no stat-card padding and no illustration.
- Motion is limited to 120ms colour and background transitions, and `prefers-reduced-motion` is respected.

## 6. Layout

Desktop (1280px and wider) uses three columns:
1. **Run list**: eight seeded fixtures plus imported traces. Each row shows its transport and task verdict side by side.
2. **Run detail**: verdict split (Transport vs Task), timeline of steps and tool calls, assertion table with the exact failing assertion expanded, and source evidence with provenance.
3. **Actions rail**: release comparison, exports and alert preview.

Tablet (820px) puts the run list in a horizontal scroller above the detail and moves the rail under the detail. Phone (390px) stacks everything in one column. Tables become definition lists, and no layout needs horizontal scrolling.

## 7. Honesty and labelling rules (design-level)

- A permanent top-bar label reads "Independent concept by Ayo Ahmed. Not affiliated with Checkly."
- A permanent banner reads "Synthetic fixtures · evaluated locally in your browser · no telemetry, no monitoring connection, no real agent actions."
- The alert preview is labelled **"Preview only, not sent"**.
- Validators are deterministic rules shown with their source code name, and no score or "AI confidence" is ever shown. When evidence is insufficient the verdict is **REVIEW (abstained)** and names the missing evidence.
