// Haptic feedback - the invisible premium layer.
// Every meaningful action gets a tactile response; failures are silent
// (web preview, simulators, and devices without engines just no-op).
import * as Haptics from 'expo-haptics'

export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
export const press = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
export const warning = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
export const error = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
