import { useReveal } from '../../hooks/useReveal'

/**
 * Wraps children so they fade/slide in the first time they enter the viewport.
 * `delay` (ms) staggers siblings.
 */
export default function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const [ref, shown] = useReveal()
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: shown ? undefined : 0,
        animation: shown ? `reveal-up 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards` : 'none',
      }}
    >
      {children}
    </Tag>
  )
}
