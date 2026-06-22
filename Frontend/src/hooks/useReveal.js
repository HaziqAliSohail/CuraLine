import { useEffect, useRef, useState } from 'react'

/**
 * Reveal-on-scroll: returns [ref, shown]. `shown` flips true the first time the
 * element scrolls into view, so children can animate in. IntersectionObserver
 * based - no dependencies, no scroll listeners.
 */
export function useReveal(options = {}) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px', ...options },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [shown])

  return [ref, shown]
}
