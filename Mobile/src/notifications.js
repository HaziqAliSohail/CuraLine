/**
 * Push notification registration (Expo Push).
 *
 * Gracefully degrades: if the user denies permission, the module is missing,
 * or the runtime doesn't support remote push (Android Expo Go on SDK 53+
 * requires a development build), we simply return null and the app works
 * without push.
 */
export async function getPushToken() {
  try {
    const Notifications = require('expo-notifications')

    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync()
      status = req.status
    }
    if (status !== 'granted') return null

    const tokenData = await Notifications.getExpoPushTokenAsync()
    return tokenData?.data || null
  } catch (e) {
    // No push support in this runtime - fine, app works without it
    return null
  }
}
