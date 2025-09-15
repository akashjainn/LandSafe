# LandSafe PWA

This app is installable as a Progressive Web App.

## What we added

- Web App Manifest: `src/app/manifest.ts`
- Service Worker: `public/sw.js`
- Offline page: `src/app/offline/page.tsx`
- Registration: `src/components/ServiceWorker.tsx` (included in `src/app/layout.tsx`)

## Icons

Place the following in `public/`:
- `icon-192x192.png`
- `icon-512x512.png`
- `maskable-512.png` (maskable)

Tip: You can generate these from your existing logo. Ensure a solid background for maskable.

## Verify installability

- Run locally and open Chrome > Lighthouse > PWA
- Criteria: manifest present, SW controls the page, served over HTTPS, valid icons, start_url works

## Offline behavior

Basic cache-first strategy for `/`, `/offline`, and app icons.

You can expand the caching strategy to include more routes or API responses as needed.
