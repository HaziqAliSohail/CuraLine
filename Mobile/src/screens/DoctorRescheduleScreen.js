import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { listDoctorReschedules } from '../api/client'
import { Card, SeverityBadge } from '../components/ui'
import { font, colors, fmtDate, fmtTime } from '../theme'
import { Ionicons } from '@expo/vector-icons'

export default function DoctorRescheduleScreen() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchReschedules = async () => {
    try {
      const res = await listDoctorReschedules()
      setRequests(res.data)
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReschedules()
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color="#1e3a8a" />
        <Text style={styles.infoBannerText}>
          These are pending severity swaps. When a patient approves a swap, the calendar updates automatically.
          No action is required from you.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
      ) : requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="git-compare-outline" size={32} color={colors.textFaint} />
          </View>
          <Text style={styles.emptyTitle}>No pending swaps</Text>
          <Text style={styles.emptyDesc}>Your schedule is stable with no active triage shifts in progress.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Card style={styles.swapCard}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cardTitle}>Triage Swap Request</Text>
                  <SeverityBadge score={item.severity_score} />
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>

              <View style={styles.comparisonRow}>
                <View style={styles.slotBlock}>
                  <Text style={styles.slotBlockTitle}>Target Slot</Text>
                  <Text style={styles.slotDate}>{fmtDate(item.target_slot_date)}</Text>
                  <Text style={styles.slotTime}>{fmtTime(item.target_slot_time)}</Text>
                </View>

                <View style={styles.arrowBlock}>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                </View>

                <View style={styles.slotBlock}>
                  <Text style={styles.slotBlockTitle}>Proposed Swap</Text>
                  <Text style={styles.slotDate}>{fmtDate(item.proposed_slot_date)}</Text>
                  <Text style={styles.slotTime}>{fmtTime(item.proposed_slot_time)}</Text>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    padding: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  infoBannerText: { fontSize: 11, color: '#1e3a8a', flex: 1, lineHeight: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 15, fontFamily: font.bold, color: colors.textMuted },
  emptyDesc: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  swapCard: { padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 13, fontFamily: font.bold, color: colors.text },
  statusBadge: { backgroundColor: colors.amberBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 9, fontFamily: font.bold, color: colors.amber },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotBlock: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  slotBlockTitle: { fontSize: 9, fontFamily: font.bold, color: colors.textFaint, textTransform: 'uppercase', marginBottom: 4 },
  slotDate: { fontSize: 11, fontFamily: font.bold, color: colors.text },
  slotTime: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  arrowBlock: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
