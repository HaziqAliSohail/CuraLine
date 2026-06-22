import { useState, useRef, useEffect } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Pressable,
  Linking,
} from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import { Animated } from 'react-native'
import { sendMessage, getConsent, acceptConsent } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Button, Card, PressableScale, SeverityBadge, toast } from '../components/ui'
import { font, colors, radius, shadow } from '../theme'
import * as haptics from '../haptics'
import { Ionicons } from '@expo/vector-icons'

const SUGGESTIONS = [
  'Annual check up',
  'I have a fever and sore throat',
  'Persistent headache for 3 days',
  'Book me with Dr. Jenkins',
]

function AiAvatar() {
  return (
    <View style={styles.aiAvatar}>
      <Ionicons name="sparkles" size={13} color="#fff" />
    </View>
  )
}

function TypingDot({ delay }) {
  const v = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.3, duration: 280, useNativeDriver: true }),
      Animated.delay(420 - delay),
    ]))
    loop.start()
    return () => loop.stop()
  }, [])
  return <Animated.View style={[styles.typingDot, { opacity: v }]} />
}

function TypingIndicator() {
  return (
    <View style={[styles.bubbleContainer, { justifyContent: 'flex-start', alignItems: 'flex-end', gap: 6 }]}>
      <AiAvatar />
      <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
        <TypingDot delay={0} />
        <TypingDot delay={140} />
        <TypingDot delay={280} />
      </View>
    </View>
  )
}

const GUIDANCE_CONFIG = {
  EMERGENCY: {
    bg: '#fef2f2',
    border: '#fca5a5',
    iconColor: '#dc2626',
    titleColor: '#991b1b',
    textColor: '#b91c1c',
    icon: 'alert-circle',
    title: 'Emergency - Call 911 Immediately',
  },
  URGENT_CARE: {
    bg: '#fff7ed',
    border: '#fed7aa',
    iconColor: '#ea580c',
    titleColor: '#9a3412',
    textColor: '#c2410c',
    icon: 'warning',
    title: 'Visit Nearest Urgent Care',
  },
  TELEHEALTH: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    iconColor: '#2563eb',
    titleColor: '#1e40af',
    textColor: '#1d4ed8',
    icon: 'pulse-outline',
    title: 'Schedule a Telehealth Visit',
  },
  FIRST_AID: {
    bg: '#ecfdf5',
    border: '#a7f3d0',
    iconColor: '#059669',
    titleColor: '#065f46',
    textColor: '#047857',
    icon: 'heart',
    title: 'First Aid Recommendation',
  },
}

function UrgentGuidanceBanner({ guidanceType, guidance }) {
  if (!guidanceType || !guidance) return null

  const config = GUIDANCE_CONFIG[guidanceType]
  if (!config) return null

  const { bg, border, iconColor, titleColor, textColor, icon, title } = config
  const [mainGuidance, ...disclaimerParts] = guidance.split('\n\n')
  const disclaimer = disclaimerParts.join('\n\n')

  return (
    <View style={[styles.guidanceBanner, { backgroundColor: bg, borderColor: border }]}>
      <View style={[styles.guidanceIconContainer, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <Ionicons name="shield-checkmark" size={12} color={iconColor} />
          <Text style={[styles.guidanceTitle, { color: titleColor }]}>{title}</Text>
        </View>
        <Text style={[styles.guidanceText, { color: textColor }]}>{mainGuidance}</Text>
        {disclaimer ? (
          <Text style={[styles.guidanceDisclaimer, { color: colors.textFaint }]}>{disclaimer}</Text>
        ) : null}
      </View>
    </View>
  )
}

export default function ChatScreen({ navigation }) {
  const { user } = useAuth()
  // Real header height (varies per device/notch) - a hardcoded offset puts
  // the input under or above the keyboard on different phones.
  const headerHeight = useHeaderHeight()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        `Hello ${user?.name?.split(' ')[0] || 'there'}! I'm CuraLine's AI assistant. ` +
        `Tell me about your symptoms and I'll help book the right appointment for you.\n\n` +
        `For example: "I have severe chest pain radiating to my left arm for the past 2 hours."`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationHistory, setConversationHistory] = useState([])
  const [collectedFields, setCollectedFields] = useState({})
  const [bookingResult, setBookingResult] = useState(null)
  const [stage, setStage] = useState(null)
  const [consent, setConsent] = useState(null)
  const [accepting, setAccepting] = useState(false)

  const scrollViewRef = useRef(null)

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Keep the latest messages visible when the keyboard opens
  useEffect(() => {
    const sub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      scrollToBottom,
    )
    return () => sub.remove()
  }, [])

  // Triage is gated on accepting the current medical disclaimer.
  useEffect(() => {
    getConsent().then((r) => setConsent(r.data)).catch(() => setConsent({ accepted: true }))
  }, [])

  const handleAccept = async () => {
    setAccepting(true)
    try {
      await acceptConsent()
      setConsent((c) => ({ ...c, accepted: true }))
    } catch {
      toast.error('Could not record your consent. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const data = await sendMessage({
        message: text,
        conversation_history: conversationHistory,
        collected_fields: collectedFields,
      })

      const newHistory = [
        ...conversationHistory,
        { role: 'user', content: text },
        { role: 'assistant', content: data.message },
      ]

      setConversationHistory(newHistory)
      setCollectedFields(data.collected_fields || collectedFields)
      setStage(data.stage)

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          severity_score: data.severity_score,
          is_appointment_booked: data.is_appointment_booked,
          appointment_id: data.appointment_id,
          stage: data.stage,
          urgent_guidance: data.urgent_guidance,
          guidance_type: data.guidance_type,
        },
      ])

      if (data.is_appointment_booked) {
        setBookingResult(data)
        haptics.success()
        toast.success('Appointment booked!')
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      // Server enforces the consent gate too — show the gate instead of an error.
      if (err.response?.status === 403 && detail?.code === 'consent_required') {
        try { const r = await getConsent(); setConsent(r.data) }
        catch { setConsent({ accepted: false, title: 'Before we begin', text: '' }) }
        return
      }
      const msg = (typeof detail === 'string' ? detail : null) || err.message || 'Sorry, I encountered an error. Please try again.'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: msg, error: true },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleCall911 = () => {
    Linking.openURL('tel:911')
  }

  // Consent gate — block triage until the disclaimer is accepted.
  if (consent && consent.accepted === false) {
    return (
      <View style={styles.gateContainer}>
        <Card style={styles.gateCard}>
          <View style={styles.gateIcon}>
            <Ionicons name="shield-checkmark" size={26} color={colors.primary} />
          </View>
          <Text style={styles.gateTitle}>{consent.title || 'Before we begin'}</Text>
          <Text style={styles.gateText}>{consent.text}</Text>
          <Button
            title={accepting ? 'One moment…' : 'I understand and agree'}
            onPress={handleAccept}
            loading={accepting}
            disabled={accepting}
            style={{ marginTop: 16, alignSelf: 'stretch' }}
          />
        </Card>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      style={styles.container}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToBottom}
      >
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user'
          return (
            <View key={i} style={{ marginBottom: 12 }}>
              <View style={[styles.bubbleContainer, isUser ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start', alignItems: 'flex-end', gap: 6 }]}>
                {!isUser ? <AiAvatar /> : null}
                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.userBubble : styles.assistantBubble,
                    msg.error ? styles.errorBubble : null,
                  ]}
                >
                  <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.assistantMessageText]}>
                    {msg.content}
                  </Text>

                  {msg.severity_score > 0 ? (
                    <View style={styles.severityContainer}>
                      <SeverityBadge score={msg.severity_score} />
                    </View>
                  ) : null}

                  {msg.is_appointment_booked ? (
                    <Pressable
                      onPress={() => navigation.navigate('Visits')}
                      style={styles.linkButton}
                    >
                      <Ionicons name="calendar" size={14} color={colors.primary} />
                      <Text style={styles.linkButtonText}>View My Appointments →</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {!isUser && msg.urgent_guidance && msg.guidance_type ? (
                <UrgentGuidanceBanner guidanceType={msg.guidance_type} guidance={msg.urgent_guidance} />
              ) : null}
            </View>
          )
        })}

        {loading ? <TypingIndicator /> : null}

        {/* Cold-start suggestion chips */}
        {messages.length === 1 && !loading ? (
          <View style={styles.suggestions}>
            <Text style={styles.suggestionsLabel}>TRY SAYING</Text>
            {SUGGESTIONS.map((s) => (
              <PressableScale key={s} haptic="tap" onPress={() => setInput(s)} style={styles.suggestionChip}>
                <Ionicons name="add" size={13} color={colors.primary} />
                <Text style={styles.suggestionText}>{s}</Text>
              </PressableScale>
            ))}
          </View>
        ) : null}

        {/* Custom Banners based on stage state */}
        {stage === 'emergency' ? (
          <View style={[styles.systemBanner, styles.emergencyBanner]}>
            <View style={styles.bannerIcon}>
              <Ionicons name="alert-circle" size={24} color="#dc2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Emergency Detected - Call 911</Text>
              <Text style={styles.bannerText}>
                Your symptoms indicate a potentially life-threatening event. Call emergency services immediately.
              </Text>
              <Button title="Call 911" onPress={handleCall911} variant="danger" style={{ marginTop: 8 }} />
            </View>
          </View>
        ) : null}

        {stage === 'no_slots' ? (
          <View style={[styles.systemBanner, styles.noSlotsBanner]}>
            <View style={styles.bannerIcon}>
              <Ionicons name="calendar-outline" size={24} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>No Available Slots Found</Text>
              <Text style={styles.bannerText}>
                The AI could not find any free slots. You can browse doctors directly or contact the hospital clinic by phone.
              </Text>
            </View>
          </View>
        ) : null}

        {bookingResult ? (
          <Card style={styles.successCard}>
            <View style={styles.successHeader}>
              <Ionicons name="checkmark-circle" size={26} color={colors.emerald} />
              <View>
                <Text style={styles.successTitle}>Appointment Confirmed!</Text>
                <Text style={styles.successSub}>Your clinic slot is locked in.</Text>
              </View>
            </View>
            <Button
              title="View My Appointments"
              onPress={() => navigation.navigate('Visits')}
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : null}
      </ScrollView>

      {/* Input container */}
      {!bookingResult ? (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Describe your symptoms…"
            value={input}
            onChangeText={setInput}
            multiline
            placeholderTextColor={colors.textFaint}
            editable={!loading}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              (!input.trim() || loading) && { opacity: 0.4 },
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  gateContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 20 },
  gateCard: { padding: 22, alignItems: 'flex-start' },
  gateIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  gateTitle: { fontSize: 18, fontFamily: font.extrabold, color: colors.text },
  gateText: { fontSize: 14, lineHeight: 21, color: colors.textMuted, marginTop: 10 },
  messageList: { flex: 1 },
  bubbleContainer: { flexDirection: 'row', width: '100%' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 2,
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  errorBubble: {
    backgroundColor: colors.redBg,
    borderColor: '#fca5a5',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textFaint },
  aiAvatar: {
    width: 26, height: 26, borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  suggestions: { marginTop: 6, paddingHorizontal: 2 },
  suggestionsLabel: {
    fontSize: 10, fontFamily: font.extrabold, color: colors.textFaint,
    letterSpacing: 1.4, marginBottom: 8,
  },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.primarySoft,
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 9,
    alignSelf: 'flex-start', marginBottom: 8, ...shadow.sm,
  },
  suggestionText: { fontSize: 13, fontFamily: font.semibold, color: colors.primary },
  messageText: { fontSize: 14, lineHeight: 20 },
  userMessageText: { color: '#fff' },
  assistantMessageText: { color: colors.text },
  severityContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkButtonText: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: font.semibold,
  },
  guidanceBanner: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
  },
  guidanceIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceTitle: { fontSize: 13, fontFamily: font.bold },
  guidanceText: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  guidanceDisclaimer: { fontSize: 10, fontStyle: 'italic', marginTop: 4, lineHeight: 14 },
  systemBanner: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 12,
    flexDirection: 'row',
    gap: 12,
  },
  emergencyBanner: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  noSlotsBanner: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bannerTitle: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  bannerText: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  successCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    marginVertical: 12,
    padding: 16,
  },
  successHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  successTitle: { fontSize: 15, fontFamily: font.bold, color: '#065f46' },
  successSub: { fontSize: 12, color: '#047857', marginTop: 1 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#f9fafb',
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
})
