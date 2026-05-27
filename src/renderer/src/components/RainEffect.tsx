import { useEffect, useRef } from 'react'
import { useVisualStore } from '../stores/useVisualStore'

interface Drop {
  x: number
  y: number
  speed: number
  length: number
  opacity: number
  wind: number
}

export default function RainEffect() {
  const { effectsEnabled, rainEffect, rainDensity, rainSpeed, rainOpacity } = useVisualStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!effectsEnabled || !rainEffect) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    let animId = 0
    let drops: Drop[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const initDrops = () => {
      drops = Array.from({ length: rainDensity }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: 2 + Math.random() * 3,
        length: 10 + Math.random() * 15,
        opacity: 0.1 + Math.random() * 0.3,
        wind: (Math.random() - 0.5) * 0.5
      }))
    }
    initDrops()

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const drop of drops) {
        ctx.beginPath()
        ctx.moveTo(drop.x, drop.y)
        ctx.lineTo(drop.x + drop.wind * drop.length * 0.3, drop.y + drop.length)
        ctx.strokeStyle = `rgba(180, 200, 220, ${drop.opacity * rainOpacity})`
        ctx.lineWidth = 1
        ctx.stroke()

        drop.y += drop.speed * rainSpeed
        drop.x += drop.wind

        if (drop.y > canvas.height) {
          drop.y = -drop.length
          drop.x = Math.random() * canvas.width
        }
      }

      animId = requestAnimationFrame(draw)
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId)
      } else {
        animId = requestAnimationFrame(draw)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [effectsEnabled, rainEffect, rainDensity, rainSpeed, rainOpacity])

  if (!effectsEnabled || !rainEffect) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[3] pointer-events-none"
    />
  )
}
