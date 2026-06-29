@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # local dev server (http://localhost:3000)
npm run build    # production build — must pass before deploying
npm run lint     # ESLint check
```

npm installs require bypassing the system proxy:
```bash
npm install --prefer-offline --noproxy registry.npmjs.org <package>
```

Google Drive auth uses a service account with domain-wide delegation (no
one-time browser setup needed — see below).

## Architecture

**Next.js 16 App Router** — all routing is file-based under `app/`.

### Request flow

```
Browser → proxy.ts (auth gate) → app/ pages / api routes
                                        ↓
                              lib/pdf.ts   lib/drive.ts
```

**`proxy.ts`** (Next.js 16 renamed `middleware.ts` → `proxy.ts`) — intercepts every request, verifies the `rock_session` JWT cookie, redirects to `/login` if missing/invalid. Public paths: `/login`, `/api/login`.

**`lib/auth.ts`** — creates and verifies HS256 JWTs using `jose`. Session cookie is HttpOnly, 24 h expiry, keyed by `SESSION_SECRET` env var.

**`lib/pdf.ts`** — core logic. Two tiers for reading the tracking barcode, then split:
1. **Text tier (fast):** `unpdf` extracts per-page text from the **original** full PDF
   (`extractText(pdf, { mergePages: false })`). Works for labels that embed the
   barcode value as real text (the original EAE/FRCU exports).
2. **Image tier (fallback):** for any page where the text tier finds no barcode, the
   page is rasterised (`unpdf` `renderPageAsImage` + `@napi-rs/canvas`, scale 5 ≈ 360 DPI)
   and the Code128 bars are decoded with `zxing-wasm`. Handles exports with **no text
   layer** (e.g. `RE1ALL.pdf`: no embedded fonts; barcode is an image, labels are vector
   outlines). Only missed pages take this slower path.
3. `pdf-lib` splits the source PDF into single-page PDFs.
4. Barcode regexes, in priority order: `BB\d{8,}` (EAE) → `R\d{8,}FRCU\d*` (FRCU).
5. Each output PDF is named `<barcode>.pdf`; falls back to `page_N.pdf` only if both
   tiers fail.

Rough timing: text-based PDFs ~3–5 s; image-based ~1 s/page of rendering (20-page
all-image PDF ≈ 20 s). The convert function is bumped to 2048 MB / 300 s for this.

> **Serverless gotchas (learned the hard way — verify with a real Vercel deploy, not
> just `next dev` or even `next build && next start`):**
> - `pdf-parse` / `pdfjs-dist` imported directly worked locally but threw in the Lambda
>   (file tracing missed pdf.js's worker/font deps) → silent `page_N.pdf` fallback.
>   `unpdf` ships a self-contained build, so it bundles cleanly.
> - `@napi-rs/canvas` (native `.node`) and `zxing-wasm` (`.wasm`) are in
>   `serverExternalPackages` **and** force-bundled via `outputFileTracingIncludes` in
>   `next.config.ts` — otherwise the runtime-resolved binary/wasm aren't traced in.
> - `@napi-rs/canvas` must satisfy unpdf's peer range (`^0.1.69`). The 1.x line installs
>   fine locally but Vercel's strict npm rejects it with ERESOLVE.
> - Extract text from the original PDF — pdf-lib's single-page copies lose font data.

**`lib/drive.ts`** — Google Drive via `googleapis`. Authenticates with a **service account using domain-wide delegation** (`google.auth.JWT` with `subject`), impersonating `account@lexuma.com`, who has edit rights on the target folder. The service-account JSON is supplied base64-encoded in `GOOGLE_SERVICE_ACCOUNT_B64`. No browser sign-in or token refresh — works headless and never expires. Enforces a 30-file cap in the target folder by deleting oldest files after each upload.

**`app/api/convert/route.ts`** — accepts `multipart/form-data` with field `file` (PDF), calls `splitAndNamePages`, zips with `jszip`, uploads to Drive, returns the ZIP as a direct download response. Vercel function: 60 s timeout, 1 GB memory.

### Key env vars

| Variable | Purpose |
|---|---|
| `LOGIN_ID` / `LOGIN_PASSWORD` | App login credentials |
| `SESSION_SECRET` | JWT signing key |
| `GOOGLE_SERVICE_ACCOUNT_B64` | Base64 of the service-account JSON (domain-wide delegation) |
| `GOOGLE_IMPERSONATE_USER` | User to impersonate (`account@lexuma.com`) |
| `GOOGLE_DRIVE_FOLDER_ID` | Target Drive folder (`1P2rNovyXAR6E-9bMKYwweT0eXAB9cNNa`) |

### Adding a new label format

1. Add a regex to `BARCODE_PATTERNS` in `lib/pdf.ts` — patterns are tried in order, first match wins.
2. Check whether the PDF has a text layer: `pdftotext <file.pdf> -`. If the barcode value
   prints, the text tier handles it. If it prints **nothing** (image-based PDF), the image
   tier decodes the barcode — confirm the barcode symbology is Code128 (or add it to the
   `formats` list in `readBarcodesFromImages`). `pdffonts`/`pdfimages -list` help diagnose.

### Styling & assets

All UI styling is plain CSS-in-JS (`<style>` tags inside client components). Font: `Barlow Condensed` + `Share Tech Mono` from Google Fonts. No Tailwind utility classes used in component files — only the base reset from `globals.css`.

- **Logo**: `public/rock-logo.png` (transparent, dark text). Rendered with `filter: invert(1) hue-rotate(180deg)` so it shows white on dark while keeping the red accent. Each page has a CSS/markup fallback (`RE` badge + text) via an `onError` handler.
- **Favicon**: single `app/favicon.ico` (Rock logo, 32×32 PNG embedded). Do **not** add `app/icon.png` alongside it — Next.js 16 + Turbopack served a stale/404 hashed `/icon.png` link when both existed.
- **Background**: locked to `#080d18` on `html, body` in `globals.css` with `overflow-x: hidden` — a light-mode `#fff` default previously showed as white gutters on mobile overscroll.
- **Mobile**: the main header hides the app title under 640px (the "Upload PDF" panel heading covers it) so the logo and Logout button stay on one row.
