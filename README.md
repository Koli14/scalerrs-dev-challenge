# Article QC — SEO Article Quality + Publisher

A small Next.js tool for an SEO agency. The writing team produces hundreds of
articles per month in Google Docs, and the editorial team needs to:

1. Parse each article into structured fields (meta title, meta description,
   article title, body HTML, images, links).
2. Audit it against a set of quality rules (image count + Drive sharing, link
   count, alt text, heading hierarchy, paragraph length, metadata length).
3. Publish to WordPress / Shopify with a single click.

This repo is the deliverable for the developer challenge. The sample doc the
brief points at is pre-loaded in the input field, so you can hit **Parse
article** the moment you open the page.

---

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
```

The sample doc URL is already filled in. Click **Parse article**.

To produce the static deliverable HTML:

```bash
npm run export-sample
```

This writes:

- `output/sample-article.html` — the article body wrapped in a standalone HTML
  page (this is the "output HTML" the brief asks for).
- `output/sample-article.json` — the structured `ParsedArticle + checks` JSON
  the API would return, for inspection.

You can also point the script at any other public Google Doc:

```bash
npm run export-sample -- "https://docs.google.com/document/d/<id>/edit"
```

---

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│  Browser  (page.tsx)    │  POST  │  /api/parse  (Node route)    │
│  - URL + thresholds     │ ─────▶ │  1. fetch doc as HTML        │
│  - Threshold tweaks     │        │  2. cheerio extract          │
│    re-run runChecks()   │        │  3. probe Drive per image    │
│    instantly (no fetch) │ ◀───── │  4. runChecks()              │
└─────────────────────────┘        └──────────────────────────────┘
        │ POST
        ▼
   /api/upload  →  echoes the payload that a real WordPress / Shopify
                   REST API call would receive.
```

### Key files

| File                       | What it does                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `lib/parser.ts`            | The brain. Fetches `https://docs.google.com/document/d/<id>/export?format=html`, parses with cheerio, extracts meta fields, images, links, headings, and produces clean output HTML. |
| `lib/drive.ts`             | Server-side probe for each Drive image — hits the unauthenticated `uc?id=…` endpoint and classifies the response as public / private / unknown.                                      |
| `lib/links.ts`             | Unwraps Google's `https://www.google.com/url?q=…` redirector and classifies links (product vs. external) by host.                                                                    |
| `lib/checks.ts`            | Pure quality-check function. Takes `(article, thresholds)` and returns a list of `{ severity: 'pass'                                                                                 | 'warn' | 'fail', label, detail }`. Used both server-side on parse and client-side so threshold tweaks recompute checks without a round-trip. |
| `app/api/parse/route.ts`   | Wires parser → drive probe → checks into one POST response.                                                                                                                          |
| `app/api/upload/route.ts`  | Placeholder publisher. Echoes the payload that a real WP/Shopify integration would send.                                                                                             |
| `app/page.tsx`             | The dashboard. Single page; client-side state.                                                                                                                                       |
| `scripts/export-sample.ts` | Runs the parser against the sample doc and writes `output/sample-article.html`.                                                                                                      |

### Why this shape

- **Server-side parse.** Drive's `uc?id=…` probe needs to be a server-side
  fetch — a browser request would be CORS-blocked, and we also want to call
  `docs.google.com/export?format=html` without exposing details to clients.
- **Pure check function on both sides.** When the editor edits the
  thresholds bar, the failing-check count needs to update _instantly_. The
  check logic is a pure function over `(article, thresholds)`, so the client
  re-runs it locally instead of re-fetching the doc.
- **Cheerio over jsdom.** Lighter, faster, and we only need DOM traversal.
- **The "IMAGE N" placeholder pattern.** I noticed the sample doc doesn't
  use embedded `<img>` tags — each image is represented as a hyperlink
  whose visible text is `IMAGE 1` / `IMAGE 2` / `IMAGE 3` pointing at a
  Drive share URL, followed inline by `Alt tag: "…"`. I don't know whether
  that's a real internal convention the writing team uses everywhere or
  something specific to this sample, so the parser hedges: it detects the
  placeholder pattern _and_ falls back to real embedded `<img>` tags. When
  the placeholder pattern matches, the anchor is treated as an image
  (extracting the Drive file ID + the alt text) and rewritten to a real
  `<img>` tag in the output HTML so the rendered preview matches what
  readers will see. Worth confirming with the team whether this is a
  documented workflow before relying on it across all their docs.

---

## What the QC report covers

| Check                             | Rule                                                                                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Meta title present + length       | 30–65 chars recommended                                                                                                                                                                                                                                      |
| Meta description present + length | 110–160 chars recommended                                                                                                                                                                                                                                    |
| Article title (H1)                | Must exist                                                                                                                                                                                                                                                   |
| Image count                       | Min/max configurable in UI (defaults 2–8)                                                                                                                                                                                                                    |
| Images hosted on Google Drive     | Drive file ID required on every image                                                                                                                                                                                                                        |
| Images publicly shared            | Server-side fetch verifies every image is accessible                                                                                                                                                                                                         |
| Images have alt text              | Warn per image without alt                                                                                                                                                                                                                                   |
| Product link count                | Min/max configurable; "product" = host matches the configured product domain (auto-suggested from the most-common external host)                                                                                                                             |
| Link reachability                 | Server-side HEAD (with GET fallback) on every external link. Broken product links are **fail** (lost conversions); broken non-product links are **warn**; 401/403/429 responses are surfaced as "bot-blocked, verify manually" rather than treated as broken |
| Heading hierarchy                 | Warn on level skips (H1 → H3, etc.)                                                                                                                                                                                                                          |
| Paragraph length                  | Warn for passages over 150 words                                                                                                                                                                                                                             |

Thresholds and the product domain are editable from the dashboard's
**Quality thresholds** bar, with the suggested product domain auto-detected
from the parsed article.

---

## Publishing

The publish bar at the top of the parsed-article view lets the editor pick
**WordPress** or **Shopify**, then click **Publish**. This POSTs the
payload (`metaTitle`, `metaDescription`, `articleTitle`, `articleHtml`) to
`/api/upload`, which returns a mock success response with the exact JSON
that would be sent to the real platform's REST API.

Where the real integration would slot in:

- WordPress: `POST {site}/wp-json/wp/v2/posts` with App Password auth.
  - `title` ← `articleTitle`
  - `content` ← `articleHtml`
  - `meta._yoast_wpseo_title` ← `metaTitle`
  - `meta._yoast_wpseo_metadesc` ← `metaDescription`
- Shopify: `POST {shop}/admin/api/2024-07/articles.json` with an Admin API
  access token.

The brief asked us not to build a real integration, so the upload endpoint
is a deliberate placeholder — clean to replace.

---

## Future ideas

Things I'd build next if this was a real product:

- **Real WP / Shopify connectors.** Store credentials per-client in env;
  expose a "site" selector in the publish bar. Yoast SEO + RankMath meta
  field mapping for WP.
- **Batch mode.** Drop a folder of Drive doc URLs in; the dashboard becomes
  a triage queue showing red/yellow/green status per article so the editor
  can sweep through 50 at a time.
- **Scheduled crawls.** A nightly job re-checks every published article's
  Drive images — they degrade silently (someone deletes a file, ownership
  transfers, sharing changes). When an image stops being publicly accessible
  the system pages the editor on Slack.
- **LLM tone + brand voice linting.** Pipe the article through an Anthropic
  call with a per-client style guide; surface "this paragraph reads more
  promotional than the brand voice allows" findings as warn-severity checks.
- **Autofix suggestions.** For each check failure, propose a fix the editor
  can accept with one click (e.g., shorten the meta description by 12 chars,
  re-arrange headings).
- **Image OCR.** Detect text baked into images (bad for accessibility and
  SEO) using a vision model.
- **Google Drive picker.** Right now the editor has to copy-paste the doc
  URL. The Drive Picker SDK would let them pick the doc from their Drive
  directly.
- **Diff view before publish.** Show the editor "what changed since the
  last QC run" so they can re-audit only the deltas.
- **Custom check authoring.** Let agency admins write their own checks
  (e.g., "must mention the brand name in the first 100 words") via a small
  rule DSL or LLM-evaluated criteria, scoped per client.
- **Audit log.** Every publish + every QC run gets written to a record so
  the editorial team has provenance for what was sent where, by whom, when.

---

## Notes for the reviewer

- The dashboard's threshold sliders re-run the check function locally —
  no server round-trip on every keystroke. This is why `lib/checks.ts` is
  isomorphic and has no Node-only imports.
- The parser stripping pass removes Google Docs' inline `style="…"` and
  generated class names, because they reference an ephemeral `<style>`
  block in the export that isn't carried over.
- Drive's `uc?id=…&export=download` endpoint is what we use for the public
  share probe. It's stable, unauthenticated, and reliably distinguishes
  public files (returns image bytes or a "confirm download" HTML page) from
  private ones (returns a sign-in / request-access page).
