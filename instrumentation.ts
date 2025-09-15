import * as Sentry from '@sentry/nextjs'

export async function register() {
  // Server-side Sentry init
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      integrations: (i) => i,
    })
  }
}
