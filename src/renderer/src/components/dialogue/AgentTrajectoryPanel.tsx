import { useState, useEffect, useRef } from 'react'
import type { WritingTrajectory, TrajectoryEntry } from '../../../../shared/types'
import { useAppStore } from '../../stores/useAppStore'

const EVENT_ICONS: Record<string, string> = {
  phase_change: '→',
  subtask_start: '▶',
  subtask_done: '✓',
  subtask_failed: '✗',
  critic_score: '★',
  rewrite: '↺',
  complete: '●'
}

const EVENT_COLORS: Record<string, string> = {
  phase_change: 'text-blue-400',
  subtask_start: 'text-[--nw-text-muted]',
  subtask_done: 'text-emerald-400',
  subtask_failed: 'text-red-400',
  critic_score: 'text-yellow-400',
  rewrite: 'text-orange-400',
  complete: 'text-emerald-400'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function entrySummary(entry: TrajectoryEntry): string {
  const d = entry.data
  switch (entry.event) {
    case 'phase_change': return `${d.phase || ''}`
    case 'subtask_start': return `${d.description || d.subTaskId || ''}`
    case 'subtask_done': return `${d.description || d.subTaskId || ''}`
    case 'subtask_failed': return `${d.error || d.description || ''}`
    case 'critic_score': return `评分 ${d.overall ?? d.score ?? '?'}/10`
    case 'rewrite': return `策略: ${d.strategy || ''}`
    case 'complete': return d.success ? '成功' : '失败'
    default: return JSON.stringify(d).substring(0, 60)
  }
}

export default function AgentTrajectoryPanel() {
  const [trajectory, setTrajectory] = useState<WritingTrajectory | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const isStreaming = useAppStore(s => s.isStreaming)
  const prevStreaming = useRef(isStreaming)

  useEffect(() => {
    if (!window.api?.onAgentTrajectory) return
    const unsub = window.api.onAgentTrajectory((data: WritingTrajectory) => {
      setTrajectory(data)
      setExpanded(false)
      setCollapsed(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (prevStreaming.current && !isStreaming && trajectory) {
      setCollapsed(true)
      setExpanded(false)
    }
    prevStreaming.current = isStreaming
  }, [isStreaming, trajectory])

  const dialogueMessages = useAppStore(s => s.dialogueMessages)
  const msgCount = dialogueMessages.length
  useEffect(() => {
    if (!isStreaming && trajectory && collapsed) {
      const timer = setTimeout(() => {
        setTrajectory(null)
        setCollapsed(false)
        setExpanded(false)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [msgCount])

  if (!trajectory || trajectory.entries.length === 0) return null

  // Collapsed: single line summary
  if (collapsed && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-md bg-[--nw-surface-2] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:translate-y-[-1px] transition-all duration-150 ease-out px-3 py-2 flex items-center gap-2"
      >
        <span className="text-[10px] text-[--nw-text-muted]">写作轨迹</span>
        <span className="text-[9px] text-[--nw-text-muted]">{trajectory.entries.length} 条</span>
        {trajectory.totalDuration && (
          <span className="text-[9px] text-[--nw-text-muted]">{formatDuration(trajectory.totalDuration)}</span>
        )}
        <svg className="w-3 h-3 text-[--nw-text-muted] ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    )
  }

  // Expanded
  return (
    <div className="rounded-md bg-[--nw-surface-2] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:translate-y-[-1px] transition-all duration-150 ease-out">
      <button
        onClick={() => {
          if (collapsed) {
            setExpanded(false)
          } else {
            setCollapsed(true)
            setExpanded(false)
          }
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-[--nw-text-muted] hover:text-[--nw-text-secondary] transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <span>写作轨迹</span>
          <span className="text-[9px] text-[--nw-text-muted]">{trajectory.entries.length} 条记录</span>
          {trajectory.totalDuration && (
            <span className="text-[9px] text-[--nw-text-muted]">{formatDuration(trajectory.totalDuration)}</span>
          )}
        </div>
        <svg className="w-3 h-3 transition-transform duration-200 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div className="px-3 pb-2 space-y-0.5 max-h-48 overflow-y-auto">
        {trajectory.entries.map((entry, i) => (
          <div key={i} className="flex items-start gap-2 py-0.5">
            <span className={`text-[10px] shrink-0 w-3 text-center ${EVENT_COLORS[entry.event] || 'text-[--nw-text-muted]'}`}>
              {EVENT_ICONS[entry.event] || '·'}
            </span>
            <span className="text-[9px] text-[--nw-text-muted] shrink-0 w-14 font-mono">
              {formatTime(entry.timestamp)}
            </span>
            <span className="text-[10px] text-[--nw-text-secondary] truncate flex-1">
              {entrySummary(entry)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
