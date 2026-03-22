# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Festivo is a Next.js 14 (App Router) Bulgarian festival catalog. Single service — no monorepo. See `PROJECT_CONTEXT.md` and `AI_CONTEXT.md` for product/architecture details.

### Required environment variables

A `.env.local` file at the repo root must contain at minimum:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous/public key

Without real Supabase credentials the app boots and pages render, but data sections show empty states or graceful error messages (server-side queries return `null`/empty when Supabase is not configured).

Optional variables for admin/AI features: `SUPABASE_SERVICE_ROLE_KEY`, `PERPLEXITY_API_KEY`, `OPENAI_API_KEY`, `JOBS_SECRET`, `FCM_SERVER_KEY`.

### Common commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (port 3000) |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Production start | `npm run start` |

### Non-obvious caveats

- The project uses **npm** (lockfile: `package-lock.json`). Do not use pnpm or yarn.
- There is **no automated test suite** — no `test` script in `package.json`, no test framework configured.
- ESLint has two config files: `.eslintrc.json` (legacy, used by `next lint`) and `eslint.config.mjs` (flat config). `npm run lint` runs `next lint` which uses `.eslintrc.json`.
- The middleware (`middleware.ts`) gracefully skips Supabase auth when env vars are missing — the app will still serve pages.
- The `FESTIVO_PUBLIC_MODE=coming-soon` env var gates public access behind a preview cookie; set to `live` (or omit) for normal development.
- After changing `.env.local`, you must restart the dev server.
