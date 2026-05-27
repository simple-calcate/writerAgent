import { useEffect } from 'react'
import { useVisualStore } from '../stores/useVisualStore'

export function useVisualTheme() {
  const settings = useVisualStore()

  useEffect(() => {
    const root = document.documentElement
    const enabled = settings.effectsEnabled

    // Background color
    root.style.setProperty('--nw-bg-color', settings.backgroundColor)

    // Panel backgrounds
    if (enabled && settings.frostedGlass) {
      root.style.setProperty('--nw-panel-bg-glass', settings.glassTint)
      root.style.setProperty('--nw-glass-blur', `${settings.glassBlur}px`)
      root.style.setProperty('--nw-panel-border', 'rgba(55,65,81,0.4)')
    } else {
      root.style.setProperty('--nw-panel-bg-glass', 'rgba(31,41,55,1)')
      root.style.setProperty('--nw-glass-blur', '0px')
      root.style.setProperty('--nw-panel-border', 'rgba(55,65,81,0.6)')
    }
  }, [
    settings.effectsEnabled,
    settings.backgroundColor,
    settings.frostedGlass,
    settings.glassBlur,
    settings.glassTint
  ])
}
