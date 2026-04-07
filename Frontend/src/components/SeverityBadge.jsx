const levels = {
  1: { label: 'Routine', color: 'bg-green-100 text-green-700' },
  2: { label: 'Low', color: 'bg-lime-100 text-lime-700' },
  3: { label: 'Moderate', color: 'bg-yellow-100 text-yellow-700' },
  4: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  5: { label: 'Critical', color: 'bg-red-100 text-red-700' },
}

export default function SeverityBadge({ score }) {
  const level = levels[score] || levels[1]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${level.color}`}>
      {score}/5 &mdash; {level.label}
    </span>
  )
}
