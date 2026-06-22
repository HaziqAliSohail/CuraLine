// CuraLine premium component kit.
// Every component here is used across all screens - polish lands everywhere.
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { avatarColor, colors, font, initialsOf, radius, SEVERITY_LABELS, shadow, spacing } from '../theme'
import * as haptics from '../haptics'

/* ── Animated press wrapper: everything tactile compresses slightly ── */
export function PressableScale({ children, onPress, disabled, style, haptic = 'tap', ...rest }) {
  const scale = useRef(new Animated.Value(1)).current
  const animate = (to) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
  return (
    <Pressable
      onPressIn={() => animate(0.97)}
      onPressOut={() => animate(1)}
      onPress={(e) => {
        if (haptic) haptics[haptic]?.()
        onPress?.(e)
      }}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  )
}

/* ── Entrance animation: cards fade + rise in, optionally staggered ── */
export function FadeInView({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(10)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, delay, useNativeDriver: true }),
      Animated.timing(translateY, {
        toValue: 0, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start()
  }, [])
  return <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>{children}</Animated.View>
}

/* ── Surfaces ────────────────────────────────────────────────────── */
export function Card({ children, style, elevated }) {
  return <View style={[styles.card, elevated ? shadow.md : shadow.sm, style]}>{children}</View>
}

export function GradientCard({ children, style, colors: stops }) {
  return (
    <LinearGradient
      colors={stops || [colors.gradientStart, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1.1, y: 1.2 }}
      style={[styles.gradientCard, shadow.lg, style]}
    >
      {children}
    </LinearGradient>
  )
}

/* ── Button ──────────────────────────────────────────────────────── */
export function Button({ title, onPress, variant = 'primary', disabled, loading, style, icon }) {
  const base = variant === 'primary' ? styles.btnPrimary
    : variant === 'danger' ? styles.btnDanger
    : variant === 'success' ? styles.btnSuccess
    : variant === 'ghost' ? styles.btnGhost
    : styles.btnSecondary
  const textStyle = variant === 'secondary' ? styles.btnTextDark
    : variant === 'ghost' ? styles.btnTextGhost
    : styles.btnTextLight
  const hapticType = variant === 'danger' ? 'warning' : variant === 'success' ? 'success' : 'press'
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic={hapticType}
      style={[styles.btn, base, variant === 'primary' && shadow.md, (disabled || loading) && { opacity: 0.45 }, style]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading
        ? <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.primary : '#fff'} size="small" />
        : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            {icon}
            <Text style={[styles.btnText, textStyle]}>{title}</Text>
          </View>
        )}
    </PressableScale>
  )
}

/* ── Avatar: deterministic color, initials ───────────────────────── */
export function Avatar({ name, size = 44, light }) {
  const bg = light ? 'rgba(255,255,255,0.22)' : avatarColor(name) + '1f'
  const fg = light ? '#fff' : avatarColor(name)
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.36,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: font.extrabold, fontSize: size * 0.36, color: fg }}>
        {initialsOf(name)}
      </Text>
    </View>
  )
}

/* ── Badges ──────────────────────────────────────────────────────── */
export function SeverityBadge({ score }) {
  if (!score) return null
  const s = Math.max(1, Math.min(5, score))
  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (s === 5) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]))
      loop.start()
      return () => loop.stop()
    }
  }, [s])
  return (
    <View style={[styles.sevBadge, { backgroundColor: colors.severity[s] + '1c' }]}
      accessibilityLabel={`Severity ${s} of 5 - ${SEVERITY_LABELS[s]}`}>
      <Animated.View style={[styles.sevDot, { backgroundColor: colors.severity[s], opacity: pulse }]} />
      <Text style={[styles.sevText, { color: colors.severity[s] }]}>{s}/5 · {SEVERITY_LABELS[s]}</Text>
    </View>
  )
}

const STATUS_COLORS = {
  SCHEDULED: { bg: colors.primaryLight, fg: colors.primary },
  COMPLETED: { bg: colors.emeraldBg, fg: colors.emerald },
  CANCELLED: { bg: '#f3f4f6', fg: colors.textMuted },
  NO_SHOW: { bg: colors.redBg, fg: colors.red },
}

export function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.CANCELLED
  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusText, { color: c.fg }]}>{status?.replace('_', ' ')}</Text>
    </View>
  )
}

/* ── Selection ───────────────────────────────────────────────────── */
export function Chip({ label, active, onPress }) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </PressableScale>
  )
}

export function SegmentedControl({ options, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => { haptics.tap(); onChange(opt.value) }}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/* ── Skeleton shimmer (replaces spinners) ────────────────────────── */
export function Skeleton({ width = '100%', height = 14, style }) {
  const opacity = useRef(new Animated.Value(0.45)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [])
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius.sm, backgroundColor: '#e6e7f0', opacity }, style]}
    />
  )
}

export function SkeletonCard() {
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton width={44} height={44} style={{ borderRadius: 14 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="70%" />
          <Skeleton width="45%" height={11} />
          <Skeleton width="58%" height={11} />
        </View>
      </View>
    </Card>
  )
}

/* ── Bottom sheet (slide-up panel) ───────────────────────────────── */
export function BottomSheet({ visible, onClose, title, children }) {
  const translateY = useRef(new Animated.Value(600)).current
  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }).start()
    } else {
      translateY.setValue(600)
    }
  }, [visible])
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="Close panel" />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.sheetHandle} />
        {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
        {children}
      </Animated.View>
    </Modal>
  )
}

/* ── Toast (replaces Alert for non-blocking feedback) ────────────── */
let _showToast = null
export const toast = {
  success: (msg) => { haptics.success(); _showToast?.(msg, colors.emerald) },
  error: (msg) => { haptics.error(); _showToast?.(msg, colors.red) },
  info: (msg) => { haptics.tap(); _showToast?.(msg, colors.text) },
}

export function ToastHost() {
  const [state, setState] = useState(null)
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef(null)
  useEffect(() => {
    _showToast = (message, tint) => {
      clearTimeout(timer.current)
      setState({ message, tint })
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start()
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => setState(null))
      }, 2600)
    }
    return () => { _showToast = null; clearTimeout(timer.current) }
  }, [])
  if (!state) return null
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, shadow.lg, { opacity }]}>
      <View style={[styles.toastDot, { backgroundColor: state.tint }]} />
      <Text style={styles.toastText} numberOfLines={2}>{state.message}</Text>
    </Animated.View>
  )
}

/* ── Form & states ───────────────────────────────────────────────── */
export function Field({ label, children }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

export function EmptyState({ title, subtitle, icon }) {
  return (
    <FadeInView style={styles.empty}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </FadeInView>
  )
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )
}

export function SectionTitle({ children, style }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>
}

export const inputStyle = {
  borderWidth: 1.5,
  borderColor: colors.border,
  borderRadius: radius.md,
  paddingHorizontal: 15,
  paddingVertical: 11,
  fontSize: 15,
  fontFamily: font.medium,
  color: colors.text,
  backgroundColor: '#fff',
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  gradientCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  btn: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnDanger: { backgroundColor: colors.red },
  btnSuccess: { backgroundColor: colors.emerald },
  btnSecondary: { backgroundColor: '#eceef6' },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { fontSize: 14, fontFamily: font.bold },
  btnTextLight: { color: '#fff' },
  btnTextDark: { color: colors.text },
  btnTextGhost: { color: colors.primary },
  sevBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4.5, borderRadius: radius.full, alignSelf: 'flex-start',
  },
  sevDot: { width: 7, height: 7, borderRadius: 4 },
  sevText: { fontSize: 12, fontFamily: font.bold },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.sm - 2 },
  statusText: { fontSize: 11, fontFamily: font.bold },
  chip: {
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.sm + 1,
    backgroundColor: '#eceef6', marginRight: spacing.sm, marginBottom: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, ...shadow.sm },
  chipText: { fontSize: 12.5, fontFamily: font.semibold, color: colors.textMuted },
  chipTextActive: { color: '#fff' },
  segmented: {
    flexDirection: 'row', backgroundColor: '#eceef6',
    borderRadius: radius.md, padding: 3,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: radius.md - 3, alignItems: 'center' },
  segmentActive: { backgroundColor: '#fff', ...shadow.sm },
  segmentText: { fontSize: 12.5, fontFamily: font.semibold, color: colors.textMuted },
  segmentTextActive: { color: colors.text },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,18,34,0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.xl + 4, borderTopRightRadius: radius.xl + 4,
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, paddingTop: spacing.md,
    maxHeight: '85%',
  },
  sheetHandle: {
    alignSelf: 'center', width: 40, height: 4.5, borderRadius: 3,
    backgroundColor: '#dcdee8', marginBottom: spacing.lg,
  },
  sheetTitle: { fontSize: 18, fontFamily: font.extrabold, color: colors.text, marginBottom: spacing.lg },
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20,
    backgroundColor: '#16182b', borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 999,
  },
  toastDot: { width: 8, height: 8, borderRadius: 4 },
  toastText: { color: '#fff', fontSize: 13.5, fontFamily: font.semibold, flex: 1 },
  fieldLabel: { fontSize: 13, fontFamily: font.bold, color: colors.textMuted, marginBottom: 7 },
  empty: { alignItems: 'center', paddingVertical: 52 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 22, backgroundColor: '#eceef6',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 15, fontFamily: font.bold, color: colors.textMuted },
  emptySub: { fontSize: 13, fontFamily: font.medium, color: colors.textFaint, marginTop: 5, textAlign: 'center', paddingHorizontal: 30, lineHeight: 19 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  sectionTitle: {
    fontSize: 11, fontFamily: font.extrabold, color: colors.textFaint,
    letterSpacing: 1.4, textTransform: 'uppercase',
    marginTop: spacing.md, marginBottom: spacing.sm + 2,
  },
})
