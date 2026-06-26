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

**`lib/pdf.ts`** — core logic:
1. `pdf-lib` splits the source PDF into individual single-page PDFs
2. `pdf-parse` extracts text from each page buffer
3. Regex patterns identify the tracking barcode (priority order matters):
   - `BB\d{8,}` → EAE label format
   - `R\d{8,}FRCU\d*` → FRCU label format
4. Falls back to `page_N.pdf` if no barcode matches

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
2. Verify with `pdftotext <file.pdf> -` that the barcode value appears as plain text in the PDF.

### Styling

All UI styling is plain CSS-in-JS (`<style>` tags inside client components). Font: `Barlow Condensed` + `Share Tech Mono` from Google Fonts. No Tailwind utility classes used in component files — only the base reset from `globals.css`.
