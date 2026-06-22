import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { changeDoctorPassword } from '../api/client'
import { Button, Card, Field, inputStyle } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { font, colors } from '../theme'
import { Ionicons } from '@expo/vector-icons'

export default function DoctorSettingsScreen() {
  const { user, logout } = useAuth()
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', type: 'success' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handlePasswordChange = async () => {
    const { current_password, new_password, confirm_password } = passwordForm
    if (!current_password || !new_password || !confirm_password) {
      setMessage({ text: 'All password fields are required.', type: 'danger' })
      return
    }
    if (new_password !== confirm_password) {
      setMessage({ text: 'New passwords do not match.', type: 'danger' })
      return
    }
    if (new_password.length < 6) {
      setMessage({ text: 'New password must be at least 6 characters.', type: 'danger' })
      return
    }

    setSaving(true)
    setMessage({ text: '', type: 'success' })
    try {
      await changeDoctorPassword({ current_password, new_password })
      setMessage({ text: 'Password rotated successfully!', type: 'success' })
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      setMessage({
        text: err.response?.data?.detail || 'Could not change password.',
        type: 'danger',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Info card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Ionicons name="medical" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.docName}>{user?.name}</Text>
              <Text style={styles.docSpec}>{user?.specialization}</Text>
              <Text style={styles.docQual}>{user?.qualification}</Text>
            </View>
          </View>
          {user?.hospital_name ? (
            <View style={styles.hospitalRow}>
              <Ionicons name="location-outline" size={14} color={colors.textFaint} />
              <Text style={styles.hospitalText}>{user?.hospital_name}</Text>
            </View>
          ) : null}
        </Card>

        {/* Password change form */}
        <Card style={styles.formCard}>
          <Text style={styles.formSectionTitle}>Change Password</Text>
          {message.text ? (
            <Text
              style={[
                styles.alertText,
                message.type === 'danger' ? styles.alertDanger : styles.alertSuccess,
              ]}
            >
              {message.text}
            </Text>
          ) : null}

          <Field label="Current Password">
            <View style={[inputStyle, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingRight: 12 }]}>
              <TextInput
                style={{ flex: 1, paddingVertical: 11, fontSize: 15, fontFamily: font.medium, color: colors.text }}
                secureTextEntry={!showCurrent}
                value={passwordForm.current_password}
                onChangeText={(val) => setPasswordForm({ ...passwordForm, current_password: val })}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
              />
              <Pressable onPress={() => setShowCurrent(!showCurrent)} hitSlop={8}>
                <Ionicons name={showCurrent ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </Field>

          <Field label="New Password">
            <View style={[inputStyle, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingRight: 12 }]}>
              <TextInput
                style={{ flex: 1, paddingVertical: 11, fontSize: 15, fontFamily: font.medium, color: colors.text }}
                secureTextEntry={!showNew}
                value={passwordForm.new_password}
                onChangeText={(val) => setPasswordForm({ ...passwordForm, new_password: val })}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
              />
              <Pressable onPress={() => setShowNew(!showNew)} hitSlop={8}>
                <Ionicons name={showNew ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </Field>

          <Field label="Confirm New Password">
            <View style={[inputStyle, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingRight: 12 }]}>
              <TextInput
                style={{ flex: 1, paddingVertical: 11, fontSize: 15, fontFamily: font.medium, color: colors.text }}
                secureTextEntry={!showConfirm}
                value={passwordForm.confirm_password}
                onChangeText={(val) => setPasswordForm({ ...passwordForm, confirm_password: val })}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
              />
              <Pressable onPress={() => setShowConfirm(!showConfirm)} hitSlop={8}>
                <Ionicons name={showConfirm ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </Field>

          <Button
            title={saving ? 'Updating…' : 'Rotate Password'}
            onPress={handlePasswordChange}
            loading={saving}
            disabled={saving}
            style={{ marginTop: 8 }}
          />
        </Card>

        <Button
          title="Sign Out"
          onPress={logout}
          variant="secondary"
          style={styles.logoutBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  profileCard: { padding: 16, marginBottom: 16 },
  profileHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: { fontSize: 16, fontFamily: font.extrabold, color: colors.text },
  docSpec: { fontSize: 12, fontFamily: font.bold, color: colors.primary, marginTop: 1 },
  docQual: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  hospitalRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f9fafb' },
  hospitalText: { fontSize: 12, color: colors.textMuted },
  formCard: { padding: 16 },
  formSectionTitle: { fontSize: 12, fontFamily: font.extrabold, color: colors.text, textTransform: 'uppercase', marginBottom: 12 },
  alertText: {
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    fontFamily: font.semibold,
    marginBottom: 12,
    overflow: 'hidden',
  },
  alertSuccess: { backgroundColor: colors.emeraldBg, color: colors.emerald },
  alertDanger: { backgroundColor: colors.redBg, color: colors.red },
  logoutBtn: { marginTop: 16, borderColor: colors.border, borderWidth: 1 },
})
