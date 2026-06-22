import { useState } from 'react'
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { login, register } from '../api/client'
import { Button, Chip, Field, inputStyle } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { font, colors, INSURANCE_PLANS } from '../theme'
import { Ionicons } from '@expo/vector-icons'

export default function RegisterScreen({ navigation }) {
  const { loginUser } = useAuth()
  const [form, setForm] = useState({
    name: '', gender: 'MALE', phone: '', email: '', password: '',
    medical_history: '', insurance_plan: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  const handleRegister = async () => {
    setError('')
    setLoading(true)
    try {
      await register(form)
      const res = await login({ email: form.email, password: form.password })
      await loginUser(res.data, 'patient')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Registration failed. Please check your details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Get started with CuraLine</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Field label="Full name">
          <TextInput style={inputStyle} placeholder="John Doe" value={form.name} onChangeText={set('name')} maxLength={50} />
        </Field>

        <Field label="Gender">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {['MALE', 'FEMALE', 'OTHER'].map((g) => (
              <Chip key={g} label={g.charAt(0) + g.slice(1).toLowerCase()} active={form.gender === g} onPress={() => set('gender')(g)} />
            ))}
          </View>
        </Field>

        <Field label="Email">
          <TextInput style={inputStyle} placeholder="you@example.com" autoCapitalize="none"
            keyboardType="email-address" value={form.email} onChangeText={set('email')} />
        </Field>

        <Field label="Phone (optional)">
          <TextInput style={inputStyle} placeholder="+1 555 0100" keyboardType="phone-pad"
            value={form.phone} onChangeText={set('phone')} maxLength={15} />
        </Field>

        <Field label="Password (min. 8 characters)">
          <View style={[inputStyle, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingRight: 12 }]}>
            <TextInput
              style={{ flex: 1, paddingVertical: 11, fontSize: 15, fontFamily: font.medium, color: colors.text }}
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
              secureTextEntry={!showPassword}
              value={form.password}
              onChangeText={set('password')}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        </Field>

        <Field label="Insurance plan (optional)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {INSURANCE_PLANS.map((p) => (
              <Chip key={p} label={p} active={form.insurance_plan === p}
                onPress={() => set('insurance_plan')(form.insurance_plan === p ? '' : p)} />
            ))}
          </View>
        </Field>

        <Field label="Medical history (optional)">
          <TextInput
            style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Allergies, conditions, current medications…"
            multiline value={form.medical_history} onChangeText={set('medical_history')}
          />
        </Field>

        <Button title="Create Account" onPress={handleRegister} loading={loading}
          disabled={!form.name || !form.email || form.password.length < 8} />

        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48, backgroundColor: colors.bg },
  title: { fontSize: 22, fontFamily: font.extrabold, color: colors.text, marginTop: 8 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  error: {
    backgroundColor: colors.redBg, color: colors.red, padding: 12, borderRadius: 10,
    fontSize: 13, marginBottom: 12, overflow: 'hidden',
  },
  link: { textAlign: 'center', marginTop: 18, color: colors.textMuted, fontSize: 13 },
  linkBold: { color: colors.primary, fontFamily: font.bold },
})
