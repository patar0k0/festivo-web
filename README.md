This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Production gating

Environment variables (no secrets in repo):
- `FESTIVO_PREVIEW_SECRET` (production)
- `NEXT_PUBLIC_SITE_URL=https://festivo.bg`
- `FESTIVO_PUBLIC_MODE=coming-soon` (or `live`)

## How to test

1. Incognito `https://festivo.bg/` -> shows only coming-soon
2. `https://festivo.bg/?preview=SECRET` -> unlocks, sets cookie, redirects without query
3. `https://festivo.bg/?logout=1` -> locks again
4. `https://www.festivo.bg/` -> 308 to `https://festivo.bg/`
5. `https://festivo.bg/sitemap.xml` -> only coming-soon when in coming-soon mode
6. `https://festivo.bg/robots.txt` -> disallow all when in coming-soon mode
