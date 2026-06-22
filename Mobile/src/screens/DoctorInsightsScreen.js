import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getDoctorAnalytics } from '../api/client'
import { Card, Chip } from '../components/ui'
import { font, colors } from '../theme'
import { Ionicons } from '@expo/vector-icons'

const WINDOWS = [
  { days: 30, label: '30 Days' },
  { days: 90, label: '90 Days' },
  { days: 365, label: '1 Year' },
]

const SEVERITY_COLORS = {
  1: '#34d399',
  2: '#a3e635',
  3: '#fbbf24',
  4: '#fb923c',
  5: '#ef4444',
}

const SEVERITY_LABELS = {
  1: 'Routine',
  2: 'Low',
  3: 'Moderate',
  4: 'High',
  5: 'Critical',
}

function StatCard({ icon, iconBg, iconColor, label, value, hint }) {
  return (
    <Card style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={15} color={iconColor} />
        </View>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </Card>
  )
}

export default function DoctorInsightsScreen() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = async () => {
    try {
      const res = await getDoctorAnalytics(days)
      setData(res.data)
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchAnalytics()
  }, [days])

  const maxSeverityCount = data ? Math.max(1, ...Object.values(data.severity_counts)) : 1

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Header filter */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Practice Insights</Text>
          <Text style={styles.headerSub}>Based on outcomes you record.</Text>
        </View>
        <View style={styles.periodRow}>
          {WINDOWS.map((w) => (
            <Chip
              key={w.days}
              label={w.label}
              active={days === w.days}
              onPress={() => setDays(w.days)}
            />
          ))}
        </View>
      </View>

      {loading || !data ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : data.total_appointments === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="bar-chart-outline" size={36} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>No analytics data available</Text>
          <Text style={styles.emptyDesc}>
            Data compiles automatically as appointments conclude and outcomes are submitted.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 16 }}>
          {/* Numerical grids */}
          <View style={styles.statsGrid}>
            <StatCard
              icon="checkmark-circle-outline"
              iconBg={colors.emeraldBg}
              iconColor={colors.emerald}
              label="Completed"
              value={data.completed}
              hint={`of ${data.total_appointments} total`}
            />
            <StatCard
              icon="people-outline"
              iconBg={colors.redBg}
              iconColor={colors.red}
              label="No-show Rate"
              value={data.no_show_rate !== null ? `${data.no_show_rate}%` : '-'}
              hint={data.no_show_rate !== null ? `${data.no_show} no-show(s)` : 'No records yet'}
            />
            <StatCard
              icon="pulse-outline"
              iconBg={colors.amberBg}
              iconColor={colors.amber}
              label="Avg Severity"
              value={data.avg_severity !== null ? `${data.avg_severity}/5` : '-'}
              hint="Attended visits only"
            />
            <StatCard
              icon="calendar-outline"
              iconBg={colors.primaryLight}
              iconColor={colors.primary}
              label="Busiest Day"
              value={data.busiest_weekday || '-'}
              hint={`${data.scheduled} scheduled`}
            />
          </View>

          {/* Severity bar graphs */}
          <Card style={styles.caseMixCard}>
            <Text style={styles.cardSectionTitle}>Case Mix by Severity</Text>
            <View style={styles.caseMixList}>
              {[5, 4, 3, 2, 1].map((s) => {
                const count = data.severity_counts[s] || 0
                const pct = (count / maxSeverityCount) * 100
                return (
                  <View key={s} style={styles.caseMixRow}>
                    <Text style={styles.caseMixLabel}>
                      {s} · {SEVERITY_LABELS[s]}
                    </Text>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${count ? Math.max(pct, 6) : 0}%`,
                            backgroundColor: SEVERITY_COLORS[s] || colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.caseMixVal}>{count}</Text>
                  </View>
                )
              })}
            </View>
          </Card>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 10,
  },
  headerTitle: { fontSize: 18, fontFamily: font.extrabold, color: colors.text },
  headerSub: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
  periodRow: { flexDirection: 'row', gap: 2 },
  emptyCard: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: font.bold, color: colors.textMuted },
  emptyDesc: { fontSize: 12, color: colors.textFaint, textAlign: 'center', lineHeight: 18 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: '45%', padding: 14 },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { fontSize: 10, fontFamily: font.bold, color: colors.textMuted, textTransform: 'uppercase' },
  statValue: { fontSize: 20, fontFamily: font.extrabold, color: colors.text },
  statHint: { fontSize: 9, color: colors.textFaint, marginTop: 4 },
  caseMixCard: { padding: 16 },
  cardSectionTitle: { fontSize: 11, fontFamily: font.bold, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12 },
  caseMixList: { gap: 12 },
  caseMixRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caseMixLabel: { fontSize: 11, fontFamily: font.semibold, color: colors.textMuted, width: 85 },
  progressBarBg: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  caseMixVal: { fontSize: 11, fontFamily: font.bold, color: colors.text, width: 20, textAlign: 'right' },
})
