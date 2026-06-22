import * as Sentry from '@sentry/react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, View, StyleSheet, Text, Image } from 'react-native'
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { ToastHost } from './src/components/ui'
import { font } from './src/theme'
import LoginScreen from './src/screens/LoginScreen'
import RegisterScreen from './src/screens/RegisterScreen'
import DashboardScreen from './src/screens/DashboardScreen'
import ChatScreen from './src/screens/ChatScreen'
import DoctorsScreen from './src/screens/DoctorsScreen'
import VisitsScreen from './src/screens/VisitsScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import RescheduleScreen from './src/screens/RescheduleScreen'
import NearbyScreen from './src/screens/NearbyScreen'

import DoctorDashboardScreen from './src/screens/DoctorDashboardScreen'
import DoctorSlotsScreen from './src/screens/DoctorSlotsScreen'
import DoctorInsightsScreen from './src/screens/DoctorInsightsScreen'
import DoctorSettingsScreen from './src/screens/DoctorSettingsScreen'
import DoctorRescheduleScreen from './src/screens/DoctorRescheduleScreen'

import { colors } from './src/theme'
import { Ionicons } from '@expo/vector-icons'

import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Error monitoring — active only when EXPO_PUBLIC_SENTRY_DSN is set (inlined at
// build time). sendDefaultPii:false keeps patient data out of error reports.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  })
}

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )
}

function HeaderLogoTitle({ title = 'CuraLine' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
      <Image
        source={require('./assets/logo.png')}
        style={{ width: 40, height: 22 }}
        resizeMode="contain"
        accessibilityLabel="CuraLine"
      />
      <Text style={{ fontSize: 16, fontFamily: font.extrabold, color: colors.text }}>{title}</Text>
    </View>
  )
}

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary },
}

// ─────────────────────────────────────────────────────────────────────
// PATIENT NAVIGATION
// ─────────────────────────────────────────────────────────────────────
function PatientTabs() {
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName
          if (route.name === 'Home') iconName = 'home-outline'
          else if (route.name === 'Book') iconName = 'chatbubble-ellipses-outline'
          else if (route.name === 'Doctors') iconName = 'search-outline'
          else if (route.name === 'Visits') iconName = 'calendar-outline'
          else if (route.name === 'Nearby') iconName = 'map-outline'
          else if (route.name === 'Profile') iconName = 'person-outline'

          return <Ionicons name={iconName} size={size - 2} color={color} />
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        animation: 'shift',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 60 + (insets.bottom > 0 ? insets.bottom - 4 : 0),
          paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: '#ffffff',
          shadowColor: 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontFamily: font.extrabold,
          fontSize: 18,
          color: colors.text,
        },
        tabBarLabelStyle: { fontFamily: font.bold, fontSize: 10.5 },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ headerTitle: () => <HeaderLogoTitle title="CuraLine" /> }} />
      <Tab.Screen name="Book" component={ChatScreen} options={{ headerTitle: () => <HeaderLogoTitle title="AI Booking" /> }} />
      <Tab.Screen name="Doctors" component={DoctorsScreen} options={{ headerTitle: () => <HeaderLogoTitle title="Browse Doctors" /> }} />
      <Tab.Screen name="Visits" component={VisitsScreen} options={{ headerTitle: () => <HeaderLogoTitle title="My Visits" /> }} />
      <Tab.Screen name="Nearby" component={NearbyScreen} options={{ headerTitle: () => <HeaderLogoTitle title="Find Care Nearby" /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerTitle: () => <HeaderLogoTitle title="My Profile" /> }} />
    </Tab.Navigator>
  )
}

function PatientNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontFamily: font.extrabold, color: colors.text },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen name="Main" component={PatientTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Reschedule" component={RescheduleScreen} options={{ title: 'Reschedule Request' }} />
    </Stack.Navigator>
  )
}

// ─────────────────────────────────────────────────────────────────────
// DOCTOR NAVIGATION
// ─────────────────────────────────────────────────────────────────────
function DoctorTabs() {
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName
          if (route.name === 'Dashboard') iconName = 'home-outline'
          else if (route.name === 'Slots') iconName = 'time-outline'
          else if (route.name === 'Insights') iconName = 'bar-chart-outline'
          else if (route.name === 'Settings') iconName = 'settings-outline'

          return <Ionicons name={iconName} size={size - 2} color={color} />
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        animation: 'shift',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 60 + (insets.bottom > 0 ? insets.bottom - 4 : 0),
          paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: '#ffffff',
          shadowColor: 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontFamily: font.extrabold,
          fontSize: 18,
          color: colors.text,
        },
        tabBarLabelStyle: { fontFamily: font.bold, fontSize: 10.5 },
      })}
    >
      <Tab.Screen name="Dashboard" component={DoctorDashboardScreen} options={{ headerTitle: () => <HeaderLogoTitle title="Doctor Portal" /> }} />
      <Tab.Screen name="Slots" component={DoctorSlotsScreen} options={{ headerTitle: () => <HeaderLogoTitle title="My Schedule" /> }} />
      <Tab.Screen name="Insights" component={DoctorInsightsScreen} options={{ headerTitle: () => <HeaderLogoTitle title="Insights & Stats" /> }} />
      <Tab.Screen name="Settings" component={DoctorSettingsScreen} options={{ headerTitle: () => <HeaderLogoTitle title="Settings" /> }} />
    </Tab.Navigator>
  )
}

function DoctorNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontFamily: font.extrabold, color: colors.text },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen name="Main" component={DoctorTabs} options={{ headerShown: false }} />
      <Stack.Screen name="DoctorReschedule" component={DoctorRescheduleScreen} options={{ title: 'Severity Swaps' }} />
    </Stack.Navigator>
  )
}

// ─────────────────────────────────────────────────────────────────────
// APP NAVIGATOR DISPATCHER
// ─────────────────────────────────────────────────────────────────────
function AppNavigator() {
  const { user, role, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : role === 'doctor' ? (
          <Stack.Screen name="DoctorPortal" component={DoctorNavigator} />
        ) : (
          <Stack.Screen name="PatientPortal" component={PatientNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  })
  if (!fontsLoaded) return <LoadingScreen />
  return (
    <AuthProvider>
      <AppNavigator />
      <ToastHost />
    </AuthProvider>
  )
}

export default Sentry.wrap(App)

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
})
