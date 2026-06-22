import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  FiArrowRight, FiCalendar, FiCpu, FiMessageSquare, FiShield, FiStar, FiTrendingUp, FiCheckCircle, FiUsers,
} from 'react-icons/fi'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { createImmersiveScene } from '../three/immersiveScene'

gsap.registerPlugin(ScrollTrigger)

/* ── SEO content (ported from the classic landing so promoting /experience to
   the homepage keeps all crawlable copy + the FAQ that backs FAQPage schema) ── */
const STATS = [
  ['6×', 'Faster for critical cases'],
  ['30s', 'Average time to a booking'],
  ['1–5', 'Severity triage scale'],
  ['100%', 'Verified-visit reviews'],
]

const FEATURES = [
  { icon: FiCpu, title: 'AI symptom triage', desc: 'Describe how you feel in plain language. Our AI assesses urgency and routes you to the right specialty.' },
  { icon: FiTrendingUp, title: 'Severity-first scheduling', desc: 'A 1–5 severity score decides priority. Critical patients can be moved ahead — fairly, with consent.' },
  { icon: FiMessageSquare, title: 'Conversational booking', desc: 'No forms, no phone calls. Chat your way to a confirmed appointment in about 30 seconds.' },
  { icon: FiStar, title: 'Verified reviews', desc: 'Only patients who actually attended can review — every rating is backed by a real visit.' },
  { icon: FiShield, title: 'Insurance-aware', desc: 'Filter to doctors who take your plan, so “does it cover this?” is answered before you book.' },
  { icon: FiCalendar, title: 'Smart reminders', desc: 'Confirmations and day-before reminders keep no-shows down and your day on track.' },
]

const SPECIALTIES = ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Dermatology', 'Gastroenterology', 'Pulmonology', 'General Medicine']

const STEPS = [
  ['01', 'Describe your symptoms', 'Tell the AI assistant what’s wrong, in your own words.'],
  ['02', 'Get triaged instantly', 'CuraLine scores severity and finds the right specialist.'],
  ['03', 'Confirmed in seconds', 'Your slot is booked. Reminders handle the rest.'],
]

const DOCTOR_POINTS = [
  'AI Morning Briefing of your whole day',
  'Severity-coded schedule, criticals first',
  'One-tap visit outcomes & no-show analytics',
  'Set your hours in seconds with bulk slots',
]

const FAQS = [
  { q: 'Is CuraLine a replacement for emergency services?', a: 'Hard no. If you’re having a real emergency, call 911 and put the phone down — our AI will literally tell you to do exactly that if your symptoms sound serious. CuraLine is for booking the right doctor fast, not for replacing the ER.' },
  { q: 'How does the AI decide who’s most urgent?', a: 'Describe your symptoms in plain English (“my chest feels like an elephant sat on it” works fine) and CuraLine scores severity from 1 to 5. Higher score means higher priority — no medical jargon, no 2 a.m. Dr. Google rabbit holes.' },
  { q: 'How fast can I actually get an appointment?', a: 'Most bookings take about 30 seconds. The genuinely hard part is deciding what to watch while you wait for the appointment day to arrive.' },
  { q: 'Does it cost anything?', a: 'For patients, CuraLine is free. Zero. Nada. We had a joke prepared here, but “free” is already pretty funny.' },
  { q: 'Can I choose my own doctor?', a: 'Absolutely — just say “book me with Dr. Jenkins” and the AI listens. Prefer to be matched to the best available specialist for your symptoms? Let it drive. Your call.' },
  { q: 'Will it find a doctor who takes my insurance?', a: 'Yes. Filter by your plan and only see doctors who accept it — so “is this covered?” is answered before you book, not after the bill ambushes you.' },
  { q: 'Is my health data safe?', a: 'Very. Data is encrypted, access is locked to your own account, and we never sell it. Your symptoms stay between you and your doctor — not the entire internet.' },
  { q: 'I’m a doctor. What’s in it for me?', a: 'A calmer day. You get an AI morning briefing, a severity-sorted schedule, and one-tap visit outcomes — less phone tag, more actual medicine. Applying takes about two minutes.' },
]

/* Cinematic sci-fi landing: WebGL vitals + AI triage scene, Lenis smooth scroll,
   GSAP reveals — with the full SEO content folded in. Lives at /experience. */
export default function LandingImmersive() {
  const canvasRef = useRef(null)
  const rootRef = useRef(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scene = createImmersiveScene(canvasRef.current)

    let lenis
    const tick = (time) => lenis && lenis.raf(time * 1000)

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: rootRef.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => scene.setScroll(self.progress),
      })

      if (reduced) return

      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('[data-hero] > *', { y: 44, opacity: 0, duration: 1.1, stagger: 0.12, delay: 0.15 })

      gsap.utils.toArray('.reveal').forEach((el) => {
        gsap.from(el, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } })
      })

      gsap.utils.toArray('.stagger').forEach((group) => {
        gsap.from(group.children, {
          y: 36, opacity: 0, duration: 0.85, ease: 'power3.out', stagger: 0.1,
          scrollTrigger: { trigger: group, start: 'top 82%' },
        })
      })
    }, rootRef)

    if (!reduced) {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.9 })
      lenis.on('scroll', ScrollTrigger.update)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)
    }

    ScrollTrigger.refresh()

    return () => {
      ctx.revert()
      gsap.ticker.remove(tick)
      if (lenis) lenis.destroy()
      scene.dispose()
    }
  }, [])

  return (
    <div ref={rootRef} className="relative bg-[#05060f] text-white overflow-x-clip">
      <style>{`
        .glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(18px);
                 -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.10); }
        .grad-text { background: linear-gradient(110deg,#a5b4fc 0%,#818cf8 40%,#c4b5fd 100%);
                     -webkit-background-clip: text; background-clip: text; color: transparent; }
        .grid-overlay { background-image:
            linear-gradient(rgba(124,58,237,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,58,237,0.06) 1px, transparent 1px);
          background-size: 64px 64px; mask-image: radial-gradient(ellipse at center, #000 35%, transparent 75%); }
      `}</style>

      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0" aria-hidden="true" />
      <div className="grid-overlay pointer-events-none fixed inset-0 z-0" aria-hidden="true" />

      {/* Floating nav */}
      <header className="fixed top-0 inset-x-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between glass rounded-2xl px-5 py-3">
          <img src="/logo.png" alt="CuraLine" className="h-9 w-auto object-contain" />
          <nav className="hidden md:flex items-center gap-7 text-sm text-white/70">
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#doctors" className="hover:text-white transition-colors">For doctors</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline text-sm font-semibold text-white/80 hover:text-white px-3 py-2 transition-colors">Sign in</Link>
            <Link to="/register" className="text-sm font-semibold px-5 py-2 rounded-xl bg-white text-[#05060f] hover:bg-white/90 transition-colors">Get started</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 min-h-screen flex flex-col justify-center items-center text-center px-6">
        <div data-hero className="max-w-5xl">
          <span className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-white/80 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AI-powered severity triage · live now
          </span>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.95]">
            The right doctor.<br /><span className="grad-text">The right time.</span>
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            Tell our AI what hurts. It reads your symptoms, scores how urgent they are, and books the
            right specialist in seconds — so the sickest patients skip the line, not the small talk.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 font-semibold text-lg shadow-[0_8px_40px_-8px_rgba(99,102,241,0.7)] hover:scale-[1.03] transition-transform">
              Book with AI
            </Link>
            <a href="#how" className="px-8 py-4 rounded-2xl glass font-semibold text-lg hover:bg-white/10 transition-colors">
              See how it works
            </a>
          </div>
          <div className="mt-8 flex items-center justify-center gap-5 text-sm text-white/50">
            <span className="flex items-center gap-1.5"><FiCheckCircle className="text-emerald-400" size={15} /> No phone calls</span>
            <span className="flex items-center gap-1.5"><FiCheckCircle className="text-emerald-400" size={15} /> Free to use</span>
          </div>
        </div>
        <div className="absolute bottom-10 text-white/40 text-xs tracking-widest uppercase animate-bounce">Scroll</div>
      </section>

      {/* ── Contrast (severity-first positioning) ── */}
      <section className="relative z-10 px-6 py-28">
        <div className="max-w-5xl mx-auto">
          <div className="reveal text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">Booking shouldn’t be first-come, first-served</h2>
            <p className="mt-4 text-white/60 text-lg">Other apps hand out the next open slot. CuraLine decides who needs it most.</p>
          </div>
          <div className="stagger grid md:grid-cols-2 gap-5">
            <div className="glass rounded-3xl p-7">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Typical booking apps</p>
              <ul className="space-y-3 text-white/55">
                {['Whoever clicks first gets the slot', 'No idea how urgent you are', 'Endless phone tag with the front desk'].map((t) => (
                  <li key={t} className="flex items-start gap-3"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-white/30 flex-shrink-0" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl p-7 border border-indigo-400/30 bg-gradient-to-br from-indigo-500/10 to-violet-500/10">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-4">The CuraLine way</p>
              <ul className="space-y-3 text-white/85">
                {['AI scores your severity from your symptoms', 'Critical patients are surfaced first', 'Booked with the right specialist in seconds'].map((t) => (
                  <li key={t} className="flex items-start gap-3"><FiCheckCircle className="text-indigo-300 mt-0.5 flex-shrink-0" size={18} /><span className="font-medium">{t}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section id="intelligence" className="relative z-10 px-6 py-24">
        <div className="stagger max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-5">
          {STATS.map(([stat, label]) => (
            <div key={label} className="glass rounded-3xl p-7 text-center">
              <div className="text-4xl sm:text-5xl font-extrabold grad-text">{stat}</div>
              <p className="mt-3 text-white/55 text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Triage / AI chat ── */}
      <section id="triage" className="relative z-10 px-6 py-28">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="reveal text-violet-300 font-semibold tracking-widest uppercase text-sm mb-6">Conversational triage</p>
            <h2 className="reveal text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
              Tell it what hurts.<br /><span className="grad-text">It does the rest.</span>
            </h2>
            <p className="reveal mt-6 text-lg text-white/60 leading-relaxed max-w-md">
              Plain English in. A severity score, the right specialist, and an open slot out —
              with a clear hand-off to emergency services when it matters.
            </p>
          </div>
          <div className="glass rounded-3xl p-6 reveal">
            <div className="flex items-center gap-2 mb-5 text-xs text-white/40">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-2">CuraLine AI</span>
            </div>
            <div className="space-y-3">
              <div className="ml-auto max-w-[80%] bg-indigo-500/90 rounded-2xl rounded-br-md px-4 py-3 text-sm">
                Severe chest pain radiating to my arm for 2 hours.
              </div>
              <div className="max-w-[85%] glass rounded-2xl rounded-bl-md px-4 py-3 text-sm text-white/85">
                That can be serious. I’m flagging this as <b>severity 5/5 — critical</b> and prioritizing a cardiology slot today.
              </div>
              <div className="flex items-center gap-2 max-w-[85%] glass rounded-2xl rounded-bl-md px-4 py-3 text-sm">
                <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-xs font-bold">SEV 5</span>
                <span className="text-white/80">Dr. Jenkins · Cardiology · 2:15 PM</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 px-6 py-28">
        <div className="max-w-6xl mx-auto">
          <div className="reveal text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">Features</span>
            <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight">Healthcare booking, reimagined end to end</h2>
          </div>
          <div className="stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass rounded-3xl p-7 hover:bg-white/[0.07] transition-colors">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg mb-5">
                  <f.icon className="text-white" size={22} />
                </div>
                <h3 className="font-bold text-lg">{f.title}</h3>
                <p className="mt-2 text-white/55 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          {/* Specialties — keyword-rich, crawlable */}
          <p className="reveal text-center text-xs font-bold uppercase tracking-widest text-white/35 mt-16 mb-5">Every specialty, intelligently routed</p>
          <div className="stagger flex flex-wrap justify-center gap-3">
            {SPECIALTIES.map((s) => (
              <span key={s} className="glass rounded-full px-4 py-2 text-sm font-medium text-white/70">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="relative z-10 px-6 py-28">
        <div className="max-w-6xl mx-auto">
          <h2 className="reveal text-3xl sm:text-5xl font-bold tracking-tight text-center max-w-3xl mx-auto leading-tight">
            From symptom to scheduled <span className="grad-text">in three steps.</span>
          </h2>
          <div className="stagger mt-16 grid md:grid-cols-3 gap-5">
            {STEPS.map(([n, title, body]) => (
              <div key={n} className="glass rounded-3xl p-8">
                <div className="text-sm font-mono text-indigo-300/70">{n}</div>
                <div className="mt-3 text-2xl font-bold">{title}</div>
                <p className="mt-3 text-white/60 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For doctors ── */}
      <section id="doctors" className="relative z-10 px-6 py-28">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="reveal block text-xs font-bold uppercase tracking-widest text-indigo-300">For doctors</span>
            <h2 className="reveal mt-3 text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              We don’t just send you patients. We give you a better day.
            </h2>
            <p className="reveal mt-4 text-white/60 text-lg leading-relaxed">
              CuraLine turns intake into intelligence — so you walk into every visit already briefed,
              and your schedule reflects who actually needs care.
            </p>
            <ul className="stagger mt-7 space-y-3">
              {DOCTOR_POINTS.map((p) => (
                <li key={p} className="flex items-center gap-3 text-white/80">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <FiCheckCircle className="text-indigo-300" size={14} />
                  </span>
                  <span className="font-medium">{p}</span>
                </li>
              ))}
            </ul>
            <Link to="/apply" className="reveal inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-xl glass font-semibold hover:bg-white/10 transition-colors">
              <FiUsers size={17} /> Apply to join as a doctor
            </Link>
          </div>
          <div className="glass rounded-3xl p-6 reveal">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <FiTrendingUp className="text-white" size={17} />
              </div>
              <div>
                <p className="text-sm font-bold">Morning Briefing</p>
                <p className="text-[11px] text-white/40">Today · 12 patients</p>
              </div>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              Good morning, Dr. Jenkins. <span className="font-semibold text-white">2 critical cases</span> today —
              first is a chest-pain patient at 9:00. Then a routine afternoon.
            </p>
            <div className="flex gap-2 mt-4 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300">2 Critical</span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300">3 Moderate</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300">7 Routine</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ (crawlable via native <details>, backs FAQPage schema) ── */}
      <section id="faq" className="relative z-10 px-6 py-28">
        <div className="max-w-3xl mx-auto">
          <div className="reveal text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">FAQ</span>
            <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight">Questions, answered (mostly seriously)</h2>
            <p className="mt-4 text-white/60 text-lg">Everything you might wonder before booking a doctor online with CuraLine.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((item) => (
              <details key={item.q} className="group glass rounded-2xl">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4">
                  <h3 className="font-semibold text-[15px]">{item.q}</h3>
                  <FiArrowRight className="text-indigo-300 flex-shrink-0 rotate-90 group-open:-rotate-90 transition-transform" size={16} />
                </summary>
                <p className="px-5 pb-5 -mt-1 text-[15px] text-white/60 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 flex items-center justify-center text-center px-6 py-32">
        <div className="max-w-3xl reveal">
          <h2 className="text-4xl sm:text-7xl font-extrabold tracking-tight leading-[0.95]">
            Be seen by the right doctor,<br /><span className="grad-text">at the right time.</span>
          </h2>
          <p className="mt-8 text-lg text-white/60">Join CuraLine and let AI handle the triage. Free for patients, always.</p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="px-10 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 font-semibold text-lg shadow-[0_8px_40px_-8px_rgba(99,102,241,0.7)] hover:scale-[1.03] transition-transform">
              Get started free
            </Link>
            <Link to="/login" className="px-10 py-4 rounded-2xl glass font-semibold text-lg hover:bg-white/10 transition-colors">
              I have an account
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-white/40">
          <img src="/logo.png" alt="CuraLine" className="h-8 w-auto opacity-70" />
          <p className="text-center">© {new Date().getFullYear()} CuraLine — Smart hospital appointments, severity first.</p>
          <div className="flex items-center gap-6 font-medium text-white/55">
            <Link to="/login" className="hover:text-white transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
            <Link to="/apply" className="hover:text-white transition-colors">For doctors</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
