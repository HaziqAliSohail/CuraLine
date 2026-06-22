import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { createAppointment, getDoctorReviews, listDoctors, listSlots } from '../api/client'
import { Button, Card, Chip, Field, inputStyle } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { font, colors, INSURANCE_PLANS, fmtDate, fmtTime } from '../theme'
import { Ionicons } from '@expo/vector-icons'

function StarRating({ rating, size = 12 }) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Ionicons
        key={i}
        name={i <= rating ? 'star' : 'star-outline'}
        size={size}
        color={i <= rating ? '#fbbf24' : '#e5e7eb'}
        style={{ marginRight: 1 }}
      />
    )
  }
  return <View style={styles.ratingRow}>{stars}</View>
}

// ─────────────────────────────────────────────────────────────────────
// SLOT PICKER MODAL
// ─────────────────────────────────────────────────────────────────────
function SlotPickerModal({ visible, doctor, onClose, onBooked }) {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!doctor || !visible) return
    setLoading(true)
    setError('')
    listSlots({ doctor_id: doctor.id, available_only: true })
      .then((res) => setSlots(res.data))
      .catch(() => setError('Could not load available slots.'))
      .finally(() => setLoading(false))
  }, [doctor, visible])

  const handleBook = async (slotId) => {
    setBooking(true)
    setError('')
    try {
      await createAppointment({ slot_id: slotId, reason: 'Booked via doctor browser' })
      onBooked()
    } catch (err) {
      setError(err.response?.data?.detail || 'Booking failed. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  if (!doctor) return null

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{doctor.name}</Text>
              <Text style={styles.modalSubtitle}>{doctor.specialization}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Body */}
          <View style={{ flex: 1, padding: 20 }}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : slots.length === 0 ? (
              <View style={styles.emptyModalState}>
                <Ionicons name="calendar-outline" size={40} color={colors.textFaint} />
                <Text style={styles.emptyModalTitle}>No open slots</Text>
                <Text style={styles.emptyModalDesc}>
                  Try using the AI Assistant to book a priority or rescheduled slot.
                </Text>
              </View>
            ) : (
              <FlatList
                data={slots}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleBook(item.id)}
                    disabled={booking}
                    style={styles.slotRow}
                  >
                    <View style={styles.slotDetails}>
                      <Text style={styles.slotDate}>{fmtDate(item.date)}</Text>
                      <Text style={styles.slotTime}>
                        {fmtTime(item.start_time)} · {item.duration_minutes} min
                      </Text>
                    </View>
                    {booking ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={styles.bookLabel}>Book →</Text>
                    )}
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────
// REVIEWS MODAL
// ─────────────────────────────────────────────────────────────────────
function ReviewsModal({ visible, doctor, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!doctor || !visible) return
    setLoading(true)
    getDoctorReviews(doctor.id)
      .then((res) => setData(res.data))
      .catch(() => setData({ average_rating: 0, review_count: 0, reviews: [] }))
      .finally(() => setLoading(false))
  }, [doctor, visible])

  if (!doctor) return null

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Reviews</Text>
              <Text style={styles.modalSubtitle}>{doctor.name}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Body */}
          <View style={{ flex: 1, padding: 20 }}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : data.review_count === 0 ? (
              <View style={styles.emptyModalState}>
                <Ionicons name="chatbubble-outline" size={40} color={colors.textFaint} />
                <Text style={styles.emptyModalTitle}>No reviews yet</Text>
                <Text style={styles.emptyModalDesc}>
                  Only patients with completed visits can rate and review this provider.
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={styles.overallRatingContainer}>
                  <Text style={styles.overallRatingVal}>{data.average_rating.toFixed(1)}</Text>
                  <View>
                    <StarRating rating={Math.round(data.average_rating)} size={16} />
                    <Text style={styles.overallRatingCount}>
                      {data.review_count} verified review{data.review_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <FlatList
                  data={data.reviews}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <View style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.reviewAuthor}>{item.patient_display_name}</Text>
                          <View style={styles.verifiedTag}>
                            <Ionicons name="shield-checkmark" size={10} color="#047857" />
                            <Text style={styles.verifiedTagText}>Verified</Text>
                          </View>
                        </View>
                        <StarRating rating={item.rating} />
                      </View>
                      {item.comment ? <Text style={styles.reviewComment}>{item.comment}</Text> : null}
                    </View>
                  )}
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────
// MAIN DOCTORS SCREEN
// ─────────────────────────────────────────────────────────────────────
export default function DoctorsScreen() {
  const { user } = useAuth()
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [insuranceFilter, setInsuranceFilter] = useState('')

  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState(null)
  const [selectedDoctorForReviews, setSelectedDoctorForReviews] = useState(null)

  // Default filter to patient's own plan
  useEffect(() => {
    if (user?.insurance_plan && !insuranceFilter) {
      setInsuranceFilter(user.insurance_plan)
    }
  }, [user])

  const loadDoctors = () => {
    setLoading(true)
    const params = {}
    if (insuranceFilter) params.insurance = insuranceFilter
    listDoctors(params)
      .then((res) => setDoctors(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDoctors()
  }, [insuranceFilter])

  const filtered = doctors.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.specialization.toLowerCase().includes(search.toLowerCase())
  )

  const handleBookingConfirmed = () => {
    setSelectedDoctorForBooking(null)
    loadDoctors() // Reload to update slot availability
  }

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filterContainer}>
        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or specialization…"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.textFaint}
          />
        </View>

        {/* Insurance Scroll Filter */}
        <Text style={styles.filterTitle}>FILTER BY INSURANCE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.insuranceScroll}>
          <Chip
            label="All Insurance"
            active={insuranceFilter === ''}
            onPress={() => setInsuranceFilter('')}
          />
          {INSURANCE_PLANS.map((plan) => (
            <Chip
              key={plan}
              label={plan}
              active={insuranceFilter === plan}
              onPress={() => setInsuranceFilter(plan)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Grid List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>No doctors found</Text>
          <Text style={styles.emptyDesc}>Try a different search or clear your insurance filter.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isAvail = item.availability_status === 'AVAILABLE'
            return (
              <Card style={styles.doctorCard}>
                <View style={styles.doctorHeader}>
                  {/* Status Badge */}
                  <View
                    style={[
                      styles.statusBadge,
                      isAvail
                        ? styles.statusAvail
                        : item.availability_status === 'LEAVE'
                        ? styles.statusLeave
                        : styles.statusOff,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isAvail
                          ? { color: colors.emerald }
                          : item.availability_status === 'LEAVE'
                          ? { color: colors.amber }
                          : { color: colors.textMuted },
                      ]}
                    >
                      {item.availability_status}
                    </Text>
                  </View>

                  {/* Rating trigger */}
                  <Pressable
                    onPress={() => setSelectedDoctorForReviews(item)}
                    style={styles.ratingTrigger}
                  >
                    <StarRating rating={item.rating} />
                    <Text style={styles.reviewsLabel}>Reviews →</Text>
                  </Pressable>
                </View>

                {/* Main Info */}
                <View style={styles.doctorMain}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name.replace('Dr. ', '').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName}>{item.name}</Text>
                    <Text style={styles.docSpec}>{item.specialization}</Text>
                    <Text style={styles.docQual}>{item.qualification}</Text>
                    {item.hospital_name ? (
                      <Text style={styles.docHospital}>📍 {item.hospital_name}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Fee and insurance tags */}
                <View style={styles.docDetailsRow}>
                  <Text style={styles.feeText}>
                    Consultation Fee: <Text style={{ fontFamily: font.bold, color: colors.text }}>${parseFloat(item.consultation_fee).toFixed(0)}</Text>
                  </Text>
                  {item.accepted_insurance_plans?.length > 0 ? (
                    <View style={styles.planTags}>
                      {item.accepted_insurance_plans.slice(0, 2).map((plan) => (
                        <View key={plan} style={styles.planTag}>
                          <Text style={styles.planTagText}>{plan}</Text>
                        </View>
                      ))}
                      {item.accepted_insurance_plans.length > 2 ? (
                        <View style={[styles.planTag, { backgroundColor: '#f3f4f6' }]}>
                          <Text style={[styles.planTagText, { color: colors.textMuted }]}>
                            +{item.accepted_insurance_plans.length - 2}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {/* Actions */}
                <Button
                  title={isAvail ? 'View Slots' : 'Unavailable'}
                  onPress={() => setSelectedDoctorForBooking(item)}
                  disabled={!isAvail}
                  variant={isAvail ? 'primary' : 'secondary'}
                  style={{ marginTop: 12 }}
                />
              </Card>
            )
          }}
        />
      )}

      {/* Modals */}
      <SlotPickerModal
        visible={!!selectedDoctorForBooking}
        doctor={selectedDoctorForBooking}
        onClose={() => setSelectedDoctorForBooking(null)}
        onBooked={handleBookingConfirmed}
      />

      <ReviewsModal
        visible={!!selectedDoctorForReviews}
        doctor={selectedDoctorForReviews}
        onClose={() => setSelectedDoctorForReviews(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filterContainer: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40, fontSize: 14, color: colors.text },
  filterTitle: { fontSize: 10, fontFamily: font.bold, color: colors.textFaint, letterSpacing: 1, marginBottom: 8 },
  insuranceScroll: { flexDirection: 'row' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontFamily: font.bold, color: colors.textMuted, marginTop: 12 },
  emptyDesc: { fontSize: 13, color: colors.textFaint, textAlign: 'center', marginTop: 4 },
  listContent: { padding: 16, paddingBottom: 32 },
  doctorCard: { padding: 16, marginBottom: 14 },
  doctorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusAvail: { backgroundColor: colors.emeraldBg },
  statusLeave: { backgroundColor: colors.amberBg },
  statusOff: { backgroundColor: '#f3f4f6' },
  statusText: { fontSize: 10, fontFamily: font.bold },
  ratingTrigger: { alignItems: 'flex-end', gap: 2 },
  ratingRow: { flexDirection: 'row' },
  reviewsLabel: { fontSize: 10, color: colors.primary, fontFamily: font.semibold },
  doctorMain: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontFamily: font.extrabold, color: colors.primary },
  docName: { fontSize: 15, fontFamily: font.extrabold, color: colors.text },
  docSpec: { fontSize: 12, fontFamily: font.semibold, color: colors.primary, marginTop: 1 },
  docQual: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  docHospital: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  docDetailsRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeText: { fontSize: 12, color: colors.textMuted },
  planTags: { flexDirection: 'row', gap: 4 },
  planTag: { backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  planTagText: { fontSize: 9, fontFamily: font.semibold, color: '#1d4ed8' },

  // Modals styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
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
  emptyModalState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyModalTitle: { fontSize: 15, fontFamily: font.bold, color: colors.textMuted, marginTop: 12 },
  emptyModalDesc: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  errorText: {
    backgroundColor: colors.redBg,
    color: colors.red,
    padding: 12,
    borderRadius: 10,
    fontSize: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  slotDetails: { gap: 2 },
  slotDate: { fontSize: 13, fontFamily: font.bold, color: colors.text },
  slotTime: { fontSize: 11, color: colors.textMuted },
  bookLabel: { fontSize: 12, fontFamily: font.bold, color: colors.primary },

  overallRatingContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  overallRatingVal: { fontSize: 32, fontFamily: font.extrabold, color: colors.text },
  overallRatingCount: { fontSize: 11, color: colors.textFaint, marginTop: 2 },

  reviewCard: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 12, marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewAuthor: { fontSize: 12, fontFamily: font.bold, color: colors.text },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.emeraldBg,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  verifiedTagText: { fontSize: 9, fontFamily: font.semibold, color: '#047857' },
  reviewComment: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
})
