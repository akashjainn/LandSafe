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

## Environment variables

Set one of the following keys to enable AeroDataBox:

- API_MARKET_KEY (preferred) for API.Market access
- AERODATABOX_API_KEY or AERODATA_API_KEY (RapidAPI) as a fallback

When API_MARKET_KEY is set, calls go to:
https://prod.api.market/api/v1/aedbx/aerodatabox

With header: x-api-market-key: YOUR_KEY

## Analytics & Error Monitoring

GA4 and Sentry are integrated.

1. Copy `env.example` to `.env.local` and fill values for:
	- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
	- `NEXT_PUBLIC_SENTRY_DSN` (public DSN)
	- `SENTRY_DSN` (server DSN)
2. Page views are manually dispatched in `src/lib/ga.tsx` when route or search params change.
3. Sentry config files: `sentry.client.config.ts`, `sentry.server.config.ts` plus `src/app/global-error.tsx` for React render errors.
4. Add custom tags/context in `src/app/instrumentation.ts`.
5. (CI) For source map upload set: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

Test Sentry (client): temporarily throw inside a client component.
Test Sentry (API): throw inside an API route handler.
