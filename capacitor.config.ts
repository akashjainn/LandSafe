import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.landsafe.app',
  appName: 'LandSafe',
  webDir: 'out',
  server: {
    url: 'https://land-safe.vercel.app',
    cleartext: false,
    androidScheme: 'https'
  }
}

export default config
