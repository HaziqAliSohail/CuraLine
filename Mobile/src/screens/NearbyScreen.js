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
  Linking,
} from 'react-native'
import * as Location from 'expo-location'
import {
  createAppointment,
  getDoctorReviews,
  listDoctors,
  listSlots,
  listNearbyHospitals,
} from '../api/client'
import { Button, Card, Chip, PressableScale, FadeInView, Avatar } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { font, colors, fmtDate, fmtTime } from '../theme'
import { Ionicons } from '@expo/vector-icons'

// ─────────────────────────────────────────────────────────────────────
// RATING STAR HELPER
// ─────────────────────────────────────────────────────────────────────
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
      await createAppointment({ slot_id: slotId, reason: 'Booked via nearby discovery' })
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
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────
export default function NearbyScreen() {
  const [userLocation, setUserLocation] = useState(null)
  const [isGps, setIsGps] = useState(false)
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [maxDistance, setMaxDistance] = useState(25) // Miles filter
  const [expandedHospital, setExpandedHospital] = useState(null)
  const [doctorsMap, setDoctorsMap] = useState({}) // Cache hospital_id -> doctors
  const [loadingDoctors, setLoadingDoctors] = useState(false)

  // Booking & review targets
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState(null)
  const [selectedDoctorForReviews, setSelectedDoctorForReviews] = useState(null)

  // 1. Fetch user location or fallback
  useEffect(() => {
    ;(async () => {
      let { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        // Fallback to New York
        setUserLocation({ latitude: 40.7580, longitude: -73.9855 })
        setIsGps(false)
        return
      }

      try {
        let loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        })
        setIsGps(true)
      } catch (e) {
        // Fallback to New York on GPS timeout/error
        setUserLocation({ latitude: 40.7580, longitude: -73.9855 })
        setIsGps(false)
      }
    })()
  }, [])

  // 2. Fetch nearby hospitals once location coordinates are available
  const loadNearby = () => {
    if (!userLocation) return
    setLoading(true)
    listNearbyHospitals({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    })
      .then((res) => {
        setHospitals(res.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadNearby()
  }, [userLocation])

  // 3. Load doctors when a hospital card is expanded
  const toggleExpand = (hospitalId) => {
    if (expandedHospital === hospitalId) {
      setExpandedHospital(null)
      return
    }

    setExpandedHospital(hospitalId)
    if (!doctorsMap[hospitalId]) {
      setLoadingDoctors(true)
      listDoctors({ hospital_id: hospitalId })
        .then((res) => {
          setDoctorsMap((prev) => ({ ...prev, [hospitalId]: res.data }))
        })
        .catch(() => {})
        .finally(() => setLoadingDoctors(false))
    }
  }

  const handleCall = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`)
  }

  const handleBookingConfirmed = () => {
    setSelectedDoctorForBooking(null)
    loadNearby() // Refresh data
  }

  // Filter list by text query and radius
  const filteredHospitals = hospitals.filter((h) => {
    const matchesSearch =
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.address && h.address.toLowerCase().includes(searchQuery.toLowerCase()))
    const withinDistance = h.distance === null || h.distance <= maxDistance
    return matchesSearch && withinDistance
  })

  return (
    <View style={styles.container}>
      {/* Geolocation status header card */}
      <View style={styles.headerBar}>
        <View style={styles.locationContainer}>
          <Ionicons
            name={isGps ? 'location' : 'location-outline'}
            size={18}
            color={colors.primary}
          />
          <View>
            <Text style={styles.locationTitle}>
              {isGps ? 'Current GPS Location' : 'Simulated Center: New York, NY'}
            </Text>
            {userLocation && (
              <Text style={styles.locationSubtitle}>
                {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
              </Text>
            )}
          </View>
        </View>
        <PressableScale onPress={loadNearby} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={16} color={colors.primary} />
        </PressableScale>
      </View>

      {/* Filter controls */}
      <View style={styles.filterSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search hospitals or clinics…"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textFaint}
          />
        </View>

        <Text style={styles.radiusTitle}>MAXIMUM DISTANCE</Text>
        <View style={styles.chipRow}>
          {[1, 5, 10, 25].map((dist) => (
            <Chip
              key={dist}
              label={`${dist} Mile${dist > 1 ? 's' : ''}`}
              active={maxDistance === dist}
              onPress={() => setMaxDistance(dist)}
            />
          ))}
        </View>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Locating nearby medical facilities...</Text>
        </View>
      ) : filteredHospitals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="map-outline" size={48} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>No facilities found</Text>
          <Text style={styles.emptyDesc}>
            Try widening your distance limit or using a different search query.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredHospitals}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isExpanded = expandedHospital === item.id
            const doctors = doctorsMap[item.id] || []

            return (
              <FadeInView>
                <Card style={[styles.hospitalCard, isExpanded && styles.expandedCard]}>
                  {/* Clinic Header summary */}
                  <Pressable onPress={() => toggleExpand(item.id)} style={styles.hospitalPressable}>
                    <View style={styles.hospitalMainInfo}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.hospitalName}>{item.name}</Text>
                        <Text style={styles.hospitalAddress}>
                          {item.address || 'Address not listed'}
                        </Text>
                      </View>
                      <View style={styles.distanceBadge}>
                        <Ionicons name="navigate-outline" size={10} color={colors.primary} />
                        <Text style={styles.distanceText}>
                          {item.distance !== null ? `${item.distance} mi` : 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {/* Meta info & actions */}
                    <View style={styles.metaRow}>
                      <View style={styles.doctorCountBadge}>
                        <Ionicons name="people" size={12} color="#047857" style={{ marginRight: 4 }} />
                        <Text style={styles.doctorCountText}>
                          {item.doctor_count} provider{item.doctor_count !== 1 ? 's' : ''}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {item.phone && (
                          <PressableScale
                            onPress={() => handleCall(item.phone)}
                            style={styles.callIconBtn}
                          >
                            <Ionicons name="call" size={14} color={colors.primary} />
                          </PressableScale>
                        )}
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={colors.textMuted}
                        />
                      </View>
                    </View>
                  </Pressable>

                  {/* Expanded doctors list */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      <View style={styles.divider} />
                      <Text style={styles.sectionTitle}>APPROVED PROVIDERS</Text>

                      {loadingDoctors ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                          style={{ marginVertical: 20 }}
                        />
                      ) : doctors.length === 0 ? (
                        <Text style={styles.noDoctorsText}>
                          No approved doctors currently assigned here.
                        </Text>
                      ) : (
                        doctors.map((doc) => {
                          const isAvail = doc.availability_status === 'AVAILABLE'
                          return (
                            <View key={doc.id} style={styles.doctorItem}>
                              <View style={styles.doctorMainRow}>
                                <Avatar name={doc.name} size={38} />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                  <View style={styles.doctorTitleRow}>
                                    <Text style={styles.doctorNameText}>{doc.name}</Text>
                                    <View
                                      style={[
                                        styles.statusDot,
                                        { backgroundColor: isAvail ? colors.emerald : colors.textFaint }
                                      ]}
                                    />
                                  </View>
                                  <Text style={styles.doctorSpecText}>{doc.specialization}</Text>
                                  <Pressable
                                    onPress={() => setSelectedDoctorForReviews(doc)}
                                    style={styles.doctorRatingRow}
                                  >
                                    <StarRating rating={doc.rating} />
                                    <Text style={styles.reviewsLabel}>Reviews →</Text>
                                  </Pressable>
                                </View>
                              </View>

                              {/* Doctor details & booking */}
                              <View style={styles.doctorActionRow}>
                                <Text style={styles.doctorFee}>
                                  Fee: <Text style={{ fontFamily: font.bold }}>${parseFloat(doc.consultation_fee).toFixed(0)}</Text>
                                </Text>
                                <Button
                                  title={isAvail ? 'Book Slots' : 'Offline'}
                                  disabled={!isAvail}
                                  onPress={() => setSelectedDoctorForBooking(doc)}
                                  variant={isAvail ? 'primary' : 'secondary'}
                                  style={styles.bookButton}
                                />
                              </View>
                            </View>
                          )
                        })
                      )}
                    </View>
                  )}
                </Card>
              </FadeInView>
            )
          }}
        />
      )}

      {/* Booking Slot Picker Modal */}
      <SlotPickerModal
        visible={!!selectedDoctorForBooking}
        doctor={selectedDoctorForBooking}
        onClose={() => setSelectedDoctorForBooking(null)}
        onBooked={handleBookingConfirmed}
      />

      {/* Doctor Reviews Modal */}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  locationContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationTitle: { fontSize: 13, fontFamily: font.extrabold, color: colors.text },
  locationSubtitle: { fontSize: 11, fontFamily: font.semibold, color: colors.textMuted },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
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
  radiusTitle: { fontSize: 10, fontFamily: font.bold, color: colors.textFaint, letterSpacing: 1, marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 6 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { fontSize: 13, color: colors.textMuted, marginTop: 12, fontFamily: font.semibold },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontFamily: font.bold, color: colors.textMuted, marginTop: 12 },
  emptyDesc: { fontSize: 13, color: colors.textFaint, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  listContent: { padding: 16, paddingBottom: 32 },
  hospitalCard: { padding: 0, marginBottom: 14, overflow: 'hidden' },
  expandedCard: { borderColor: colors.primary },
  hospitalPressable: { padding: 16 },
  hospitalMainInfo: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  hospitalName: { fontSize: 15, fontFamily: font.extrabold, color: colors.text },
  hospitalAddress: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  distanceText: { fontSize: 10, fontFamily: font.bold, color: colors.primary },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  doctorCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  doctorCountText: { fontSize: 10, fontFamily: font.bold, color: '#047857' },
  callIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: { paddingHorizontal: 16, paddingBottom: 16 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  sectionTitle: { fontSize: 10, fontFamily: font.bold, color: colors.textFaint, letterSpacing: 1, marginBottom: 12 },
  noDoctorsText: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginVertical: 10 },
  doctorItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  doctorMainRow: { flexDirection: 'row', alignItems: 'center' },
  doctorTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  doctorNameText: { fontSize: 13, fontFamily: font.extrabold, color: colors.text },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 2 },
  doctorSpecText: { fontSize: 11, fontFamily: font.bold, color: colors.primary, marginTop: 1 },
  doctorRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  reviewsLabel: { fontSize: 9, color: colors.primary, fontFamily: font.semibold },
  doctorActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  doctorFee: { fontSize: 11, color: colors.textMuted },
  bookButton: { minWidth: 90, height: 28, paddingVertical: 0, borderRadius: 8 },

  // Modals shared styles
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
  ratingRow: { flexDirection: 'row' },
})
