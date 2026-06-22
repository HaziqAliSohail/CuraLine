import { useEffect, useRef, useState } from 'react'
import { useReveal } from '../../hooks/useReveal'

/** Counts from 0 → `to` over `duration` ms when scrolled into view. */
export default function CountUp({ to, duration = 1600, prefix = '', suffix = '', decimals = 0 }) {
  const [ref, shown] = useReveal()
  const [val, setVal] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!shown || started.current) return
    started.current = true
    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      // easeOutExpo for a satisfying settle
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setVal(to * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [shown, to, duration])

  const display = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString()
  return <span ref={ref}>{prefix}{display}{suffix}</span>
}
