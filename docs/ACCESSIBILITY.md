# Accessibility (WCAG 2.1 AA)

CuraLine targets **WCAG 2.1 AA**. This documents what's in place, what was
fixed in this pass, and the checklist still requiring a live audit.

## In place
- **Visible focus ring** — global `:focus-visible` outline (indigo ring + offset) in `index.css`.
- **Skip-to-content link** — first focusable element jumps to `main#main-content` (App.jsx).
- **Landmark** — single `<main id="main-content">` per page.
- **Dialogs** — modals use `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape-to-close, and focus the safe action on open (Cancel/Review/Detail modals).
- **Icon-only buttons** — carry `aria-label` (password show/hide, close, menu, nav badges).
- **Status not by color alone** — severity always pairs a **number + label** with its color (per the brand system); appointment status uses text badges.
- **Live regions** — the chat transcript is an `aria-live="polite"` log.
- **Reduced motion** — `prefers-reduced-motion` is honored in the marketing/immersive animations.

## Fixed in this pass
- **Registration form** — every label is now programmatically associated with its
  control via `htmlFor`/`id` (name, gender, phone, email, password, medical
  history, insurance), so screen readers announce each field correctly.

## Remaining — needs a live audit (browser + screen reader)
These require running the app with tooling, which can't be done from a bare checkout:
- [ ] Run **axe-core / Lighthouse** on each route; fix any contrast or ARIA findings.
- [ ] Full **keyboard-only** walkthrough of the booking flow (tab order, focus traps in modals, no keyboard traps).
- [ ] **Screen-reader** pass (NVDA / VoiceOver) on chat, booking, and the doctor portal.
- [ ] Verify **contrast** of muted/faint text tokens against their backgrounds at AA (4.5:1 body, 3:1 large).
- [ ] Confirm **touch targets** ≥ 44×44px on mobile (Expo screens).
- [ ] Audit remaining forms (Profile, Doctor settings, Slots) for label association.
- [ ] Add an automated **axe** check to the Playwright e2e suite as a regression gate.

## How to run a quick automated check
With the stack up (see `docs/E2E.md`), add `@axe-core/playwright` to a spec, or run
Lighthouse: `npx lighthouse http://localhost:3001 --only-categories=accessibility`.
