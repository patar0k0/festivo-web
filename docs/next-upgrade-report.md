# Next.js 14 -> 15/16 upgrade report (safe staged plan)

## 1) Current versions (from `package.json`)

- `next`: `14.2.15`
- `react`: `18.2.0`
- `react-dom`: `18.2.0`
- `node` engine: **not defined** in `package.json`

## 2) Staged upgrade execution

### Stage A — update to latest Next 14 patch

Attempted commands:

```bash
npm install next@^14 eslint-config-next@^14
npm run build
```

Result:

- `npm install` failed with `E403` when accessing `https://registry.npmjs.org/eslint-config-next`.
- `npm run build` started but failed because Google Fonts could not be fetched (`Fraunces`, `Manrope`) in this environment.

### Stage B — update to latest Next 15 + official codemods

Attempted commands:

```bash
npm install next@15 eslint-config-next@15
npx @next/codemod@latest --help
npm run build
```

Result:

- `npm install` failed with `E403` when accessing `https://registry.npmjs.org/eslint-config-next`.
- `npx @next/codemod@latest` failed with `E403` when accessing `https://registry.npmjs.org/@next/codemod`.
- Build could not be validated for Next 15 because dependencies could not be installed.

### Stage C — update to latest Next 16

Attempted commands:

```bash
npm install next@16 eslint-config-next@16
npm run build
```

Result:

- `npm install` failed with `E403` when accessing `https://registry.npmjs.org/eslint-config-next`.
- Build could not be validated for Next 16 because dependencies could not be installed.

## 3) Smoke tests (requested routes)

Smoke test command executed against local dev server (`next dev --port 3000`) with currently installed dependencies:

```bash
for p in / /login /auth/callback /admin /api/auth/logout; do
  code=$(curl -s -o /tmp/out -w "%{http_code}" http://localhost:3000$p)
  echo "$p $code"
done
```

Observed status codes:

- `/` -> `500`
- `/login` -> `500`
- `/auth/callback` -> `307`
- `/admin` -> `500`
- `/api/auth/logout` -> `303`

Main runtime blockers in this environment:

- Missing Supabase environment variables (`Missing Supabase env`).
- Google Fonts fetch failures in Next font pipeline due blocked network (`fonts.googleapis.com`).

## 4) Codemod changes

- No codemods were applied.
- No files were modified by codemods because `@next/codemod` could not be downloaded (`E403` from npm registry).

## 5) Breaking changes to plan for (once registry/network access is available)

1. **Next 15 async request APIs**
   - Ensure all `params`, `searchParams`, `headers()`, and `cookies()` usages follow async contract where required.
   - This codebase already uses promise-based `params/searchParams` and awaited `headers()/cookies()` in multiple places, which should reduce migration surface.
2. **React compatibility alignment**
   - Validate React/React DOM versions required by chosen Next 15/16 targets and update together.
3. **ESLint config alignment**
   - Keep `eslint-config-next` on same major as `next`.
4. **Build-time external fetches**
   - Replace remote Google font fetch with self-hosted/local fonts (or allow egress) to make CI/build deterministic.
5. **Environment contracts for smoke tests**
   - Provide required Supabase env variables in test environment to avoid `500` on protected/login flows.

## 6) Final diff in this branch

- Added this report file:
  - `docs/next-upgrade-report.md`
