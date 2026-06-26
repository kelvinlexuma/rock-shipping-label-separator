<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (Next.js 16, Turbopack) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Known Next.js 16 changes relevant to this repo:
- `middleware.ts` is **deprecated** — use `proxy.ts` instead; export a function named `proxy`, not `middleware`
- App Router only (no Pages Router)
- `serverExternalPackages` replaces `serverComponentsExternalPackages` in `next.config.ts`
<!-- END:nextjs-agent-rules -->
