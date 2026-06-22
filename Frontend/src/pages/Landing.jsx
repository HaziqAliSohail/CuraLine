import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiActivity, FiArrowRight, FiCalendar, FiCheckCircle, FiClock, FiCpu,
  FiHeart, FiMessageSquare, FiShield, FiStar, FiTrendingUp, FiUsers, FiZap,
} from 'react-icons/fi'
import Reveal from '../components/landing/Reveal'
import CountUp from '../components/landing/CountUp'

/* ── Brand mark ─────────────────────────────────────────────────────── */
function Logo() {
  return (
    <div className="flex items-center">
      {/* h-16 fills the 64px navbar; w-auto keeps the logo's real aspect ratio
          (no square letterboxing). Navbar height is unchanged. */}
      <img src="/logo.png" alt="CuraLine Logo" className="h-16 w-auto object-contain object-left" />
    </div>
  )
}

/* ── Sticky navigation ──────────────────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm' : 'bg-transparent'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Logo />
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#how" className="hover:text-gray-900 transition-colors">How it works</a>
          <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
          <a href="#doctors" className="hover:text-gray-900 transition-colors">For doctors</a>
          <a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/login" className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-4 py-2 transition-colors">
            Sign in
          </Link>
          <Link
            to="/register"
            className="text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  )
}

/* ── Animated severity-triage demo card ─────────────────────────────── */
function TriageDemo() {
  return (
    <div className="relative">
      {/* glow */}
      <div className="absolute -inset-6 bg-gradient-to-tr from-primary-500/20 via-violet-500/20 to-transparent blur-3xl rounded-full animate-glow-pulse" />

      <div className="relative card-glass !p-5 w-full max-w-sm mx-auto shadow-2xl shadow-primary-900/10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center">
            <FiCpu className="text-white" size={14} />
          </div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">CuraLine AI</span>
        </div>

        {/* patient message */}
        <div className="flex justify-end mb-3">
          <div className="bg-gradient-to-br from-primary-600 to-primary-500 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%] shadow-md">
            Severe chest pain radiating to my arm for 2 hours.
          </div>
        </div>

        {/* AI assessment */}
        <div className="flex justify-start mb-3">
          <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[88%] shadow-sm">
            <p className="text-sm text-gray-700">Assessing severity…</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        </div>

        {/* severity result */}
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 mb-3">
          <span className="relative flex-shrink-0 w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full bg-severity-5 animate-pulse-ring" />
            <span className="relative block w-2.5 h-2.5 rounded-full bg-severity-5" />
          </span>
          <span className="text-sm font-bold text-red-700">Severity 5 / 5 - Critical</span>
          <span className="ml-auto text-[11px] font-semibold text-red-500">Prioritized</span>
        </div>

        {/* booked */}
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
          <FiCheckCircle className="text-emerald-600 flex-shrink-0" size={17} />
          <div>
            <p className="text-sm font-bold text-emerald-800">Booked - today, 2:15 PM</p>
            <p className="text-[11px] text-emerald-600">Dr. Sarah Jenkins · Cardiology</p>
          </div>
        </div>
      </div>

      {/* floating mini-cards */}
      <div className="hidden sm:flex absolute -left-10 top-10 items-center gap-2 bg-white rounded-2xl shadow-xl px-3.5 py-2.5 border border-gray-100 animate-float">
        <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
          <FiClock className="text-amber-500" size={14} />
        </div>
        <span className="text-xs font-bold text-gray-700">Seen 6× sooner</span>
      </div>
      <div className="hidden sm:flex absolute -right-6 bottom-14 items-center gap-2 bg-white rounded-2xl shadow-xl px-3.5 py-2.5 border border-gray-100 animate-float-slow">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
          <FiShield className="text-emerald-500" size={14} />
        </div>
        <span className="text-xs font-bold text-gray-700">Verified doctors</span>
      </div>
    </div>
  )
}

/* ── Hero ───────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
      {/* aurora background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-primary-300/30 rounded-full blur-3xl animate-aurora" />
        <div className="absolute top-[10%] right-[-10%] w-[35rem] h-[35rem] bg-violet-300/30 rounded-full blur-3xl animate-aurora" style={{ animationDelay: '4s' }} />
        <div className="absolute bottom-[-15%] left-[20%] w-[30rem] h-[30rem] bg-sky-200/30 rounded-full blur-3xl animate-aurora" style={{ animationDelay: '8s' }} />
      </div>

      <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 bg-white/70 backdrop-blur border border-primary-100 text-primary-700 text-xs font-bold px-3.5 py-1.5 rounded-full shadow-sm">
              <FiZap size={13} /> AI-powered severity triage
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 text-5xl sm:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.05]">
              The right doctor.
              <br />
              <span className="bg-gradient-to-r from-primary-600 via-violet-600 to-primary-500 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-x">
                The right time.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-md">
              Tell our AI what hurts. It reads your symptoms, scores how urgent they are,
              and books the right specialist in seconds - so the sickest patients skip the
              line, not the small talk. No hold music. No "press 1 for reception."
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/register" className="btn-primary text-base !py-3 !px-6 group">
                Book with AI
                <FiArrowRight className="group-hover:translate-x-0.5 transition-transform" size={18} />
              </Link>
              <a href="#how" className="btn-secondary text-base !py-3 !px-6">
                See how it works
              </a>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-8 flex items-center gap-5 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><FiCheckCircle className="text-emerald-500" size={15} /> No phone calls</span>
              <span className="flex items-center gap-1.5"><FiCheckCircle className="text-emerald-500" size={15} /> Free to use</span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <TriageDemo />
        </Reveal>
      </div>
    </section>
  )
}

/* ── Specialty marquee ──────────────────────────────────────────────── */
function Marquee() {
  const items = ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Dermatology', 'Gastroenterology', 'Pulmonology', 'General Medicine']
  const row = [...items, ...items]
  return (
    <section className="py-10 border-y border-gray-100 bg-white/50 overflow-hidden">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">
        Every specialty, intelligently routed
      </p>
      <div className="relative">
        <div className="flex gap-3 w-max animate-marquee">
          {row.map((s, i) => (
            <span key={i} className="flex items-center gap-2 bg-white border border-gray-100 rounded-full px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm">
              <FiHeart className="text-primary-400" size={13} /> {s}
            </span>
          ))}
        </div>
        {/* edge fades */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent" />
      </div>
    </section>
  )
}

/* ── Stats ──────────────────────────────────────────────────────────── */
function Stats() {
  const stats = [
    { to: 6, suffix: '×', label: 'Faster for critical cases' },
    { to: 30, suffix: 's', label: 'Average time to a booking' },
    { to: 5, suffix: '-step', label: 'Severity triage, 1 to 5' },
    { to: 100, suffix: '%', label: 'Verified-visit reviews' },
  ]
  return (
    <section className="max-w-6xl mx-auto px-5 py-20">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 80} className="text-center">
            <p className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-br from-primary-600 to-violet-600 bg-clip-text text-transparent">
              <CountUp to={s.to} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-sm font-medium text-gray-500">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ── Positioning contrast ───────────────────────────────────────────── */
function Contrast() {
  return (
    <section className="max-w-6xl mx-auto px-5 py-12">
      <Reveal className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
          Booking shouldn't be first-come, first-served
        </h2>
        <p className="mt-4 text-gray-600 text-lg">
          Other apps hand out the next open slot. CuraLine decides who needs it most.
        </p>
      </Reveal>
      <div className="grid md:grid-cols-2 gap-5">
        <Reveal className="rounded-3xl border border-gray-200 bg-gray-50 p-7">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Typical booking apps</p>
          <ul className="space-y-3">
            {['Whoever clicks first gets the slot', 'No idea how urgent you are', 'Endless phone tag with the front desk'].map((t) => (
              <li key={t} className="flex items-start gap-3 text-gray-500">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                <span className="text-[15px]">{t}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120} className="relative rounded-3xl border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-violet-50 p-7 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-400/20 rounded-full blur-2xl" />
          <p className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-4">The CuraLine way</p>
          <ul className="space-y-3">
            {['AI scores your severity from your symptoms', 'Critical patients are surfaced first', 'Booked with the right specialist in seconds'].map((t) => (
              <li key={t} className="flex items-start gap-3 text-gray-800">
                <FiCheckCircle className="text-primary-600 mt-0.5 flex-shrink-0" size={18} />
                <span className="text-[15px] font-medium">{t}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

/* ── Features ───────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: FiCpu, color: 'from-primary-500 to-violet-600', title: 'AI symptom triage', desc: 'Describe how you feel in plain language. Our AI assesses urgency and routes you to the right specialty.' },
  { icon: FiTrendingUp, color: 'from-rose-500 to-orange-500', title: 'Severity-first scheduling', desc: 'A 1–5 severity score decides priority. Critical patients can be moved ahead - fairly, with consent.' },
  { icon: FiMessageSquare, color: 'from-sky-500 to-cyan-500', title: 'Conversational booking', desc: 'No forms, no phone calls. Chat your way to a confirmed appointment in about 30 seconds.' },
  { icon: FiStar, color: 'from-amber-500 to-yellow-500', title: 'Verified reviews', desc: 'Only patients who actually attended can review - every rating is backed by a real visit.' },
  { icon: FiShield, color: 'from-emerald-500 to-teal-500', title: 'Insurance-aware', desc: 'Filter to doctors who take your plan, so “does it cover this?” is answered before you book.' },
  { icon: FiCalendar, color: 'from-violet-500 to-fuchsia-500', title: 'Smart reminders', desc: 'Confirmations and day-before reminders keep no-shows down and your day on track.' },
]

function Features() {
  return (
    <section id="features" className="max-w-6xl mx-auto px-5 py-20">
      <Reveal className="text-center max-w-2xl mx-auto mb-14">
        <span className="text-xs font-bold uppercase tracking-widest text-primary-600">Features</span>
        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
          Healthcare booking, reimagined end to end
        </h2>
      </Reveal>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 100}>
            <div className="group h-full rounded-2xl bg-white border border-gray-100 p-6 shadow-sm hover:shadow-xl hover:shadow-primary-900/5 hover:-translate-y-1 transition-all duration-300">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-lg mb-5 group-hover:scale-110 transition-transform`}>
                <f.icon className="text-white" size={22} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">{f.title}</h3>
              <p className="mt-2 text-[15px] text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ── How it works ───────────────────────────────────────────────────── */
function How() {
  const steps = [
    { icon: FiMessageSquare, title: 'Describe your symptoms', desc: 'Tell the AI assistant what’s wrong, in your own words.' },
    { icon: FiCpu, title: 'Get triaged instantly', desc: 'CuraLine scores severity and finds the right specialist.' },
    { icon: FiCheckCircle, title: 'Confirmed in seconds', desc: 'Your slot is booked. Reminders handle the rest.' },
  ]
  return (
    <section id="how" className="relative py-20 bg-gradient-to-b from-white to-primary-50/40">
      <div className="max-w-6xl mx-auto px-5">
        <Reveal className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-primary-600">How it works</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            From symptom to scheduled in three steps
          </h2>
        </Reveal>
        <div className="relative grid md:grid-cols-3 gap-10">
          {/* connector */}
          <div className="hidden md:block absolute top-9 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-primary-200 via-violet-300 to-primary-200" />
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 140} className="relative text-center">
              <div className="relative z-10 w-16 h-16 mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-white border border-primary-100 shadow-xl shadow-primary-900/5 flex items-center justify-center mx-auto">
                  <s.icon className="text-primary-600" size={26} />
                </div>
                <span className="absolute -top-2 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-violet-600 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-6 font-bold text-gray-900 text-lg">{s.title}</h3>
              <p className="mt-2 text-[15px] text-gray-500 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── For doctors ────────────────────────────────────────────────────── */
function ForDoctors() {
  const points = [
    'AI Morning Briefing of your whole day',
    'Severity-coded schedule, criticals first',
    'One-tap visit outcomes & no-show analytics',
    'Set your hours in seconds with bulk slots',
  ]
  return (
    <section id="doctors" className="max-w-6xl mx-auto px-5 py-20">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <Reveal>
          <span className="text-xs font-bold uppercase tracking-widest text-primary-600">For doctors</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            We don’t just send you patients. We give you a better day.
          </h2>
          <p className="mt-4 text-gray-600 text-lg leading-relaxed">
            CuraLine turns intake into intelligence - so you walk into every visit already briefed,
            and your schedule reflects who actually needs care.
          </p>
          <ul className="mt-7 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-gray-700">
                <span className="w-6 h-6 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <FiCheckCircle className="text-primary-600" size={14} />
                </span>
                <span className="font-medium">{p}</span>
              </li>
            ))}
          </ul>
          <Link to="/apply" className="btn-secondary mt-8 !py-3 !px-6">
            <FiUsers size={17} /> Apply to join as a doctor
          </Link>
        </Reveal>

        <Reveal delay={150}>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-amber-300/20 to-primary-300/20 blur-3xl rounded-full" />
            <div className="relative card-glass !p-5 shadow-2xl shadow-primary-900/10">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <FiActivity className="text-white" size={17} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Morning Briefing</p>
                  <p className="text-[11px] text-gray-400">Today · 12 patients</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Good morning, Dr. Jenkins. <span className="font-semibold text-gray-800">2 critical cases</span> today -
                first is a chest-pain patient at 9:00. Then a routine afternoon.
              </p>
              <div className="flex gap-2 mt-4">
                <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-bold">2 Critical</span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold">3 Moderate</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">7 Routine</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ── FAQ (SEO-rich, crawlable via native <details>) ─────────────────── */
const FAQS = [
  {
    q: 'Is CuraLine a replacement for emergency services?',
    a: 'Hard no. If you’re having a real emergency, call 911 and put the phone down - our AI will literally tell you to do exactly that if your symptoms sound serious. CuraLine is for booking the right doctor fast, not for replacing the ER.',
  },
  {
    q: 'How does the AI decide who’s most urgent?',
    a: 'Describe your symptoms in plain English (“my chest feels like an elephant sat on it” works fine) and CuraLine scores severity from 1 to 5. Higher score means higher priority - no medical jargon, no 2 a.m. Dr. Google rabbit holes.',
  },
  {
    q: 'How fast can I actually get an appointment?',
    a: 'Most bookings take about 30 seconds. The genuinely hard part is deciding what to watch while you wait for the appointment day to arrive.',
  },
  {
    q: 'Does it cost anything?',
    a: 'For patients, CuraLine is free. Zero. Nada. We had a joke prepared here, but “free” is already pretty funny.',
  },
  {
    q: 'Can I choose my own doctor?',
    a: 'Absolutely - just say “book me with Dr. Jenkins” and the AI listens. Prefer to be matched to the best available specialist for your symptoms? Let it drive. Your call.',
  },
  {
    q: 'Will it find a doctor who takes my insurance?',
    a: 'Yes. Filter by your plan and only see doctors who accept it - so “is this covered?” is answered before you book, not after the bill ambushes you.',
  },
  {
    q: 'Is my health data safe?',
    a: 'Very. Data is encrypted, access is locked to your own account, and we never sell it. Your symptoms stay between you and your doctor - not the entire internet.',
  },
  {
    q: 'I’m a doctor. What’s in it for me?',
    a: 'A calmer day. You get an AI morning briefing, a severity-sorted schedule, and one-tap visit outcomes - less phone tag, more actual medicine. Applying takes about two minutes.',
  },
]

function FAQ() {
  return (
    <section id="faq" className="max-w-3xl mx-auto px-5 py-20">
      <Reveal className="text-center mb-12">
        <span className="text-xs font-bold uppercase tracking-widest text-primary-600">FAQ</span>
        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
          Questions, answered (mostly seriously)
        </h2>
        <p className="mt-4 text-gray-600 text-lg">
          Everything you might wonder before booking a doctor online with CuraLine.
        </p>
      </Reveal>
      <div className="space-y-3">
        {FAQS.map((item, i) => (
          <Reveal key={item.q} delay={(i % 4) * 70}>
            <details className="group rounded-2xl border border-gray-100 bg-white shadow-sm open:shadow-md transition-shadow">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4">
                <h3 className="font-bold text-gray-900 text-[15px]">{item.q}</h3>
                <FiArrowRight className="text-primary-500 flex-shrink-0 rotate-90 group-open:-rotate-90 transition-transform" size={16} />
              </summary>
              <p className="px-5 pb-5 -mt-1 text-[15px] text-gray-600 leading-relaxed">{item.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ── CTA band ───────────────────────────────────────────────────────── */
function CTA() {
  return (
    <section className="max-w-6xl mx-auto px-5 py-16">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-violet-600 to-primary-700 px-8 py-16 text-center shadow-2xl shadow-primary-900/30">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-aurora" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-violet-300/20 rounded-full blur-3xl animate-aurora" style={{ animationDelay: '6s' }} />
          <h2 className="relative text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Be seen by the right doctor,<br className="hidden sm:block" /> at the right time.
          </h2>
          <p className="relative mt-4 text-primary-100 text-lg max-w-xl mx-auto">
            Join CuraLine and let AI handle the triage. Free for patients, always.
          </p>
          <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="bg-white text-primary-700 font-bold text-base py-3.5 px-7 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-95 transition-all">
              Get started free
            </Link>
            <Link to="/login" className="text-white font-semibold text-base py-3.5 px-7 rounded-xl border border-white/30 hover:bg-white/10 transition-all">
              I have an account
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/* ── Footer ─────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-6xl mx-auto px-5 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
        <Logo />
        <p className="text-sm text-gray-400 text-center">
          © {new Date().getFullYear()} CuraLine - Smart hospital appointments, severity first.
        </p>
        <div className="flex items-center gap-6 text-sm font-medium text-gray-500">
          <Link to="/login" className="hover:text-gray-900 transition-colors">Sign in</Link>
          <Link to="/register" className="hover:text-gray-900 transition-colors">Register</Link>
          <Link to="/apply" className="hover:text-gray-900 transition-colors">For doctors</Link>
        </div>
      </div>
    </footer>
  )
}

export default function Landing() {
  return (
    <div className="bg-white">
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Stats />
        <Contrast />
        <Features />
        <How />
        <ForDoctors />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
