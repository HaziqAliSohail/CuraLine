# CuraLine — Brand Guidelines

The single source of truth for how CuraLine looks, sounds, and feels — on the
web app, the mobile app, the marketing site, the app stores, and social. Design
tokens here are implemented in `Frontend/tailwind.config.js` (web) and
`Mobile/src/theme.js` (mobile); keep all three in sync.

---

## 1. Brand essence

- **What we are:** AI-powered, **severity-first** healthcare booking.
- **The one-liner:** *Care, in order of urgency.*
- **Mission:** Make sure the sickest patient is seen first — not whoever dialed
  fastest.
- **Why we're different:** Every other booking app hands out the next open slot.
  CuraLine reads your symptoms, scores how urgent you are (1–5), and books the
  right specialist accordingly. Triage, not first-come-first-served.

**Positioning statement**
> For patients who need the right care fast, CuraLine is the booking app that
> triages by medical severity — so unlike first-come-first-served schedulers,
> the people who can't wait don't have to.

**Value props (in priority order)**
1. **Seen by severity** — AI scores urgency 1–5; critical cases surface first.
2. **~30 seconds** — describe symptoms → matched specialist → booked.
3. **No phone tag** — chat, not hold music.
4. **Verified everything** — real-visit reviews, insurance-aware, honest pricing.
5. **Free for patients.**

---

## 2. The mark

The logo is a single continuous line forming **C + L** (CuraLine) whose lower
tail becomes a **heartbeat/ECG pulse**. It says, in one glyph: *a clinic that
monitors urgency.* That heartbeat is the brand's signature motif — reuse it in
loaders, dividers, empty states, and the immersive scene.

**Color variants**
| Context | Mark | Background |
|---|---|---|
| Default | Indigo `#4f46e5` | White / light |
| Reversed | White | Indigo `#4f46e5` (app icon, splash, dark hero) |
| Monochrome | Ink `#0f1222` or white | Any — for print/single-color |

**Rules**
- **Clear space:** keep padding ≥ the height of the "L" stem on all sides.
- **Min size:** 24 px tall on screen (mark only).
- **Don't:** recolor the mark off-brand, add gradients/shadows to it, stretch it,
  rotate it, outline it, or place the indigo mark on a busy/low-contrast photo.
- **Icon:** white mark on indigo, opaque (see `Mobile/assets/icon.png`).

---

## 3. Color system

### Core
| Token | Hex | Use |
|---|---|---|
| **Brand Indigo** (primary) | `#4f46e5` | Primary actions, the mark, links, focus |
| Indigo Violet (accent) | `#7c3aed` | Gradient partner, secondary accents |
| Ink (text) | `#0f1222` | Headings & body on light |
| Muted text | `#5b5f6e` | Secondary copy |
| Faint text | `#9b9fae` | Hints, captions, disabled |
| Surface | `#f7f7fb` | App background (indigo-tinted off-white) |
| Card | `#ffffff` | Cards, sheets |
| Border | `#e8e9f1` | Hairlines, dividers |

**Primary indigo scale** (Tailwind `primary.*` / mobile `primary*`):
`50 #eef2ff · 100 #e0e7ff · 200 #c7d2fe · 300 #a5b4fc · 400 #818cf8 ·
500 #6366f1 · 600 #4f46e5 · 700 #4338ca · 800 #3730a3 · 900 #312e81`

**Signature gradient:** `#4f46e5 → #7c3aed` (135°). Hero CTAs, brand surfaces,
the AI bot glow. Use sparingly — it's the "wow," not the wallpaper.

### Severity scale (canonical — the same on web & mobile)
The product's most important color language. Never repurpose these hues for
anything non-severity.
| Level | Label | Hex | Meaning |
|---|---|---|---|
| 1 | Routine | `#10b981` emerald | Can wait weeks |
| 2 | Low | `#84cc16` lime | Within a week |
| 3 | Moderate | `#f59e0b` amber | 1–3 days |
| 4 | High | `#f97316` orange | Urgent, same day |
| 5 | Critical | `#ef4444` red | Emergency — ER now |

### Accessibility
- Body text on light must meet **WCAG AA** (≥ 4.5:1). Ink on Surface passes.
- Don't put indigo-600 text on indigo-100 for body copy (fails) — use ink.
- Never encode meaning by **color alone**; severity always pairs a number/label.

### Usage ratio (the 60-30-10)
~60% neutral surface/white, ~30% ink text, ~10% brand indigo + accents. Severity
colors are functional, outside the ratio.

---

## 4. Typography

**Typeface:** **Plus Jakarta Sans** everywhere (web `@fontsource`/Google Fonts,
mobile `@expo-google-fonts/plus-jakarta-sans`). One font, full weight range.

| Role | Weight | Web size | Mobile token |
|---|---|---|---|
| Display / hero | 800 ExtraBold | `text-6xl`→`8xl`, tracking-tight | `type.display` (27) |
| Section H2 | 700–800 | `text-3xl`→`5xl` | `type.title` (19) |
| Card / H3 | 700 Bold | `text-lg` | `type.heading` (15) |
| Body | 400–500 | `text-base`, leading-relaxed | `type.body` (14) |
| Caption | 600 SemiBold | `text-sm` muted | `type.caption` (12) |
| Eyebrow/micro | 700, UPPERCASE, tracking-widest | `text-xs` | `type.micro` (10.5) |

**Rules:** headlines tight tracking + ExtraBold; body relaxed leading; eyebrows
uppercase with wide tracking. Numbers (severity, stats) lean ExtraBold for
confidence. Never use raw `fontWeight` on mobile — use the `font` map.

---

## 5. Motion

Premium = restraint. Reveals 0.6–1.1s on `power3.out` / `cubic-bezier(.16,1,.3,1)`;
hovers 150ms. The **heartbeat pulse** is the hero motion (loaders, the live
"online" dot, the WebGL vitals). Always honor `prefers-reduced-motion`. Motion
should feel like a calm monitor, never a carnival.

---

## 6. UI components

- **Buttons** — Primary: indigo→violet gradient, rounded-2xl, soft glow shadow,
  `hover:scale-[1.03]`. Secondary: glass / ghost. Always one primary per view.
- **Cards** — white, `rounded-3xl`, hairline border, layered soft shadow. On dark
  surfaces: **glass** (`bg-white/5`, `backdrop-blur`, `border-white/10`).
- **Severity badge** — dot + number + label in the severity hue; pulse ring on
  critical. The product's signature component.
- **Inputs** — generous radius, clear focus ring in indigo-600, never red unless
  error.
- **Radii:** sm 10 · md 14 · lg 18 · xl 24 · pill 999. **Spacing:** 4/8 pt grid.

---

## 7. Voice & tone

We sound like the **best triage nurse you've ever met**: warm, fast, competent,
quietly witty — and dead serious the instant it matters.

**Principles**
1. **Clear over clever.** Plain English. Clever only when nothing's at stake.
2. **Calm under pressure.** Never alarmist for minor issues.
3. **Human, not clinical.** "Tell me what hurts," not "Enter chief complaint."
4. **Honest.** Free is free. No dark patterns, no fake urgency.
5. **Serious when it counts.** Emergencies, data, and safety are 0% jokes.

**Tone dial**
| Situation | Tone |
|---|---|
| Marketing / onboarding | Warm, confident, lightly playful |
| FAQ / help | Friendly, a little funny, genuinely useful |
| Triage / booking | Reassuring, concise, efficient |
| Emergency / safety / privacy | Direct, calm, zero humor |

**Do / Don't**
- ✅ "Tell me what hurts — I'll find the right doctor."
  ❌ "Submit your symptomatic data for processing."
- ✅ "Free for patients. Zero. We had a joke here but 'free' is funnier."
  ❌ "Limited-time offer!! Act now!!"
- ✅ (emergency) "This could be serious. Call 911 or go to the nearest ER now."
  ❌ (emergency) any joke, emoji, or upsell.

**Words we use:** triage, severity, urgency, the right doctor, in seconds, seen
first, no phone tag. **Words we avoid:** cheap, guaranteed cure, diagnosis,
"miracle," anything that overpromises medically.

---

## 8. Messaging bank

**Primary tagline:** Care, in order of urgency.
**Alternates:** The right doctor. The right time. · Seen by severity. · The
sickest, seen first. · Healthcare that moves at your speed.

**Elevator pitch (1 sentence):**
> CuraLine is the AI doctor-booking app that triages your symptoms by severity
> and books the right specialist in seconds — so the sickest patients are seen
> first, not last.

**Headline bank (marketing):**
- Booking shouldn't be first-come, first-served.
- Describe it. We triage it. You're booked.
- Skip the line, not the small talk.
- The phone tree is dead. Long live triage.

---

## 9. Channel copy (ready to paste)

**App Store / Play**
- **Name:** CuraLine
- **Subtitle (≤30):** AI doctor booking by urgency
- **Promo:** Describe your symptoms. Our AI scores how urgent you are and books
  the right specialist in ~30 seconds. Critical patients first. Free for patients.
- **Keywords:** doctor appointment, symptom checker, AI triage, urgent care,
  book a doctor, telehealth, specialist, severity, insurance, online booking

**Social bios**
- **X/Twitter (160):** AI healthcare booking that triages by severity — the
  sickest patients seen first, booked in ~30s. Care, in order of urgency.
- **Instagram:** 🫀 Care, in order of urgency · AI severity triage · Book the
  right doctor in ~30s · Free for patients
- **LinkedIn tagline:** Severity-first healthcare booking. We triage symptoms by
  urgency so the right patient sees the right doctor at the right time.

**Email signature line:** CuraLine — care, in order of urgency.

**OG / social share image (1200×630):** indigo `#4f46e5` background, white mark
top-left, ExtraBold white headline "Care, in order of urgency.", sub "AI severity
triage · book in ~30s". (Generate to `Frontend/public/og-image.png`.)

---

## 10. Applications & assets

| Asset | Spec | Where |
|---|---|---|
| App icon (iOS) | 1024², opaque, white mark on indigo | `Mobile/assets/icon.png` |
| Adaptive icon (Android) | 1024² fg + `#4f46e5` bg | `Mobile/assets/adaptive-icon.png` |
| Splash | white mark on `#4f46e5` | `Mobile/assets/splash-icon.png` |
| Favicon | brand tile (white mark on indigo): `.ico` + 16/32 PNG | `Frontend/public/favicon.ico`, `favicon-16.png`, `favicon-32.png` |
| Apple touch icon | 180², white mark on indigo | `Frontend/public/apple-touch-icon.png` |
| In-app logo (web + mobile) | indigo mark on white | `Frontend/public/logo.png`, `Mobile/assets/logo.png` |
| OG image | 1200×630 (see §9) | `Frontend/public/og-image.png` *(to create)* |

---

## 11. Brand checklist (ship gate)

- [ ] Only Plus Jakarta Sans; weights per scale
- [ ] Indigo `#4f46e5` is the single primary; gradient used sparingly
- [ ] Severity colors match the canonical scale on web **and** mobile
- [ ] Mark has clear space, correct variant for its background, ≥ 24 px
- [ ] Copy passes the tone dial (no jokes in emergency/safety/privacy)
- [ ] AA contrast on all body text; meaning never by color alone
- [ ] `prefers-reduced-motion` respected
- [ ] Placeholder `curaline.com` / `og-image.png` replaced before launch
