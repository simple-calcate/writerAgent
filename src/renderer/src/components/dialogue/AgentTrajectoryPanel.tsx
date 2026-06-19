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
  subtask_start: 'text-gray-400',
  subtask_done: 'text-green-400',
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

  // 流式结束后折叠为一行
  useEffect(() => {
    if (prevStreaming.current && !isStreaming && trajectory) {
      setCollapsed(true)
      setExpanded(false)
    }
    prevStreaming.current = isStreaming
  }, [isStreaming, trajectory])

  // 新对话开始时（用户发消息且不在流式中）清除轨迹
  const dialogueMessages = useAppStore(s => s.dialogueMessages)
  const msgCount = dialogueMessages.length
  useEffect(() => {
    if (!isStreaming && trajectory && collapsed) {
      // 用户发了新消息 → 清除轨迹
      const timer = setTimeout(() => {
        setTrajectory(null)
        setCollapsed(false)
        setExpanded(false)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [msgCount])

  if (!trajectory || trajectory.entries.length === 0) return null

  // 折叠状态：只显示一行摘要
  if (collapsed && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full border-t border-gray-700/40 bg-gray-800/20 px-3 py-1.5 flex items-center gap-2 hover:bg-gray-800/30 transition-colors"
      >
        <span className="text-[10px] text-gray-500">写作轨迹</span>
        <span className="text-[9px] text-gray-600">{trajectory.entries.length} 条</span>
        {trajectory.totalDuration && (
          <span className="text-[9px] text-gray-600">{formatDuration(trajectory.totalDuration)}</span>
        )}
        <svg className="w-3 h-3 text-gray-600 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    )
  }

  // 展开状态
  return (
    <div className="border-t border-gray-700/40 bg-gray-800/20">
      <button
        onClick={() => {
          if (collapsed) {
            setExpanded(false)
          } else {
            setCollapsed(true)
            setExpanded(false)
          }
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>写作轨迹</span>
          <span className="text-[9px] text-gray-600">{trajectory.entries.length} 条记录</span>
          {trajectory.totalDuration && (
            <span className="text-[9px] text-gray-600">{formatDuration(trajectory.totalDuration)}</span>
          )}
        </div>
        <svg className="w-3 h-3 transition-transform rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div className="px-3 pb-2 space-y-0.5 max-h-48 overflow-y-auto">
        {trajectory.entries.map((entry, i) => (
          <div key={i} className="flex items-start gap-2 py-0.5">
            <span className={`text-[10px] shrink-0 w-3 text-center ${EVENT_COLORS[entry.event] || 'text-gray-500'}`}>
              {EVENT_ICONS[entry.event] || '·'}
            </span>
            <span className="text-[9px] text-gray-600 shrink-0 w-14 font-mono">
              {formatTime(entry.timestamp)}
            </span>
            <span className="text-[10px] text-gray-400 truncate flex-1">
              {entrySummary(entry)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
