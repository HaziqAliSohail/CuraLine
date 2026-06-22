import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import {
  getDoctorBriefing,
  listDoctorAppointments,
  listDoctorReschedules,
  recordOutcome,
  getAppointmentVideo,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Button, Card, GradientCard, Skeleton, StatusBadge, SeverityBadge, toast } from '../components/ui'
import { font, colors, fmtDate, fmtTime, toISODate, radius, spacing } from '../theme'
import { Ionicons } from '@expo/vector-icons'

const SEVERITY_COLOR = {
  1: '#34d399',
  2: '#a3e635',
  3: '#fbbf24',
  4: '#fb923c',
  5: '#ef4444',
}

const heroStyles = {
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: spacing.md },
  heroIcon: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 16.5, fontFamily: font.extrabold, color: '#fff', letterSpacing: -0.2 },
  heroDate: { fontSize: 12, fontFamily: font.semibold, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  heroSummary: { fontSize: 13.5, fontFamily: font.medium, color: 'rgba(255,255,255,0.95)', lineHeight: 20 },
  heroMixRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.lg },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 11, paddingVertical: 5.5, borderRadius: radius.full,
  },
  heroPillText: { fontSize: 11.5, fontFamily: font.bold, color: '#fff' },
}

function BriefingCard({ briefing, loading }) {
  if (loading) {
    return (
      <Card>
        <Skeleton width="45%" height={16} />
        <Skeleton width="100%" height={12} style={{ marginTop: 12 }} />
        <Skeleton width="72%" height={12} style={{ marginTop: 8 }} />
      </Card>
    )
  }
  if (!briefing) return null

  const mix = [
    { label: 'Critical', count: briefing.critical_count },
    { label: 'Moderate', count: briefing.moderate_count },
    { label: 'Routine', count: briefing.routine_count },
  ]

  return (
    <GradientCard colors={['#f59e0b', '#ea580c']}>
      <View style={heroStyles.heroHeader}>
        <View style={heroStyles.heroIcon}>
          <Ionicons name="sunny" size={19} color="#fff" />
        </View>
        <View>
          <Text style={heroStyles.heroTitle}>Morning Briefing</Text>
          <Text style={heroStyles.heroDate}>{fmtDate(briefing.date)}</Text>
        </View>
      </View>
      <Text style={heroStyles.heroSummary}>{briefing.summary}</Text>

      {briefing.total_appointments > 0 ? (
        <View style={heroStyles.heroMixRow}>
          {mix
            .filter((m) => m.count > 0)
            .map((m) => (
              <View key={m.label} style={heroStyles.heroPill}>
                <Text style={heroStyles.heroPillText}>{m.count} {m.label}</Text>
              </View>
            ))}
          {briefing.first_appointment_time ? (
            <View style={heroStyles.heroPill}>
              <Ionicons name="time-outline" size={11} color="#fff" />
              <Text style={heroStyles.heroPillText}>
                First: {fmtTime(briefing.first_appointment_time)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </GradientCard>
  )
}

function AppointmentRow({ item, isToday, onOutcome, outcomeLoading, onJoinVideo }) {
  const [expanded, setExpanded] = useState(false)
  const colorStrip = SEVERITY_COLOR[item.severity_score] || '#e5e7eb'

  return (
    <Card style={styles.apptCard}>
      <View style={{ flexDirection: 'row' }}>
        {/* Severity left border strip */}
        <View style={[styles.severityStrip, { backgroundColor: colorStrip }]} />
        <View style={{ flex: 1, padding: 14 }}>
          {/* Header Row */}
          <View style={styles.apptHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.apptTime}>{fmtTime(item.slot_time)}</Text>
                <Text style={styles.apptName}>{item.patient_name || 'Patient'}</Text>
              </View>
              {item.reason ? <Text style={styles.apptReason} numberOfLines={1}>{item.reason}</Text> : null}
            </View>
            <StatusBadge status={item.status} />
          </View>

          {/* Collapsible details toggle and actions */}
          <View style={styles.apptFooter}>
            <Pressable onPress={() => setExpanded(!expanded)} style={styles.detailsToggle}>
              <Ionicons
                name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={14}
                color={colors.primary}
              />
              <Text style={styles.detailsToggleText}>{expanded ? 'Hide details' : 'Patient details'}</Text>
            </Pressable>

            {item.status === 'SCHEDULED' && isToday ? (
              <View style={styles.outcomeBtnGroup}>
                <Pressable
                  onPress={() => onJoinVideo(item.id)}
                  style={[styles.outcomeBtn, { backgroundColor: colors.primaryLight }]}
                >
                  <Text style={[styles.outcomeBtnText, { color: colors.primary }]}>Video</Text>
                </Pressable>
                <Pressable
                  onPress={() => onOutcome(item.id, 'NO_SHOW')}
                  disabled={!!outcomeLoading}
                  style={[styles.outcomeBtn, { backgroundColor: '#f3f4f6' }]}
                >
                  <Text style={[styles.outcomeBtnText, { color: colors.textMuted }]}>No-show</Text>
                </Pressable>
                <Pressable
                  onPress={() => onOutcome(item.id, 'COMPLETED')}
                  disabled={!!outcomeLoading}
                  style={[styles.outcomeBtn, { backgroundColor: colors.emerald }]}
                >
                  {outcomeLoading === 'COMPLETED' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.outcomeBtnText, { color: '#fff' }]}>Complete</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Expanded patient details */}
          {expanded ? (
            <View style={styles.expandedDetails}>
              {item.patient_phone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${item.patient_phone}`)}
                  style={styles.detailsField}
                >
                  <Ionicons name="call-outline" size={13} color={colors.textFaint} />
                  <Text style={[styles.detailsFieldText, { color: colors.primary, fontFamily: font.bold }]}>
                    {item.patient_phone}
                  </Text>
                </Pressable>
              ) : null}

              <View style={[styles.detailsField, { alignItems: 'flex-start' }]}>
                <Ionicons name="document-text-outline" size={13} color={colors.textFaint} style={{ marginTop: 2 }} />
                <Text style={styles.detailsFieldText}>
                  {item.patient_medical_history || 'No medical history on file.'}
                </Text>
              </View>

              <View style={styles.severityTagContainer}>
                <SeverityBadge score={item.severity_score} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  )
}

export default function DoctorDashboardScreen({ navigation }) {
  const { user } = useAuth()
  const [briefing, setBriefing] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [reschedules, setReschedules] = useState([])
  const [day, setDay] = useState(() => toISODate(new Date()))

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [outcomeLoading, setOutcomeLoading] = useState({})

  const today = toISODate(new Date())
  const isToday = day === today

  const loadData = async (targetDay) => {
    try {
      const [briefRes, reschedRes, apptRes] = await Promise.all([
        getDoctorBriefing(),
        listDoctorReschedules(),
        listDoctorAppointments(targetDay),
      ])
      setBriefing(briefRes.data)
      setReschedules(reschedRes.data)
      setAppointments(apptRes.data)
    } catch {
      // ignore failures; let refresh reload
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData(day)
    }, [day])
  )

  const onRefresh = () => {
    setRefreshing(true)
    loadData(day)
  }

  const shiftDay = (delta) => {
    const d = new Date(day + 'T00:00:00') // prevent timezone offsets
    d.setDate(d.getDate() + delta)
    setDay(toISODate(d))
  }

  const handleOutcome = async (id, status) => {
    setOutcomeLoading((prev) => ({ ...prev, [id]: status }))
    try {
      await recordOutcome(id, status)
      const res = await listDoctorAppointments(day)
      setAppointments(res.data)
    } catch {
      // error handled silently or via Toast
    } finally {
      setOutcomeLoading((prev) => ({ ...prev, [id]: null }))
    }
  }

  const handleJoinVideo = async (id) => {
    try {
      const { data } = await getAppointmentVideo(id)
      if (data.enabled && data.url) {
        Linking.openURL(data.url)
      } else {
        toast.error(data.message || "Video visits aren't enabled yet.")
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not start the video visit.')
    }
  }

  const dayLabel = isToday
    ? 'Today'
    : new Date(day + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<Pressable onPress={onRefresh} style={{ height: 0 }} />} // custom refresh simple binding
    >
      {/* Welcome header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome back, <Text style={{ color: colors.primary }}>{user?.name}</Text>
        </Text>
        <Text style={styles.subText}>
          {user?.specialization} · {user?.qualification}
        </Text>
      </View>

      {/* Morning Briefing */}
      <BriefingCard briefing={briefing} loading={loading} />

      {/* Reschedule Alert banner */}
      {reschedules.length > 0 ? (
        <Pressable onPress={() => navigation.navigate('DoctorReschedule')}>
          <View style={styles.resalert}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sync" size={15} color={colors.amber} />
              <Text style={styles.resalertTitle}>
                {reschedules.length} pending severity swap{reschedules.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={styles.resalertDesc}>
              A critical patient needs an early slot. Calendar swaps apply automatically when a patient approves.
              Tap to see details.
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* Day Navigator bar */}
      <View style={styles.dayNavigator}>
        <Text style={styles.sectionHeader}>SCHEDULE - {dayLabel.toUpperCase()}</Text>
        <View style={styles.navButtons}>
          <Pressable onPress={() => shiftDay(-1)} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
          </Pressable>
          {!isToday ? (
            <Pressable onPress={() => setDay(today)} style={styles.todayBtn}>
              <Text style={styles.todayBtnText}>Today</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => shiftDay(1)} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Appointments */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} />
      ) : appointments.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="calendar-clear-outline" size={36} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>No appointments {isToday ? 'today' : 'on this day'}</Text>
          <Text style={styles.emptyDesc}>Open slots are available for patient self-booking.</Text>
        </Card>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <AppointmentRow
              item={item}
              isToday={isToday}
              onOutcome={handleOutcome}
              outcomeLoading={outcomeLoading[item.id]}
              onJoinVideo={handleJoinVideo}
            />
          )}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { marginBottom: 18 },
  welcomeText: { fontSize: 20, fontFamily: font.extrabold, color: colors.text },
  subText: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  // Briefing
  briefingCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  briefingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  briefingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  briefingTitle: { fontSize: 14, fontFamily: font.extrabold, color: colors.text },
  briefingDate: { fontSize: 11, color: colors.textFaint, marginTop: 1 },
  briefingSummary: { fontSize: 13, lineHeight: 19, color: '#374151' },
  briefingMixRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  mixBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mixBadgeText: { fontSize: 11, fontFamily: font.bold },

  // Reschedule Alert
  resalert: {
    backgroundColor: colors.amberBg,
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  resalertTitle: { fontSize: 13, fontFamily: font.bold, color: colors.amber },
  resalertDesc: { fontSize: 11, color: colors.amber, opacity: 0.8, marginTop: 4, lineHeight: 16 },

  // Day Navigator
  dayNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 6,
  },
  sectionHeader: { fontSize: 10, fontFamily: font.bold, color: colors.textFaint, letterSpacing: 1 },
  navButtons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
  },
  todayBtnText: { fontSize: 11, fontFamily: font.bold, color: colors.primary },

  // Appointments list
  apptCard: { padding: 0, marginBottom: 12, overflow: 'hidden' },
  severityStrip: { width: 6, alignSelf: 'stretch' },
  apptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  apptTime: { fontSize: 14, fontFamily: font.extrabold, color: colors.text },
  apptName: { fontSize: 14, fontFamily: font.bold, color: '#374151', flexShrink: 1 },
  apptReason: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  apptFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
  },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailsToggleText: { fontSize: 12, color: colors.primary, fontFamily: font.bold },
  outcomeBtnGroup: { flexDirection: 'row', gap: 6 },
  outcomeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  outcomeBtnText: { fontSize: 11, fontFamily: font.bold },

  // Expanded patient details
  expandedDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
    gap: 8,
  },
  detailsField: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  detailsFieldText: { fontSize: 12, color: colors.textMuted, flex: 1, lineHeight: 18 },
  severityTagContainer: { alignSelf: 'flex-start', marginTop: 4 },

  emptyCard: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: font.bold, color: colors.textMuted },
  emptyDesc: { fontSize: 12, color: colors.textFaint, textAlign: 'center' },
})
