import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { cancelAppointment, createReview, listAppointments, listMyReviews, getAppointmentVideo } from '../api/client'
import { Button, Card, Chip, Field, StatusBadge, SeverityBadge, inputStyle } from '../components/ui'
import { font, colors, fmtDate, fmtTime } from '../theme'
import { Ionicons } from '@expo/vector-icons'

const FILTERS = ['All', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']

// Star Picker component for reviews
function StarRatingPicker({ rating, onChange }) {
  return (
    <View style={styles.starPickerRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onChange(star)} style={{ padding: 4 }}>
          <Ionicons
            name={star <= rating ? 'star' : 'star-outline'}
            size={32}
            color={star <= rating ? '#fbbf24' : '#e5e7eb'}
          />
        </Pressable>
      ))}
    </View>
  )
}

function ReviewModal({ visible, appointment, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (visible) {
      setRating(0)
      setComment('')
      setError('')
    }
  }, [visible])

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createReview({
        appointment_id: appointment.id,
        rating,
        comment: comment.trim() || null,
      })
      onSubmitted()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit your review.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!appointment) return null

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Rate your visit</Text>
              <Text style={styles.modalSubtitle}>{appointment.doctor_name}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={{ padding: 20 }}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Text style={styles.pickerLabel}>How was your appointment?</Text>
            <StarRatingPicker rating={rating} onChange={setRating} />

            <Field label="Comments (optional)">
              <TextInput
                style={[inputStyle, styles.commentInput]}
                placeholder="What stood out about your visit?"
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.textFaint}
              />
            </Field>

            <Button
              title={submitting ? 'Publishing…' : 'Publish Review'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={rating === 0 || submitting}
              style={{ marginTop: 12 }}
            />
            <Text style={styles.ratingInfoText}>
              Posted as a verified review - only patients who attended can rate.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default function VisitsScreen() {
  const [appointments, setAppointments] = useState([])
  const [myReviews, setMyReviews] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [selectedApptForReview, setSelectedApptForReview] = useState(null)

  const fetchAppointments = async () => {
    try {
      const [apptRes, reviewRes] = await Promise.all([listAppointments(), listMyReviews()])
      setAppointments(apptRes.data)
      // Map reviews by appointment id for quick "already rated" lookups
      setMyReviews(Object.fromEntries(reviewRes.data.map((r) => [r.appointment_id, r])))
    } catch {
      // silent fail, let pull-to-refresh retry
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchAppointments()
  }, [])

  const handleCancel = (item) => {
    Alert.alert(
      'Cancel Appointment',
      `Are you sure you want to cancel your appointment with ${item.doctor_name} on ${fmtDate(item.slot_date)}?`,
      [
        { text: 'Keep Appointment', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelAppointment(item.id)
              fetchAppointments()
            } catch (err) {
              Alert.alert('Error', err.response?.data?.detail || 'Failed to cancel appointment.')
            }
          },
        },
      ]
    )
  }

  const handleJoinVideo = async (item) => {
    try {
      const { data } = await getAppointmentVideo(item.id)
      if (data.enabled && data.url) {
        Linking.openURL(data.url)
      } else {
        Alert.alert('Video visit', data.message || "Video visits aren't enabled yet.")
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Could not start the video visit.')
    }
  }

  const handleReviewSubmitted = () => {
    setSelectedApptForReview(null)
    fetchAppointments()
  }

  const filtered = filter === 'All'
    ? appointments
    : appointments.filter((a) => a.status === filter)

  return (
    <View style={styles.container}>
      {/* Filter Chips */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              label={f === 'All' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase().replace('_', ' ')}
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>No visits found</Text>
          <Text style={styles.emptyDesc}>Your appointments will appear here once booked.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          onRefresh={fetchAppointments}
          refreshing={loading}
          renderItem={({ item }) => {
            const hasReview = myReviews[item.id]
            return (
              <Card style={styles.apptCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.docInfo}>
                    <View style={styles.docAvatar}>
                      <Ionicons name="person" size={18} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.docName}>{item.doctor_name || 'Clinic Doctor'}</Text>
                      {item.doctor_specialization ? (
                        <Text style={styles.docSpec}>{item.doctor_specialization}</Text>
                      ) : null}
                    </View>
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                {/* Date/Time and details */}
                <View style={styles.dateTimeRow}>
                  <View style={styles.dateTimeField}>
                    <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.dateTimeText}>{fmtDate(item.slot_date)}</Text>
                  </View>
                  <View style={styles.dateTimeField}>
                    <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.dateTimeText}>{fmtTime(item.slot_time)}</Text>
                  </View>
                </View>

                {item.reason ? <Text style={styles.reasonText}>{item.reason}</Text> : null}

                {/* Footer and action triggers */}
                <View style={styles.cardFooter}>
                  <SeverityBadge score={item.severity_score} />

                  {item.status === 'SCHEDULED' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <Pressable onPress={() => handleJoinVideo(item)} style={styles.joinBtn}>
                        <Ionicons name="videocam-outline" size={13} color={colors.primary} />
                        <Text style={styles.joinBtnText}>Join video</Text>
                      </Pressable>
                      <Pressable onPress={() => handleCancel(item)} style={styles.cancelBtn}>
                        <Ionicons name="trash-outline" size={13} color={colors.red} />
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {item.status === 'COMPLETED' ? (
                    hasReview ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="star" size={12} color="#fbbf24" />
                        <Text style={styles.ratedText}>Rated {hasReview.rating}/5</Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => setSelectedApptForReview(item)}
                        style={styles.rateBtn}
                      >
                        <Ionicons name="star-outline" size={12} color={colors.amber} />
                        <Text style={styles.rateBtnText}>Rate visit</Text>
                      </Pressable>
                    )
                  ) : null}
                </View>
              </Card>
            )
          }}
        />
      )}

      {/* Review Modal */}
      <ReviewModal
        visible={!!selectedApptForReview}
        appointment={selectedApptForReview}
        onClose={() => setSelectedApptForReview(null)}
        onSubmitted={handleReviewSubmitted}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filterBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontFamily: font.bold, color: colors.textMuted, marginTop: 12 },
  emptyDesc: { fontSize: 13, color: colors.textFaint, textAlign: 'center', marginTop: 4 },
  listContent: { padding: 16, paddingBottom: 32 },
  apptCard: { padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  docInfo: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  docAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  docSpec: { fontSize: 11, fontFamily: font.semibold, color: colors.primary, marginTop: 1 },
  dateTimeRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  dateTimeField: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateTimeText: { fontSize: 12, color: colors.textMuted },
  reasonText: { fontSize: 12, color: colors.textFaint, marginBottom: 12 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
  },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cancelBtnText: { fontSize: 12, color: colors.red, fontFamily: font.bold },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  joinBtnText: { fontSize: 12, color: colors.primary, fontFamily: font.bold },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.amberBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rateBtnText: { fontSize: 11, color: colors.amber, fontFamily: font.bold },
  ratedText: { fontSize: 11, color: colors.amber, fontFamily: font.bold },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 16, fontFamily: font.extrabold, color: colors.text },
  modalSubtitle: { fontSize: 12, color: colors.primary, fontFamily: font.semibold, marginTop: 2 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    backgroundColor: colors.redBg,
    color: colors.red,
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  pickerLabel: { fontSize: 13, fontFamily: font.bold, color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  starPickerRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  commentInput: { minHeight: 70, textAlignVertical: 'top' },
  ratingInfoText: { fontSize: 10, color: colors.textFaint, textAlign: 'center', marginTop: 10 },
})
