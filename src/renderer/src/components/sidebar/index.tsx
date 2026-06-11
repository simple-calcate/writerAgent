import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { SlidePanel } from './ContextMenu'
import { ProjectsLevel } from './ProjectsLevel'
import { ProjectLevel } from './ProjectLevel'
import { VolumeLevel } from './VolumeLevel'
import { ChapterLevel } from './ChapterLevel'
import { AIConfigLevel } from './AIConfigLevel'

const LEVEL_ORDER = ['projects', 'project', 'volume', 'chapter', 'ai-config']

export default function Sidebar({ width }: { width?: number }) {
  const { navLevel } = useAppStore()
  const prevLevel = useRef(navLevel)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>(() => {
    const idx = LEVEL_ORDER.indexOf(navLevel)
    return idx >= 1 ? 'left' : 'right'
  })

  useEffect(() => {
    const prevIdx = LEVEL_ORDER.indexOf(prevLevel.current)
    const nextIdx = LEVEL_ORDER.indexOf(navLevel)
    if (prevIdx !== nextIdx) {
      setSlideDirection(nextIdx >= prevIdx ? 'left' : 'right')
    }
    prevLevel.current = navLevel
  }, [navLevel])

  // Which panels should be visible (active or transitioning out)
  const panels: { key: string; level: string; component: React.ReactNode }[] = [
    { key: 'projects', level: 'projects', component: <ProjectsLevel /> },
    { key: 'project', level: 'project', component: <ProjectLevel /> },
    { key: 'volume', level: 'volume', component: <VolumeLevel /> },
    { key: 'chapter', level: 'chapter', component: <ChapterLevel /> },
    { key: 'ai-config', level: 'ai-config', component: <AIConfigLevel /> }
  ]

  return (
    <div className="glass-panel border-r flex flex-col h-full select-none shrink-0 relative overflow-hidden" style={{ width: width ?? 256 }}>
      {panels.map(p => (
        <SlidePanel key={p.key} active={navLevel === p.level} direction={slideDirection}>
          {p.component}
        </SlidePanel>
      ))}
    </div>
  )
}
