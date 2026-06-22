import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { listRescheduleRequests, acceptReschedule, declineReschedule } from '../api/client'
import { Button, Card } from '../components/ui'
import { font, colors, fmtDate, fmtTime } from '../theme'
import { Ionicons } from '@expo/vector-icons'

function ProposedSlotCard({ date, time, label }) {
  return (
    <View style={styles.proposedSlot}>
      <Text style={styles.proposedSlotLabel}>{label}</Text>
      <View style={styles.proposedSlotBox}>
        <View style={styles.proposedSlotField}>
          <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
          <Text style={styles.proposedSlotVal}>{fmtDate(date)}</Text>
        </View>
        <View style={[styles.proposedSlotField, { marginTop: 4 }]}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={styles.proposedSlotValSub}>{fmtTime(time)}</Text>
        </View>
      </View>
    </View>
  )
}

export default function RescheduleScreen() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [alert, setAlert] = useState({ text: '', type: 'success' })

  const fetchRequests = async () => {
    try {
      const res = await listRescheduleRequests()
      setRequests(res.data)
    } catch {
      setAlert({ text: 'Could not load reschedule requests.', type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchRequests()
  }, [])

  const handleAccept = async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: 'accept' }))
    setAlert({ text: '', type: 'success' })
    try {
      await acceptReschedule(id)
      setAlert({ text: 'Slot swap accepted successfully! Your appointment has been moved.', type: 'success' })
      fetchRequests()
    } catch (err) {
      setAlert({ text: err.response?.data?.detail || 'Could not accept request.', type: 'danger' })
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }))
    }
  }

  const handleDecline = async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: 'decline' }))
    setAlert({ text: '', type: 'success' })
    try {
      await declineReschedule(id)
      setAlert({ text: 'Reschedule declined. Your original slot remains unchanged.', type: 'success' })
      fetchRequests()
    } catch (err) {
      setAlert({ text: err.response?.data?.detail || 'Could not decline request.', type: 'danger' })
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }))
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {alert.text ? (
        <Text style={[styles.alertBar, alert.type === 'danger' ? styles.alertDanger : styles.alertSuccess]}>
          {alert.text}
        </Text>
      ) : null}

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="swap-horizontal" size={36} color={colors.textFaint} />
          </View>
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptyDesc}>You are currently all set! No swap requests have been sent to you.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const acting = actionLoading[item.id]
            return (
              <Card style={styles.requestCard}>
                {/* Urgent Header notice */}
                <View style={styles.cardUrgencyHeader}>
                  <Ionicons name="alert-circle" size={16} color={colors.amber} />
                  <Text style={styles.urgencyHeaderText}>
                    A critical patient needs your slot for urgent care
                  </Text>
                </View>

                {/* Proposed Swap details */}
                <Text style={styles.sectionHeader}>PROPOSED SLOT SWAP</Text>
                <View style={styles.swapComparison}>
                  <ProposedSlotCard
                    date={item.current_slot_date}
                    time={item.current_slot_time}
                    label="Current Slot"
                  />
                  <View style={styles.arrowContainer}>
                    <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                  </View>
                  <ProposedSlotCard
                    date={item.proposed_slot_date}
                    time={item.proposed_slot_time}
                    label="New Proposed Slot"
                  />
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <Button
                    title="Decline"
                    onPress={() => handleDecline(item.id)}
                    variant="secondary"
                    disabled={!!acting}
                    loading={acting === 'decline'}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Accept & Swap"
                    onPress={() => handleAccept(item.id)}
                    variant="primary"
                    disabled={!!acting}
                    loading={acting === 'accept'}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  alertBar: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    fontSize: 13,
    fontFamily: font.semibold,
    overflow: 'hidden',
  },
  alertSuccess: { backgroundColor: colors.emeraldBg, color: colors.emerald },
  alertDanger: { backgroundColor: colors.redBg, color: colors.red },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 16, fontFamily: font.bold, color: colors.textMuted },
  emptyDesc: { fontSize: 13, color: colors.textFaint, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  requestCard: { padding: 16, overflow: 'hidden' },
  cardUrgencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amberBg,
    marginHorizontal: -16,
    marginVertical: -16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  urgencyHeaderText: { fontSize: 12, color: colors.amber, fontFamily: font.bold },
  sectionHeader: { fontSize: 10, fontFamily: font.bold, color: colors.textFaint, letterSpacing: 1, marginBottom: 10 },
  swapComparison: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  proposedSlot: { flex: 1 },
  proposedSlotLabel: { fontSize: 10, fontFamily: font.semibold, color: colors.textMuted, marginBottom: 4 },
  proposedSlotBox: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8 },
  proposedSlotField: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  proposedSlotVal: { fontSize: 11, fontFamily: font.bold, color: colors.text },
  proposedSlotValSub: { fontSize: 10, color: colors.textMuted },
  arrowContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: { flexDirection: 'row', gap: 10 },
})
