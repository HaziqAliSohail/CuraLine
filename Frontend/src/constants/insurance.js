// Canonical insurance plan names - the single source of truth for the
// registration picker, profile picker, and doctor search filter.
// Filtering does exact string matching against doctors' accepted plans,
// so every surface MUST use these exact strings.
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
