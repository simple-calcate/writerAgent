import { useState, useEffect } from 'react'
import type { AgentFlowSnapshot } from '../../../../shared/types'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-600',
  running: 'bg-blue-500 animate-pulse',
  done: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-gray-500'
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
    <div className="border-t border-gray-700/40 bg-gray-800/20">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${snapshot.currentNodeId ? 'bg-blue-500 animate-pulse' : 'bg-gray-600'}`} />
          <span>Agent 流程</span>
          <span className="px-1.5 py-0.5 text-[9px] bg-blue-500/20 text-blue-400 rounded">{phase}</span>
        </div>
        <svg className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-1">
          {snapshot.nodes.filter(n => n.type !== 'start' && n.type !== 'end').map(node => (
            <div key={node.id} className="flex items-center gap-2 py-0.5">
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[node.status] || 'bg-gray-600'}`} />
              <span className="text-[10px] text-gray-300 truncate flex-1">{node.label}</span>
              <span className="text-[9px] text-gray-600 shrink-0">{STATUS_LABELS[node.status] || node.status}</span>
              {node.duration && (
                <span className="text-[9px] text-gray-600 shrink-0">{(node.duration / 1000).toFixed(1)}s</span>
              )}
            </div>
          ))}

          {snapshot.criticScores.length > 0 && (
            <div className="mt-1 pt-1 border-t border-gray-700/30">
              <p className="text-[9px] text-gray-600 mb-0.5">Critic 评分</p>
              {snapshot.criticScores.map((score, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-gray-400">#{i + 1}</span>
                  <span className={`${score.overall >= 7 ? 'text-green-400' : score.overall >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {score.overall.toFixed(1)}/10
                  </span>
                  {score.issues.length > 0 && (
                    <span className="text-gray-600 truncate">{score.issues[0]}</span>
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
