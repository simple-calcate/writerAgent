import { useEffect, useRef } from 'react'
import { useVisualStore } from '../stores/useVisualStore'

export default function MouseGlow() {
  const { effectsEnabled, mouseGlow, mouseGlowColor, mouseGlowRadius, mouseGlowIntensity } = useVisualStore()
  const ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const posRef = useRef({ x: -1000, y: -1000 })

  useEffect(() => {
    if (!effectsEnabled || !mouseGlow) return

    const el = ref.current
    if (!el) return

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY }
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          const { x, y } = posRef.current
          el.style.background = `radial-gradient(circle ${mouseGlowRadius}px at ${x}px ${y}px, ${mouseGlowColor}, transparent 100%)`
          rafRef.current = 0
        })
      }
    }

    document.addEventListener('mousemove', onMove)
    return () => {
      document.removeEventListener('mousemove', onMove)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [effectsEnabled, mouseGlow, mouseGlowColor, mouseGlowRadius])

  if (!effectsEnabled || !mouseGlow) return null

  return (
    <div
      ref={ref}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 100, opacity: mouseGlowIntensity }}
    />
  )
}
