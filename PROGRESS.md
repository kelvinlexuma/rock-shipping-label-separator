# PROGRESS

Rock Enterprise — Shipping Label Separator. Status log of notable work.

Production: https://rock-label-separator.vercel.app
Repo: kelvinlexuma/rock-shipping-label-separator
Vercel project: `prj_qXqILGIDRrffBVNh8Uz4XuzPYPkH` (team `team_fW1erGDv9iZsRShcQkwjt068`)

---

## 2026-06-29 — Image-based PDFs (barcode from image)

**Symptom:** a new file (`RE1ALL.pdf`) again produced `page_1.pdf`, `page_2.pdf`…

**Root cause:** it's the same EAE layout *visually* but structurally different —
**no text layer at all**: no embedded fonts (`pdffonts` empty), the barcodes are
JPEG images, and the human-readable labels are vector outlines. `unpdf` text
extraction returns 0 chars, so every page fell back. The earlier EAE/FRCU
samples embedded the barcode as real text, which is what the text tier reads.

**Fix — second tier in `lib/pdf.ts`:** for pages where text extraction finds no
barcode, rasterise the page (`unpdf` `renderPageAsImage` + `@napi-rs/canvas`,
scale 5 ≈ 360 DPI) and decode the Code128 bars with `zxing-wasm` (pure WASM),
then apply the same `BB…`/`R…FRCU…` priority. Text-based PDFs keep the fast path.
- The embedded barcode JPEGs alone are too low-res/JPEG-blurred to decode; the
  full-page high-DPI render decodes reliably (20/20 pages).
- Serverless hardening: `@napi-rs/canvas` + `zxing-wasm` added to
  `serverExternalPackages`; the `.node` binary and `.wasm` force-bundled via
  `outputFileTracingIncludes`; convert fn bumped to 2048 MB / 300 s.

**Gotcha (cost a failed deploy):** `@napi-rs/canvas@1.x` installs fine locally
but Vercel's strict npm rejects it (ERESOLVE) — unpdf's peer range is `^0.1.69`.
Pinned to `0.1.100`.

**Verified** on a local production build *and* live Vercel for all three file
types: `RE1ALL.pdf` → 20/20 BB barcodes, 0 `page_N` (~20 s); EAE/FRCU text PDFs
still correct and fast (~3–6 s), Drive upload intact.

Commits: `5d325a3`, `7852855`.

---

## 2026-06-26 — Bug-fix & hardening session

Status at end: **fully working in production** — barcode-named PDFs, Drive
upload, favicon, and mobile/desktop UI all verified live.

### 1. Output filenames were `page_1.pdf` instead of the barcode
- **Symptom:** ZIP entries named `page_N.pdf` instead of `BB…` / `R…FRCU…`.
- **Root cause:** the bug was **Vercel-only**. The code (`pdfjs-dist`, earlier
  `pdf-parse`) worked perfectly in `next dev`, so isolated/dev tests passed —
  but in Vercel's Lambda, file tracing didn't include pdf.js's worker/font
  dependencies. The dynamic import threw at runtime, hit the catch block, and
  silently fell back to `page_N.pdf`. Proven by `curl`-ing production directly
  (got `page_1.pdf`) vs local (`BB…`) with identical code.
- **Fix:** switched extraction to **`unpdf`** — a self-contained serverless
  pdf.js build with no external worker/font files for tracing to miss. Text is
  extracted from the **original** PDF (pdf-lib's single-page copies lose font
  data), then pages are split and named.
- **Verification method that actually catches this:** local **production build**
  (`next build && next start`) + `curl` the convert endpoint, then `curl`
  production after deploy. `next dev` alone is not trustworthy for native/PDF
  libs. Both EAE and FRCU sample PDFs confirmed.
- Commits: `968246f`, `4121449`.

### 2. Google Drive saving didn't work
- **Root cause:** the original OAuth refresh-token flow was never completed
  (the `GOOGLE_REFRESH_TOKEN` env var was empty), so uploads silently failed.
- **Fix:** switched to a **service account with domain-wide delegation**, reused
  from the Lexuma Bookkeeping Automation project
  (`product-listing-worker@trim-tide-490013-e8`), impersonating
  `account@lexuma.com` — the account granted edit rights on the target folder.
  Headless, no browser sign-in, never expires.
  - `lib/drive.ts`: `google.auth.JWT` with `subject` impersonation.
  - Service-account JSON supplied base64-encoded via `GOOGLE_SERVICE_ACCOUNT_B64`
    (avoids private-key newline issues).
  - Removed obsolete `scripts/get-refresh-token.ts`.
  - Vercel env: added `GOOGLE_SERVICE_ACCOUNT_B64` + `GOOGLE_IMPERSONATE_USER`,
    removed dead `GOOGLE_REFRESH_TOKEN`.
- **Verified** 4 ways: Python upload test → Node `googleapis` JWT test → local
  prod build (`X-Drive-Url` populated) → live production convert, then
  independently listed the Drive folder and found the uploaded ZIP.
- Target folder is named "Shipping label output"
  (`1P2rNovyXAR6E-9bMKYwweT0eXAB9cNNa`).
- Commit: `be966f1`.

### 3. UI redesign / polish
- Transparent logo (`public/rock-logo.png`) with `invert + hue-rotate` filter so
  it renders white-on-dark with the red accent preserved. Fallback badge on error.
- Increased font sizes across both pages (desktop-first tool); fixed low-contrast
  greys; removed the redundant "Rock Enterprise Co. Ltd." text (logo already
  shows it).
- **Favicon:** replaced the default Next.js `app/favicon.ico` with a Rock-branded
  one. Note: don't add `app/icon.png` next to it — Next 16/Turbopack emitted a
  404 hashed `/icon.png` link when both existed.
- **Mobile:** locked `html,body` background to `#080d18` (was `#fff`, causing
  white gutters on overscroll), `overflow-x: hidden`; header hides the app title
  <640px so logo + Logout stay on one row.
- Verified desktop (1440px) and mobile (390px) with Puppeteer screenshots; no
  horizontal overflow.
- Commits: `cc144cf`, `3ac60cc`, `4121449`.

### Known follow-ups / not yet done
- 30-file retention (`enforceRecordLimit`) is wired but not load-tested past 30
  uploads.
- `pdfjs-dist` and `pdf-parse` remain in `package.json` but are unused
  (`unpdf` is the only PDF text path now) — safe to prune later.
- A test ZIP from production verification may remain in the Drive folder; it
  rolls off after 30 real uploads or can be deleted manually.

---

## Environment / ops notes
- npm installs need: `npm install --prefer-offline --noproxy registry.npmjs.org <pkg>`.
- Vercel deploys auto-trigger on push to `main`; verify via the deployments API
  or by `curl`-ing production.
- Service-account JSON lives at
  `/home/lexuma/Documents/DimBuyNow Product Listing Management/service-account.json`
  (shared across Lexuma automation projects).
