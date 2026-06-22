// ─────────────────────────────────────────────────────────────────────
// API base URL - split by build type so production can never ship plaintext.
//
// DEV (Expo Go / __DEV__ === true): your computer's LAN IP over http.
//   Your phone CANNOT reach "localhost" - that's the phone itself. Use the
//   LAN IP of the machine running the backend.
//     Windows:  ipconfig            → IPv4 Address
//     macOS:    ipconfig getifaddr en0
//
// PROD (release builds / __DEV__ === false): your HTTPS API domain.
//   Set PROD_API_URL below to your real domain before building for the stores.
//   iOS App Transport Security and Android (usesCleartextTraffic=false) block
//   plaintext HTTP in release builds, so production MUST be https.
// ─────────────────────────────────────────────────────────────────────
const DEV_API_URL = 'http://192.168.1.193:8080/v1'
const PROD_API_URL = 'https://api.curaline.com/v1' // ← set to your domain

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL

// Fail fast at startup if a release build is misconfigured with a non-HTTPS
// endpoint - surfaces the mistake immediately instead of silent network errors.
if (!__DEV__ && !API_BASE_URL.startsWith('https://')) {
  throw new Error('Production API_BASE_URL must use HTTPS.')
}
