LandSafe Mobile (Expo)

Quick start:

- Install Expo and EAS CLI globally (optional but convenient)
  - npm i -g expo-cli eas-cli
- From apps/mobile:
  - npm install
  - npm run start
- Cloud build for iOS (requires Expo account):
  - eas build -p ios --profile preview

Notes:
- Update app.json extra.eas.projectId after creating the EAS project (eas init)
- Icons live in apps/mobile/assets/
- Expo Router drives navigation via files under apps/mobile/app
