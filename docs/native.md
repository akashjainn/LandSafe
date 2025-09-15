# LandSafe Native (Capacitor) Roadmap

This doc summarizes the native integration plan after enabling PWA.

## Install Capacitor

- npm i -D @capacitor/cli
- npm i @capacitor/core
- npx cap init LandSafe com.landsafe.app
- npx cap add ios
- npx cap add android

## Config

- `capacitor.config.ts` uses remote-URL mode pointing to your Vercel production URL.
- For local testing, comment `server.url` to use the local `webDir`.

## Native bits

- Secure storage: `@capacitor/preferences` or `@capacitor-community/secure-storage`
- Push notifications: `@capacitor/push-notifications`
- Deep links / universal links: iOS Associated Domains + Android Intent Filters
- SSO (OIDC + PKCE): Do auth in web via /api/auth; optionally re-auth via AppAuth or an in-app browser.

## Observability

- Sentry (web + Native SDKs)
- Optional: Firebase Crashlytics (Android/iOS)
- Analytics: GA4 / Segment (respect privacy laws)

## Compliance & IT

- App signing (Apple/Google)
- Privacy policy + ToS
- Data retention policy
- (Optional) MDM/Enterprise: config profiles, cert pinning if required

## CI/CD

- Fastlane lanes for build, test, beta (TestFlight/IAS), prod release
- Provisioning profiles managed by Fastlane match or Xcode automatic signing
