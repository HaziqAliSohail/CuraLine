import { useState, useEffect } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { getMyProfile, updateMyProfile, verifyInsurance } from '../api/client'
import { Button, Chip, Field, Card, inputStyle, Avatar, SectionTitle, toast } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { font, colors, radius, INSURANCE_PLANS } from '../theme'
import { Ionicons } from '@expo/vector-icons'

export default function ProfileScreen() {
  const { logout, user, refreshUser } = useAuth()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    gender: 'MALE',
    insurance_plan: '',
    insurance_member_id: '',
    insurance_group_number: '',
    medical_history: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [coverage, setCoverage] = useState(null)

  useEffect(() => {
    getMyProfile()
      .then((res) => {
        const d = res.data
        setForm({
          name: d.name || '',
          phone: d.phone || '',
          gender: d.gender || 'MALE',
          insurance_plan: d.insurance_plan || '',
          insurance_member_id: d.insurance_member_id || '',
          insurance_group_number: d.insurance_group_number || '',
          medical_history: d.medical_history || '',
        })
      })
      .catch(() => toast.error('Could not load your profile.'))
      .finally(() => setLoading(false))
  }, [])

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateMyProfile(form)
      toast.success('Profile updated.')
      refreshUser?.()  // keep dashboard/header avatar + name in sync
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setCoverage(null)
    try {
      const res = await verifyInsurance()
      setCoverage(res.data)
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not verify coverage right now.')
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Premium Profile Header */}
        <View style={styles.headerContainer}>
          <Avatar name={form.name} size={88} />
          <Text style={styles.headerName}>{form.name || 'CuraLine Patient'}</Text>
          <Text style={styles.headerEmail}>{user?.email || 'patient@curaline.com'}</Text>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={13} color={colors.emerald} />
            <Text style={styles.badgeText}>Verified Patient</Text>
          </View>
        </View>

        {/* Section 1: Personal Information */}
        <SectionTitle>Personal Information</SectionTitle>
        <Card style={styles.sectionCard}>
          <Field label="Full name">
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={colors.textFaint} style={styles.inputIcon} />
              <TextInput
                style={[inputStyle, styles.inputWithIcon]}
                placeholder="e.g. John Doe"
                value={form.name}
                onChangeText={set('name')}
                placeholderTextColor={colors.textFaint}
              />
            </View>
          </Field>

          <Field label="Phone number">
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={18} color={colors.textFaint} style={styles.inputIcon} />
              <TextInput
                style={[inputStyle, styles.inputWithIcon]}
                placeholder="e.g. +1 555 0100"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={set('phone')}
                placeholderTextColor={colors.textFaint}
              />
            </View>
          </Field>

          <Field label="Gender">
            <View style={styles.chipRow}>
              {['MALE', 'FEMALE', 'OTHER'].map((g) => (
                <Chip
                  key={g}
                  label={g.charAt(0) + g.slice(1).toLowerCase()}
                  active={form.gender === g}
                  onPress={() => set('gender')(g)}
                />
              ))}
            </View>
          </Field>
        </Card>

        {/* Section 2: Coverage details */}
        <SectionTitle>Coverage & Insurance</SectionTitle>
        <Card style={styles.sectionCard}>
          <Field label="Insurance Plan">
            <View style={styles.chipRow}>
              {INSURANCE_PLANS.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  active={form.insurance_plan === p}
                  onPress={() => set('insurance_plan')(form.insurance_plan === p ? '' : p)}
                />
              ))}
            </View>
          </Field>

          <Field label="Member ID">
            <TextInput
              style={inputStyle}
              placeholder="e.g. ABC123456789"
              autoCapitalize="characters"
              value={form.insurance_member_id}
              onChangeText={set('insurance_member_id')}
              placeholderTextColor={colors.textFaint}
            />
          </Field>

          <Field label="Group Number">
            <TextInput
              style={inputStyle}
              placeholder="e.g. GRP0001 (optional)"
              autoCapitalize="characters"
              value={form.insurance_group_number}
              onChangeText={set('insurance_group_number')}
              placeholderTextColor={colors.textFaint}
            />
          </Field>

          <Button
            title={verifying ? 'Checking coverage…' : 'Check my coverage'}
            onPress={handleVerify}
            loading={verifying}
            disabled={verifying || !form.insurance_plan}
            variant="secondary"
            style={styles.verifyBtn}
            icon={<Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />}
          />
          <Text style={styles.verifyHint}>Save your details first, then check. Demo result until a clearinghouse is connected.</Text>

          {coverage && (
            <View
              style={[
                styles.coverageBox,
                { backgroundColor: coverage.active ? colors.emeraldBg : colors.amberBg,
                  borderColor: coverage.active ? colors.emerald : colors.amber },
              ]}
            >
              <View style={styles.coverageRow}>
                <Ionicons
                  name={coverage.active ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={coverage.active ? colors.emerald : colors.amber}
                />
                <Text style={styles.coverageStatus}>
                  {coverage.active ? 'Active coverage' : (coverage.status || 'Unverified')}
                  {coverage.sandbox ? ' · demo' : ''}
                </Text>
              </View>
              {coverage.copay_estimate != null && (
                <Text style={styles.coverageDetail}>Estimated copay: ${coverage.copay_estimate}</Text>
              )}
              {!!coverage.message && <Text style={styles.coverageDetail}>{coverage.message}</Text>}
            </View>
          )}
        </Card>

        {/* Section 3: Medical Archives */}
        <SectionTitle>Medical Archives</SectionTitle>
        <Card style={styles.sectionCard}>
          <Field label="Medical History">
            <TextInput
              style={[inputStyle, styles.historyInput]}
              placeholder="List any conditions, allergies, or medications..."
              value={form.medical_history}
              onChangeText={set('medical_history')}
              multiline
              numberOfLines={4}
              placeholderTextColor={colors.textFaint}
            />
          </Field>
        </Card>

        {/* Actions Container */}
        <View style={styles.actionsContainer}>
          <Button
            title={saving ? 'Saving Changes…' : 'Save Changes'}
            onPress={handleSave}
            loading={saving}
            disabled={saving || !form.name}
            icon={<Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />}
          />

          <Button
            title="Sign Out"
            onPress={logout}
            variant="secondary"
            style={styles.logoutBtn}
            icon={<Ionicons name="log-out-outline" size={18} color={colors.textMuted} />}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  headerContainer: {
    alignItems: 'center',
    marginVertical: 16,
    paddingVertical: 8,
  },
  headerName: {
    fontSize: 22,
    fontFamily: font.bold,
    color: colors.text,
    textAlign: 'center',
    marginTop: 12,
  },
  headerEmail: {
    fontSize: 14,
    fontFamily: font.medium,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.emeraldBg,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    marginTop: 8,
  },
  badgeText: {
    fontSize: 11.5,
    fontFamily: font.semibold,
    color: colors.emerald,
  },
  sectionCard: {
    padding: 16,
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  inputWithIcon: {
    paddingLeft: 42,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  historyInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  verifyBtn: {
    borderColor: colors.border,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
    marginTop: 4,
  },
  verifyHint: {
    fontSize: 11.5,
    fontFamily: font.medium,
    color: colors.textFaint,
    marginTop: 6,
  },
  coverageBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  coverageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coverageStatus: {
    fontSize: 13.5,
    fontFamily: font.bold,
    color: colors.text,
  },
  coverageDetail: {
    fontSize: 12.5,
    fontFamily: font.medium,
    color: colors.textMuted,
    marginTop: 4,
  },
  actionsContainer: {
    marginTop: 24,
    gap: 12,
  },
  logoutBtn: {
    borderColor: colors.border,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
  },
})
