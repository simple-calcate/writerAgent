import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface VisualSettings {
  effectsEnabled: boolean
  // Background
  backgroundImage: string | null
  backgroundOpacity: number
  backgroundBlur: number
  backgroundColor: string
  backgroundFit: 'cover' | 'contain' | 'fill'
  backgroundScale: number
  // Frosted glass
  frostedGlass: boolean
  glassBlur: number
  glassTint: string
  // Mouse glow
  mouseGlow: boolean
  mouseGlowColor: string
  mouseGlowRadius: number
  mouseGlowIntensity: number
  // Rain
  rainEffect: boolean
  rainDensity: number
  rainSpeed: number
  rainOpacity: number
  // Wallpaper Engine
  wallpaperEngineEnabled: boolean
  wallpaperEnginePath: string | null
}

interface VisualStore extends VisualSettings {
  updateSettings: (partial: Partial<VisualSettings>) => void
  resetSettings: () => void
}

const DEFAULT_SETTINGS: VisualSettings = {
  effectsEnabled: false,
  backgroundImage: null,
  backgroundOpacity: 0.3,
  backgroundBlur: 0,
  backgroundColor: '#111827',
  backgroundFit: 'cover',
  backgroundScale: 100,
  frostedGlass: false,
  glassBlur: 12,
  glassTint: 'rgba(17,24,39,0.7)',
  mouseGlow: false,
  mouseGlowColor: 'rgba(100,150,255,0.15)',
  mouseGlowRadius: 200,
  mouseGlowIntensity: 0.5,
  rainEffect: false,
  rainDensity: 150,
  rainSpeed: 2,
  rainOpacity: 0.3,
  wallpaperEngineEnabled: false,
  wallpaperEnginePath: null
}

export const useVisualStore = create<VisualStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      updateSettings: (partial) => set((state) => ({ ...state, ...partial })),
      resetSettings: () => set(DEFAULT_SETTINGS)
    }),
    { name: 'nw-visual-settings' }
  )
)
