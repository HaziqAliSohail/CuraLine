import { useState } from 'react'
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { doctorLogin, login } from '../api/client'
import { Button, FadeInView, inputStyle } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { font, colors } from '../theme'
import { Ionicons } from '@expo/vector-icons'

export default function LoginScreen({ navigation }) {
  const { loginUser } = useAuth()
  const [mode, setMode] = useState('patient')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const res = mode === 'doctor'
        ? await doctorLogin({ email, password })
        : await login({ email, password })
      await loginUser(res.data, mode)
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your connection and the API URL in src/config.js.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <FadeInView>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="CuraLine"
        />
        <Text style={styles.title}>Welcome to CuraLine</Text>
        <Text style={styles.subtitle}>
          {mode === 'doctor' ? 'Doctor portal - sign in to view your day' : 'Sign in to manage your appointments'}
        </Text>

        <View style={styles.toggle}>
          {['patient', 'doctor'].map((m) => (
            <Pressable
              key={m}
              onPress={() => { setMode(m); setError('') }}
              style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
            >
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {m === 'patient' ? "I'm a Patient" : "I'm a Doctor"}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={[inputStyle, styles.input]}
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <View style={[inputStyle, styles.input, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingRight: 12 }]}>
          <TextInput
            style={{ flex: 1, paddingVertical: 11, fontSize: 15, fontFamily: font.medium, color: colors.text }}
            placeholder="Password"
            placeholderTextColor={colors.textFaint}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
            <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <Button
          title={mode === 'doctor' ? 'Sign In to Portal' : 'Sign In'}
          onPress={handleLogin}
          loading={loading}
          disabled={!email || !password}
          style={{ marginTop: 6 }}
        />

        {mode === 'patient' ? (
          <Pressable onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>
              Don't have an account? <Text style={styles.linkBold}>Register</Text>
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.note}>
            Doctor accounts are provisioned by hospital administration or via the web application portal.
          </Text>
        )}
        </FadeInView>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  logo: {
    width: 132, height: 72, alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontFamily: font.extrabold, color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  toggle: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12,
    padding: 4, marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: 13, fontFamily: font.bold, color: colors.textMuted },
  toggleTextActive: { color: '#fff' },
  input: { marginBottom: 12 },
  error: {
    backgroundColor: colors.redBg, color: colors.red, padding: 12, borderRadius: 10,
    fontSize: 13, marginBottom: 12, overflow: 'hidden',
  },
  link: { textAlign: 'center', marginTop: 18, color: colors.textMuted, fontSize: 13 },
  linkBold: { color: colors.primary, fontFamily: font.bold },
  note: { textAlign: 'center', marginTop: 18, color: colors.textFaint, fontSize: 12, lineHeight: 18 },
})
