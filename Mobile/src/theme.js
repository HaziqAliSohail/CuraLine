// ─────────────────────────────────────────────────────────────────────
// CuraLine design tokens - the single source of visual truth.
// Premium = typography + space + depth + motion, applied consistently.
// ─────────────────────────────────────────────────────────────────────

// Plus Jakarta Sans (matches the web app). Each weight is its own family
// name with expo-google-fonts static fonts.
export const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
}

export const colors = {
  primary: '#4f46e5',
  primaryDark: '#3730a3',
  primaryLight: '#eef2ff',
  primarySoft: '#e0e7ff',
  // Gradient stops for hero surfaces
  gradientStart: '#4f46e5',
  gradientEnd: '#7c3aed',

  bg: '#f7f7fb',          // indigo-tinted near-white, not flat gray
  card: '#ffffff',
  text: '#0f1222',         // near-black with a hint of indigo
  textMuted: '#5b5f6e',
  textFaint: '#9b9fae',
  border: '#e8e9f1',
  borderSoft: '#f1f2f8',

  red: '#dc2626',
  redBg: '#fef2f2',
  amber: '#d97706',
  amberBg: '#fffbeb',
  emerald: '#059669',
  emeraldBg: '#ecfdf5',
  violet: '#7c3aed',
  violetBg: '#f5f3ff',

  severity: {
    1: '#10b981',
    2: '#84cc16',
    3: '#f59e0b',
    4: '#f97316',
    5: '#ef4444',
  },
}

// 4/8pt spacing grid
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 }

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, full: 999 }

// Layered soft shadows (iOS) + elevation (Android)
export const shadow = {
  sm: {
    shadowColor: '#181a2c',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#181a2c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#312e81',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 7,
  },
}

// Type scale - use with the font map, never raw fontWeight
export const type = {
  display: { fontSize: 27, fontFamily: font.extrabold, color: colors.text, letterSpacing: -0.5 },
  title: { fontSize: 19, fontFamily: font.extrabold, color: colors.text, letterSpacing: -0.3 },
  heading: { fontSize: 15, fontFamily: font.bold, color: colors.text },
  body: { fontSize: 14, fontFamily: font.medium, color: colors.text, lineHeight: 21 },
  caption: { fontSize: 12, fontFamily: font.semibold, color: colors.textMuted },
  micro: { fontSize: 10.5, fontFamily: font.bold, color: colors.textFaint, letterSpacing: 1, textTransform: 'uppercase' },
}

export const SEVERITY_LABELS = { 1: 'Routine', 2: 'Low', 3: 'Moderate', 4: 'High', 5: 'Critical' }

export const INSURANCE_PLANS = [
  'Blue Cross Blue Shield',
  'Aetna',
  'Cigna',
  'UnitedHealthcare',
  'Humana',
  'Medicare',
  'Medicaid',
  'Self-Pay / Uninsured',
]

// Deterministic avatar hue per name - same person, same color, every time
const AVATAR_PALETTE = ['#4f46e5', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#2563eb']
export function avatarColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

export function initialsOf(name = '') {
  const parts = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/)
  if (!parts[0]) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function fmtDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export function fmtTime(t) {
  if (!t) return '-'
  return new Date(`1970-01-01T${t}`).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })
}

export function toISODate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
