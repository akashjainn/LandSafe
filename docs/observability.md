# Observability (Web + Native)

## Web (Next.js)

- Sentry (recommended)
  - npm i @sentry/nextjs
  - npx @sentry/wizard -i nextjs
  - DSN via env var (SENTRY_DSN)
- Analytics: GA4 or Segment
  - GA4: add gtag script and measurement ID
  - Respect DNT/consent

## Native (Capacitor)

- Sentry React Native or platform SDKs
- Optional: Firebase Crashlytics
- Use the same release versioning as the web for correlation

## Logs

- Keep server logs in Vercel/Neon, redact PII
- Client logs minimal; ship errors, not debug noise
