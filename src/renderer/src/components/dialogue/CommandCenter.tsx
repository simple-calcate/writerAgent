import type { AgentRunState, MultiAgentRunState } from '../../../../shared/types'

const V3_BADGES: Record<string, { label: string; color: string }> = {
  idle: { label: '就绪', color: 'bg-[var(--surface-2)] text-[var(--text-muted)]' },
  running: { label: '运行中', color: 'bg-amber-500/20 text-amber-400' },
  paused: { label: '已暂停', color: 'bg-yellow-500/20 text-yellow-400' },
  done: { label: '已完成', color: 'bg-emerald-500/20 text-emerald-400' },
  error: { label: '错误', color: 'bg-red-500/20 text-red-400' }
}

const V4_BADGES: Record<string, { label: string; color: string }> = {
  running: { label: '运行中', color: 'bg-amber-500/20 text-amber-400' },
  paused: { label: '已暂停', color: 'bg-yellow-500/20 text-yellow-400' },
  replaying: { label: '回放中', color: 'bg-blue-500/20 text-blue-400' },
  done: { label: '已完成', color: 'bg-emerald-500/20 text-emerald-400' }
}

export default function CommandCenter({
  runState,
  onPause,
  onResume,
  onReplay,
  children
}: {
  runState: AgentRunState | MultiAgentRunState
  onPause?: () => void
  onResume?: () => void
  onReplay?: () => void
  children: React.ReactNode
}) {
  const badge = V4_BADGES[runState] ?? V3_BADGES[runState]
  if (!badge) return <div className="border-t border-white/5 p-3 bg-[var(--surface-1)]">{children}</div>

  return (
    <div className="border-t border-white/5 p-3 bg-[var(--surface-1)]">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.color}`}>
          {badge.label}
        </span>
        <div className="flex gap-1.5">
          {runState === 'running' && onPause && (
            <button onClick={onPause} className="text-[10px] text-[var(--text-muted)] hover:text-yellow-400 px-2 py-0.5 rounded hover:bg-yellow-500/10 transition-colors">
              暂停
            </button>
          )}
          {(runState === 'paused' || runState === 'done') && onResume && (
            <button onClick={onResume} className="text-[10px] text-[var(--text-muted)] hover:text-emerald-400 px-2 py-0.5 rounded hover:bg-emerald-500/10 transition-colors">
              继续
            </button>
          )}
          {runState === 'done' && onReplay && (
            <button onClick={onReplay} className="text-[10px] text-[var(--text-muted)] hover:text-blue-400 px-2 py-0.5 rounded hover:bg-blue-500/10 transition-colors">
              回放
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
