# LandSafe Releases (CI/CD)

## Pipelines

- Web (Vercel): main branch → auto-deploy
- Native (Fastlane):
  - `fastlane ios beta` → TestFlight
  - `fastlane android beta` → Internal App Sharing
  - `fastlane ios release` / `fastlane android release` → Stores

## Steps Overview

1) Version bump (semver) and CHANGELOG update
2) Build web app (Next.js)
3) Capacitor sync (if bundling assets)
4) Build native binaries via Fastlane
5) Upload to TestFlight / IAS
6) Submit for review with metadata

## Store Metadata Checklist

- App name, subtitle, description
- Screenshots & video
- App icon and splash
- Privacy policy URL
- Support URL & marketing URL
- Content ratings
- Age rating
- Data collection disclosure (platform forms)

## Credentials & Signing

- Apple Developer program team + certificates
- Google Play Console + keystore (.jks)
- Use Fastlane Match or platform-managed signing where possible

## Notes

- Keep API keys server-side. Native shells should talk to your Next.js /api only.
- For sensitive secrets on device, use Keychain/Keystore via Capacitor Secure Storage.
