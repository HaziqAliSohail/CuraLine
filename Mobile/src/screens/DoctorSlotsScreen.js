import { useState, useEffect } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  listDoctorSlots,
  createDoctorSlot,
  bulkCreateDoctorSlots,
  closeDoctorSlot,
  deleteDoctorSlot,
} from '../api/client'
import { Button, Card, Chip, Field, inputStyle } from '../components/ui'
import { font, colors, fmtDate, fmtTime, toISODate } from '../theme'
import { Ionicons } from '@expo/vector-icons'

const WEEKDAYS = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
]

export default function DoctorSlotsScreen() {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [acting, setActing] = useState({})
  const [activeFormTab, setActiveFormTab] = useState('bulk') // 'bulk' or 'single'

  // Form states
  const today = new Date()
  const inTwoWeeks = new Date(today.getTime() + 13 * 86400000)
  const [bulkForm, setBulkForm] = useState({
    start_date: toISODate(today),
    end_date: toISODate(inTwoWeeks),
    start_time: '09:00',
    end_time: '17:00',
    duration_minutes: 30,
    weekdays: [1, 2, 3, 4, 5],
  })
  const [singleForm, setSingleForm] = useState({
    date: toISODate(today),
    start_time: '09:00',
    duration_minutes: 30,
  })

  const [formSubmitting, setFormSubmitting] = useState(false)

  const fetchSlots = async () => {
    try {
      const res = await listDoctorSlots()
      setSlots(res.data)
    } catch {
      // silent fail
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchSlots()
  }, [])

  const handleCloseSlot = async (id) => {
    setActing((p) => ({ ...p, [id]: true }))
    try {
      await closeDoctorSlot(id)
      fetchSlots()
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Could not close slot.')
    } finally {
      setActing((p) => ({ ...p, [id]: false }))
    }
  }

  const handleDeleteSlot = async (id) => {
    setActing((p) => ({ ...p, [id]: true }))
    try {
      await deleteDoctorSlot(id)
      fetchSlots()
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Could not delete slot.')
    } finally {
      setActing((p) => ({ ...p, [id]: false }))
    }
  }

  const handleBulkSubmit = async () => {
    if (!bulkForm.weekdays.length) {
      Alert.alert('Error', 'Please select at least one weekday.')
      return
    }
    setFormSubmitting(true)
    try {
      const res = await bulkCreateDoctorSlots({
        ...bulkForm,
        start_time: `${bulkForm.start_time}:00`,
        end_time: `${bulkForm.end_time}:00`,
        duration_minutes: Number(bulkForm.duration_minutes),
      })
      const { created, skipped_existing } = res.data
      Alert.alert(
        'Success',
        `${created} slot${created !== 1 ? 's' : ''} created${
          skipped_existing ? ` (${skipped_existing} skipped as duplicates)` : ''
        }.`
      )
      fetchSlots()
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Could not generate slots.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleSingleSubmit = async () => {
    setFormSubmitting(true)
    try {
      await createDoctorSlot({
        ...singleForm,
        start_time: `${singleForm.start_time}:00`,
        duration_minutes: Number(singleForm.duration_minutes),
      })
      Alert.alert('Success', 'Availability slot created successfully.')
      fetchSlots()
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Could not create slot.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const toggleBulkWeekday = (iso) => {
    setBulkForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(iso) ? f.weekdays.filter((d) => d !== iso) : [...f.weekdays, iso].sort(),
    }))
  }

  // Group slots by date
  const groupedSlots = slots.reduce((acc, s) => {
    ;(acc[s.date] = acc[s.date] || []).push(s)
    return acc
  }, {})

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Form tab selector */}
      <View style={styles.formSelector}>
        <Pressable
          onPress={() => setActiveFormTab('bulk')}
          style={[styles.formTab, activeFormTab === 'bulk' && styles.formTabActive]}
        >
          <Text style={[styles.formTabText, activeFormTab === 'bulk' && styles.formTabTextActive]}>
            Bulk Generate
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveFormTab('single')}
          style={[styles.formTab, activeFormTab === 'single' && styles.formTabActive]}
        >
          <Text style={[styles.formTabText, activeFormTab === 'single' && styles.formTabTextActive]}>
            Single Slot
          </Text>
        </Pressable>
      </View>

      {/* Form details card */}
      <Card style={styles.formCard}>
        {activeFormTab === 'bulk' ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Ionicons name="flash-outline" size={16} color={colors.primary} />
              <Text style={styles.formCardTitle}>Generate Recurring Slots</Text>
            </View>

            <View style={styles.formGrid}>
              <Field label="From Date">
                <TextInput
                  style={[inputStyle, styles.gridInput]}
                  value={bulkForm.start_date}
                  onChangeText={(val) => setBulkForm({ ...bulkForm, start_date: val })}
                  placeholder="YYYY-MM-DD"
                />
              </Field>
              <Field label="To Date">
                <TextInput
                  style={[inputStyle, styles.gridInput]}
                  value={bulkForm.end_date}
                  onChangeText={(val) => setBulkForm({ ...bulkForm, end_date: val })}
                  placeholder="YYYY-MM-DD"
                />
              </Field>
            </View>

            <View style={styles.formGrid}>
              <Field label="Starts (e.g. 09:00)">
                <TextInput
                  style={[inputStyle, styles.gridInput]}
                  value={bulkForm.start_time}
                  onChangeText={(val) => setBulkForm({ ...bulkForm, start_time: val })}
                  placeholder="HH:MM"
                />
              </Field>
              <Field label="Ends (e.g. 17:00)">
                <TextInput
                  style={[inputStyle, styles.gridInput]}
                  value={bulkForm.end_time}
                  onChangeText={(val) => setBulkForm({ ...bulkForm, end_time: val })}
                  placeholder="HH:MM"
                />
              </Field>
            </View>

            <Field label="Days of Week">
              <View style={styles.weekdaysRow}>
                {WEEKDAYS.map((d) => (
                  <Chip
                    key={d.iso}
                    label={d.label}
                    active={bulkForm.weekdays.includes(d.iso)}
                    onPress={() => toggleBulkWeekday(d.iso)}
                  />
                ))}
              </View>
            </Field>

            <Field label="Slot Duration">
              <View style={styles.durationRow}>
                {[15, 30, 45, 60].map((dur) => (
                  <Chip
                    key={dur}
                    label={`${dur} min`}
                    active={bulkForm.duration_minutes === dur}
                    onPress={() => setBulkForm({ ...bulkForm, duration_minutes: dur })}
                  />
                ))}
              </View>
            </Field>

            <Button
              title={formSubmitting ? 'Generating…' : 'Generate Slots'}
              onPress={handleBulkSubmit}
              loading={formSubmitting}
              disabled={formSubmitting}
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.formCardTitle}>Add Single Availability Slot</Text>
            </View>

            <View style={styles.formGrid}>
              <Field label="Slot Date">
                <TextInput
                  style={[inputStyle, styles.gridInput]}
                  value={singleForm.date}
                  onChangeText={(val) => setSingleForm({ ...singleForm, date: val })}
                  placeholder="YYYY-MM-DD"
                />
              </Field>
              <Field label="Start Time">
                <TextInput
                  style={[inputStyle, styles.gridInput]}
                  value={singleForm.start_time}
                  onChangeText={(val) => setSingleForm({ ...singleForm, start_time: val })}
                  placeholder="HH:MM (e.g. 10:30)"
                />
              </Field>
            </View>

            <Field label="Slot Duration">
              <View style={styles.durationRow}>
                {[15, 30, 45, 60].map((dur) => (
                  <Chip
                    key={dur}
                    label={`${dur} min`}
                    active={singleForm.duration_minutes === dur}
                    onPress={() => setSingleForm({ ...singleForm, duration_minutes: dur })}
                  />
                ))}
              </View>
            </Field>

            <Button
              title={formSubmitting ? 'Adding…' : 'Add Slot'}
              onPress={handleSingleSubmit}
              loading={formSubmitting}
              disabled={formSubmitting}
              variant="secondary"
            />
          </View>
        )}
      </Card>

      {/* Grouped list of slots */}
      <Text style={styles.sectionHeader}>UPCOMING SLOTS</Text>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
      ) : slots.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={32} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>No scheduled availability</Text>
          <Text style={styles.emptyDesc}>Generate your calendar above to let patients request visits.</Text>
        </Card>
      ) : (
        <View style={{ gap: 16 }}>
          {Object.entries(groupedSlots).map(([date, daySlots]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateGroupTitle}>{fmtDate(date)}</Text>
              <View style={styles.slotsGrid}>
                {daySlots.map((slot) => {
                  const isAv = slot.is_available
                  const activeAct = acting[slot.id]
                  return (
                    <View
                      key={slot.id}
                      style={[styles.slotBadge, !isAv && styles.slotBadgeBooked]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color={isAv ? colors.primary : colors.textFaint}
                      />
                      <Text style={[styles.slotBadgeText, !isAv && styles.slotBadgeTextBooked]}>
                        {fmtTime(slot.start_time)}
                      </Text>
                      {!isAv ? (
                        <Text style={styles.bookedLabel}>(Booked)</Text>
                      ) : (
                        <View style={styles.slotActions}>
                          <Pressable
                            onPress={() => handleCloseSlot(slot.id)}
                            disabled={!!activeAct}
                            style={styles.actionBtn}
                          >
                            <Ionicons name="lock-closed-outline" size={12} color={colors.amber} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteSlot(slot.id)}
                            disabled={!!activeAct}
                            style={styles.actionBtn}
                          >
                            <Ionicons name="trash-outline" size={12} color={colors.red} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  formSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  formTabActive: { backgroundColor: colors.primary },
  formTabText: { fontSize: 13, fontFamily: font.bold, color: colors.textMuted },
  formTabTextActive: { color: '#fff' },
  formCard: { padding: 18, marginBottom: 20 },
  formCardTitle: { fontSize: 14, fontFamily: font.extrabold, color: colors.text },
  formGrid: { flexDirection: 'row', gap: 12 },
  gridInput: { flex: 1 },
  weekdaysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  durationRow: { flexDirection: 'row', gap: 2 },
  sectionHeader: { fontSize: 10, fontFamily: font.bold, color: colors.textFaint, letterSpacing: 1, marginBottom: 12 },
  dateGroup: { gap: 6 },
  dateGroupTitle: { fontSize: 12, fontFamily: font.bold, color: colors.text },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 8 },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6,
  },
  slotBadgeBooked: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  slotBadgeText: { fontSize: 11, fontFamily: font.bold, color: colors.text },
  slotBadgeTextBooked: { color: colors.textFaint },
  bookedLabel: { fontSize: 9, color: colors.textFaint, fontStyle: 'italic', marginLeft: 2 },
  slotActions: { flexDirection: 'row', gap: 2, marginLeft: 4 },
  actionBtn: { padding: 2 },
  emptyCard: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  emptyTitle: { fontSize: 14, fontFamily: font.bold, color: colors.textMuted },
  emptyDesc: { fontSize: 12, color: colors.textFaint, textAlign: 'center' },
})
