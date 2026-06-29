import { useState, useEffect } from 'react'

interface RewriteApproval {
  approvalId: string
  taskId: string
  score: {
    overall: number
    structure: number
    pacing: number
    conflict: number
    infoDensity: number
    styleConsistency: number
    issues: string[]
    suggestions: string[]
  }
  strategy: string
  instruction: string
  round: number
}

const STRATEGY_LABELS: Record<string, string> = {
  full_rewrite: '全文重写',
  targeted_fix: '针对性修复',
  style_pass: '文风调整',
  pacing_adjust: '节奏优化',
  conflict_boost: '冲突增强'
}

export default function RewriteApprovalCard() {
  const [approval, setApproval] = useState<RewriteApproval | null>(null)

  useEffect(() => {
    if (!window.api?.onAgentRewriteApproval) return
    const unsub = window.api.onAgentRewriteApproval((data) => {
      setApproval(data)
    })
    return unsub
  }, [])

  if (!approval) return null

  const handleApprove = () => {
    window.api.agentApproveRewrite(approval!.approvalId, true)
    setApproval(null)
  }

  const handleReject = () => {
    window.api.agentApproveRewrite(approval!.approvalId, false)
    setApproval(null)
  }

  const scoreColor = approval.score.overall >= 7 ? 'text-emerald-400' : approval.score.overall >= 5 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="mt-2 rounded-md bg-yellow-900/10 shadow-[0_0_0_1px_rgba(234,179,8,0.15)] hover:shadow-[0_0_0_1px_rgba(234,179,8,0.25)] hover:translate-y-[-1px] transition-all duration-150 ease-out overflow-hidden">
      <div className="px-3 py-2 border-b border-yellow-500/15">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-xs">⚠</span>
          <span className="text-[11px] text-yellow-300 font-medium">请求重写（第 {approval.round} 轮）</span>
        </div>
      </div>

      <div className="px-3 py-2 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[var(--nw-text-muted)]">综合评分</span>
          <span className={`text-sm font-medium ${scoreColor}`}>{approval.score.overall}/10</span>
          <span className="text-[10px] text-[var(--nw-text-muted)]">|</span>
          <span className="text-[10px] text-[var(--nw-text-muted)]">策略</span>
          <span className="text-[10px] text-blue-400">{STRATEGY_LABELS[approval.strategy] || approval.strategy}</span>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {[
            { label: '结构', value: approval.score.structure },
            { label: '节奏', value: approval.score.pacing },
            { label: '冲突', value: approval.score.conflict },
            { label: '密度', value: approval.score.infoDensity },
            { label: '文风', value: approval.score.styleConsistency }
          ].map(dim => (
            <span key={dim.label} className={`text-[9px] px-1.5 py-0.5 rounded ${
              dim.value >= 7 ? 'bg-emerald-900/30 text-emerald-400' : dim.value >= 5 ? 'bg-yellow-900/30 text-yellow-400' : 'bg-red-900/30 text-red-400'
            }`}>
              {dim.label} {dim.value}
            </span>
          ))}
        </div>

        {approval.score.issues.length > 0 && (
          <div>
            <p className="text-[9px] text-[var(--nw-text-muted)] mb-0.5">问题</p>
            {approval.score.issues.slice(0, 3).map((issue, i) => (
              <p key={i} className="text-[10px] text-[var(--nw-text-secondary)]">· {issue}</p>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleApprove}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] py-1.5 rounded-md transition-all duration-150 hover:translate-y-[-1px]"
          >
            同意重写
          </button>
          <button
            onClick={handleReject}
            className="flex-1 bg-[var(--nw-surface-2)] hover:bg-[var(--nw-surface-1)] text-[var(--nw-text-secondary)] text-[11px] py-1.5 rounded-md transition-all duration-150 hover:translate-y-[-1px]"
          >
            跳过，使用当前版本
          </button>
        </div>
      </div>
    </div>
  )
}
