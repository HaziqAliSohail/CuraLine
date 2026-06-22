# CuraLine Mobile App (Expo Testing Platform)

This directory contains the cross-platform React Native mobile client for CuraLine, featuring separate **Patient** and **Doctor** portals sharing the same central REST API backend.

> [!NOTE]
> Per project directives, this Expo client is optimized for local testing, rapid debugging, and prototype validation. All components are written in clean, standard, modular React Native code using platform-agnostic UI patterns to enable straightforward migration to **React Native CLI** or **Flutter** for production.

---

## 📱 Feature Breakdown

### Patient Portal
1. **Dashboard**: Health summaries, alert prompts for urgent reschedule swaps, and quick navigation.
2. **AI Booking Assistant (`ChatScreen`)**: Intake chat module. Analyzes symptom inputs, parses severity scores, delivers emergency guidance banners, and schedules appointment slots instantly.
3. **Doctor browser (`DoctorsScreen`)**: Browseapproved specialists, filter by insurance plans, check average star reviews, and book available slots.
4. **Visits Tracker (`VisitsScreen`)**: Manage upcoming appointments (with cancel option) and review past visits using an interactive rating/comment modal.
5. **Profile Editor (`ProfileScreen`)**: Update contact info, change insurance plans, edit medical history, or sign out.
6. **Reschedule Manager (`RescheduleScreen`)**: Review proposed slot swaps requested by higher-priority emergency patients, with side-by-side time comparisons.

### Doctor Portal
1. **Briefing Dashboard (`DoctorDashboardScreen`)**: Displays an LLM-summarized daily schedule briefing (case mix counts, first slot alerts) and lets doctors review their patient schedule with expandable medical histories. Includes quick action buttons to log visit outcomes (`COMPLETED` or `NO_SHOW`).
2. **Schedule Slots Manager (`DoctorSlotsScreen`)**: Add single availability slots or bulk-generate recurring slots (e.g., weekdays 9-5) in seconds, as well as closing/deleting open slots.
3. **Triage Swap Monitor (`DoctorRescheduleScreen`)**: Informational view tracking pending severity slot swaps awaiting patient approval.
4. **Insights Dashboard (`DoctorInsightsScreen`)**: Trailing stats (30d, 90d, 1y) displaying completed visit counts, no-show ratios, busy day statistics, and case severity distribution charts.
5. **Settings (`DoctorSettingsScreen`)**: View qualifications, rotate passwords, and sign out.

---

## 🚀 Setup & Execution

### 1. Install Dependencies
Navigate to the `Mobile/` directory and install the packages:
```bash
npm install
```

### 2. Configure Backend API URL
Because mobile simulators or physical devices cannot resolve `localhost` (127.0.0.1) to find your local computer's dev server, you must bind the app to your machine's **LAN IP Address**.

1. Locate your computer's LAN IP address (e.g., `192.168.1.15`).
   - **Windows (PowerShell)**: Run `ipconfig` and check the IPv4 Address.
   - **Mac/Linux**: Run `ifconfig` or `ip a`.
2. Open [Mobile/src/config.js](file:///e:/Personal%20Projects/CuraLine/Mobile/src/config.js) and update the `API_BASE_URL` IP:
   ```javascript
   // src/config.js
   export const API_BASE_URL = 'http://<YOUR_LAN_IP>:8000/api'
   ```

### 3. Run the App
Launch the Expo bundler:
```bash
npx expo start
```
- **Android Emulator**: Press `a`.
- **iOS Simulator**: Press `i`.
- **Physical Phone**: Install the **Expo Go** app (iOS App Store / Google Play Store) and scan the QR code displayed in the terminal.

---

## 🔑 Test Credentials (Seeded)
Use the following credentials to test the authentication flow:

* **Patient Account**:
  - Email: `john@example.com`
  - Password: `Patient@1234`
* **Doctor Account**:
  - Email: `sarah.jenkins@curaline.com`
  - Password: `Doctor@1234`

---

## 🛠️ Production Migration Guide

To transition this codebase to **React Native CLI** or **Flutter**:

### Swapping Expo Libraries (React Native CLI)
The code uses a minimal set of dependencies to make porting straightforward:
1. **Secure Storage**: Replace `expo-secure-store` with `react-native-keychain` inside `src/context/AuthContext.js`.
2. **Icons**: Replace `@expo/vector-icons` with `react-native-vector-icons` (import Ionicons).
3. **Routing**: The app uses standard React Navigation v7 (`@react-navigation/native`), which is fully compatible with both Expo and React Native CLI.

### Porting to Flutter
If porting to Flutter:
1. **Navigation**: Rebuild the role-based conditional router using Flutter's `Navigator 2.0` or `go_router`.
2. **State Management**: Implement auth session tracking via `Provider` or `Bloc`, caching the JWT token using `flutter_secure_storage`.
3. **UI Elements**: Recreate the custom cards, chips, and input fields using Flutter's `Material 3` or `Cupertino` widgets.

---

## Push Notifications

The app registers for push notifications automatically after sign-in (Expo Push,
backed by FCM/APNs). The backend sends pushes for booking confirmations,
day-before reminders, and severity-swap requests.

> [!IMPORTANT]
> **Android + Expo Go limitation:** since Expo SDK 53, remote push notifications
> on Android require a development build (`npx expo run:android` or EAS Build) -
> they will not arrive inside the Expo Go sandbox app. iOS Expo Go and all
> development/production builds receive them normally. The app degrades
> gracefully: if push is unavailable, everything else works and notifications
> still arrive by email.

## Staying Signed In

Sessions use short-lived access tokens renewed silently with rotating refresh
tokens (30 days), stored in the device keychain. You stay signed in until you
log out, change your password, or go 30 days without opening the app.

## Before You Build for Production (Security)

- **Set the production API URL.** Edit `src/config.js` → `PROD_API_URL` to your
  real **HTTPS** domain. Release builds use this automatically (`__DEV__` is
  false); the LAN/`http://` dev URL is never used in production.
- **HTTPS is mandatory.** iOS App Transport Security and Android
  (`usesCleartextTraffic: false` in `app.json`) block plaintext HTTP in release
  builds. The app throws at startup if a release build is pointed at a non-HTTPS
  URL, so misconfiguration fails loudly instead of silently.
- **Secrets:** tokens live in the OS keychain/keystore (expo-secure-store),
  never in plain storage. No API keys or secrets are bundled in the app.
- **Known deferred:** 18 moderate `npm audit` findings are build-time transitive
  deps (postcss/js-yaml/uuid) that require an Expo SDK 56 major upgrade; they do
  not affect the shipped binary's runtime security and are deferred to the next
  SDK bump.
