const levels = {
  1: { label: 'Routine',  color: 'bg-emerald-50 text-emerald-700',  dot: 'bg-emerald-400', desc: 'Minor issue — can wait days or weeks' },
  2: { label: 'Low',      color: 'bg-lime-50 text-lime-700',        dot: 'bg-lime-400',     desc: 'Should be seen within a week' },
  3: { label: 'Moderate', color: 'bg-amber-50 text-amber-700',      dot: 'bg-amber-400',    desc: 'Should be seen within 1–3 days' },
  4: { label: 'High',     color: 'bg-orange-50 text-orange-700',    dot: 'bg-orange-400',   desc: 'Should be seen today (urgent)' },
  5: { label: 'Critical', color: 'bg-red-50 text-red-700',          dot: 'bg-red-500',      desc: 'Emergency — needs immediate attention' },
}

export default function SeverityBadge({ score }) {
  const level = levels[score] || levels[1]
  const isCritical = score === 5

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${level.color}`}
      title={level.desc}
      aria-label={`Severity: ${score} out of 5 — ${level.label}. ${level.desc}`}
    >
      {/* Dot — pulses for critical */}
      <span className={`relative flex-shrink-0 w-1.5 h-1.5 rounded-full ${level.dot}`}>
        {isCritical && (
          <span className={`absolute inset-0 rounded-full ${level.dot} animate-pulse-ring`} />
        )}
      </span>
      {score}/5 — {level.label}
    </span>
  )
}
