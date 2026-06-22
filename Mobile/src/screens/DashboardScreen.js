import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { listRescheduleRequests, listUpcomingAppointments } from '../api/client'
import {
  Avatar, Card, FadeInView, GradientCard, PressableScale,
  SectionTitle, SeverityBadge, SkeletonCard,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { colors, font, fmtTime, radius, shadow, spacing } from '../theme'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((target - today) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `In ${diff} days`
}

function longDate(dateStr) {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

const ACTIONS = [
  { label: 'Book with AI', desc: 'Symptoms → matched instantly', screen: 'Book', icon: 'chatbubble-ellipses', tint: colors.primary, bg: colors.primaryLight },
  { label: 'Browse Doctors', desc: 'Insurance, reviews & slots', screen: 'Doctors', icon: 'search', tint: colors.violet, bg: colors.violetBg },
  { label: 'My Visits', desc: 'Track, cancel or rate', screen: 'Visits', icon: 'calendar', tint: colors.emerald, bg: colors.emeraldBg },
]

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth()
  const [upcoming, setUpcoming] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      const [apptRes, reschedRes] = await Promise.all([
        listUpcomingAppointments(),
        listRescheduleRequests(),
      ])
      setUpcoming(apptRes.data)
      setPendingCount(reschedRes.data.length)
    } catch {
      // silent - pull to refresh retries
    } finally {
      setLoaded(true)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const next = upcoming[0]
  const countdown = next ? daysUntil(next.slot_date) : null

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 44 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <FadeInView>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingSmall}>{greeting},</Text>
            <Text style={styles.greetingName}>{user?.name?.split(' ')[0]}</Text>
          </View>
          <Avatar name={user?.name} size={46} />
        </View>
      </FadeInView>

      {/* Severity-swap alert */}
      {pendingCount > 0 && (
        <FadeInView delay={40}>
          <PressableScale onPress={() => navigation.navigate('Reschedule')} haptic="press">
            <View style={[styles.alert, shadow.sm]}>
              <View style={styles.alertIcon}>
                <Ionicons name="swap-horizontal" size={17} color={colors.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>
                  {pendingCount} reschedule request{pendingCount !== 1 ? 's' : ''} waiting
                </Text>
                <Text style={styles.alertSub}>A critical patient needs your slot - tap to review</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.amber} />
            </View>
          </PressableScale>
        </FadeInView>
      )}

      {/* Hero: next appointment */}
      <FadeInView delay={80}>
        {!loaded ? (
          <SkeletonCard />
        ) : next ? (
          <GradientCard>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroEyebrow}>NEXT APPOINTMENT</Text>
              {countdown ? (
                <View style={styles.heroCountdown}>
                  <Text style={styles.heroCountdownText}>{countdown}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.heroDoctorRow}>
              <Avatar name={next.doctor_name} size={50} light />
              <View style={{ flex: 1 }}>
                <Text style={styles.heroDoctor}>{next.doctor_name || 'Your Doctor'}</Text>
                <Text style={styles.heroSpec}>{next.doctor_specialization}</Text>
              </View>
            </View>
            <View style={styles.heroWhenRow}>
              <Ionicons name="calendar-clear" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroWhen}>{longDate(next.slot_date)}</Text>
              <Ionicons name="time" size={13} color="rgba(255,255,255,0.85)" style={{ marginLeft: 10 }} />
              <Text style={styles.heroWhen}>{fmtTime(next.slot_time)}</Text>
            </View>
          </GradientCard>
        ) : (
          <GradientCard>
            <Text style={styles.heroEyebrow}>NO UPCOMING VISITS</Text>
            <Text style={styles.heroEmptyTitle}>How are you feeling today?</Text>
            <Text style={styles.heroEmptySub}>
              Describe your symptoms and the AI books the right doctor - most critical first.
            </Text>
            <PressableScale onPress={() => navigation.navigate('Book')} haptic="press" style={styles.heroCta}>
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text style={styles.heroCtaText}>Book with AI</Text>
            </PressableScale>
          </GradientCard>
        )}
      </FadeInView>

      {/* Quick actions */}
      <FadeInView delay={140}>
        <SectionTitle>Quick actions</SectionTitle>
        {ACTIONS.map((a) => (
          <PressableScale key={a.screen} onPress={() => navigation.navigate(a.screen)} haptic="tap">
            <Card style={styles.action}>
              <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon} size={18} color={a.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionLabel}>{a.label}</Text>
                <Text style={styles.actionDesc}>{a.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Card>
          </PressableScale>
        ))}
      </FadeInView>

      {/* Remaining upcoming */}
      {upcoming.length > 1 && (
        <FadeInView delay={200}>
          <SectionTitle>Also coming up</SectionTitle>
          {upcoming.slice(1).map((a) => (
            <Card key={a.id} style={styles.upcomingRow}>
              <Avatar name={a.doctor_name} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.upcomingName}>{a.doctor_name}</Text>
                <Text style={styles.upcomingWhen}>
                  {longDate(a.slot_date)} · {fmtTime(a.slot_time)}
                </Text>
              </View>
              <SeverityBadge score={a.severity_score} />
            </Card>
          ))}
        </FadeInView>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl, gap: spacing.md },
  greetingSmall: { fontSize: 14, fontFamily: font.medium, color: colors.textMuted },
  greetingName: { fontSize: 27, fontFamily: font.extrabold, color: colors.text, letterSpacing: -0.5, marginTop: 1 },
  alert: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1.5, borderColor: '#fde68a', marginBottom: spacing.md,
  },
  alertIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.amberBg,
    alignItems: 'center', justifyContent: 'center',
  },
  alertTitle: { fontFamily: font.bold, color: colors.text, fontSize: 13.5 },
  alertSub: { fontSize: 12, fontFamily: font.medium, color: colors.textMuted, marginTop: 1 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  heroEyebrow: { fontSize: 10.5, fontFamily: font.extrabold, color: 'rgba(255,255,255,0.75)', letterSpacing: 1.6 },
  heroCountdown: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: radius.full,
  },
  heroCountdownText: { color: '#fff', fontSize: 11.5, fontFamily: font.bold },
  heroDoctorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroDoctor: { color: '#fff', fontSize: 19, fontFamily: font.extrabold, letterSpacing: -0.3 },
  heroSpec: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontFamily: font.semibold, marginTop: 1 },
  heroWhenRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.lg },
  heroWhen: { color: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontFamily: font.semibold },
  heroEmptyTitle: { color: '#fff', fontSize: 20, fontFamily: font.extrabold, marginTop: spacing.sm, letterSpacing: -0.3 },
  heroEmptySub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: font.medium, lineHeight: 19, marginTop: 6 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 12, marginTop: spacing.lg,
  },
  heroCtaText: { color: colors.primary, fontSize: 14, fontFamily: font.bold },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  actionIcon: {
    width: 40, height: 40, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontSize: 14.5, fontFamily: font.bold, color: colors.text },
  actionDesc: { fontSize: 12, fontFamily: font.medium, color: colors.textFaint, marginTop: 1 },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  upcomingName: { fontFamily: font.bold, color: colors.text, fontSize: 14 },
  upcomingWhen: { fontSize: 12, fontFamily: font.medium, color: colors.textFaint, marginTop: 1 },
})
