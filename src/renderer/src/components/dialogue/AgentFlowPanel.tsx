import { useState, useEffect } from 'react'
import type { AgentFlowSnapshot } from '../../../../shared/types'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-[var(--nw-text-muted)]',
  running: 'bg-blue-500 animate-pulse',
  done: 'bg-emerald-500',
  failed: 'bg-red-500',
  skipped: 'bg-[var(--nw-text-muted)]'
}

const STATUS_LABELS: Record<string, string> = {
  pending: '等待',
  running: '执行中',
  done: '完成',
  failed: '失败',
  skipped: '跳过'
}

const PHASE_LABELS: Record<string, string> = {
  idle: '空闲',
  planning: '规划中',
  writing: '写作中',
  critic_check: '评审中',
  revision: '修改中',
  finalizing: '定稿中',
  memory_commit: '记忆提交'
}

export default function AgentFlowPanel() {
  const [snapshot, setSnapshot] = useState<AgentFlowSnapshot | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!window.api?.onAgentFlowUpdate) return
    const unsub = window.api.onAgentFlowUpdate((data: AgentFlowSnapshot) => {
      setSnapshot(data)
    })
    return unsub
  }, [])

  if (!snapshot) return null

  const phase = PHASE_LABELS[snapshot.phase] || snapshot.phase

  return (
    <div className="rounded-md bg-[var(--nw-surface-2)] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:translate-y-[-1px] transition-all duration-150 ease-out">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-[var(--nw-text-muted)] hover:text-[var(--nw-text-secondary)] transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${snapshot.currentNodeId ? 'bg-blue-500 animate-pulse' : 'bg-[var(--nw-text-muted)]'}`} />
          <span>Agent 流程</span>
          <span className="px-1.5 py-0.5 text-[9px] bg-blue-500/20 text-blue-400 rounded">{phase}</span>
        </div>
        <svg className={`w-3 h-3 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-1">
          {snapshot.nodes.filter(n => n.type !== 'start' && n.type !== 'end').map(node => (
            <div key={node.id} className="flex items-center gap-2 py-0.5">
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[node.status] || 'bg-[var(--nw-text-muted)]'}`} />
              <span className="text-[10px] text-[var(--nw-text-secondary)] truncate flex-1">{node.label}</span>
              <span className="text-[9px] text-[var(--nw-text-muted)] shrink-0">{STATUS_LABELS[node.status] || node.status}</span>
              {node.duration && (
                <span className="text-[9px] text-[var(--nw-text-muted)] shrink-0">{(node.duration / 1000).toFixed(1)}s</span>
              )}
            </div>
          ))}

          {snapshot.criticScores.length > 0 && (
            <div className="mt-1 pt-1 border-t border-[var(--nw-border)]">
              <p className="text-[9px] text-[var(--nw-text-muted)] mb-0.5">Critic 评分</p>
              {snapshot.criticScores.map((score, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-[var(--nw-text-secondary)]">#{i + 1}</span>
                  <span className={`${score.overall >= 7 ? 'text-emerald-400' : score.overall >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {score.overall.toFixed(1)}/10
                  </span>
                  {score.issues.length > 0 && (
                    <span className="text-[var(--nw-text-muted)] truncate">{score.issues[0]}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
