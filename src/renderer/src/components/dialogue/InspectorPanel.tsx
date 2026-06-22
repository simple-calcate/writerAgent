import type { AgentRun, AgentRunState } from '../../../../shared/types'

const STATE_LABELS: Record<AgentRunState, string> = {
  idle: '空闲',
  running: '运行中',
  paused: '已暂停',
  done: '已完成',
  error: '错误'
}

const STATE_COLORS: Record<AgentRunState, string> = {
  idle: 'text-[--text-muted]',
  running: 'text-amber-400',
  paused: 'text-yellow-400',
  done: 'text-emerald-400',
  error: 'text-red-400'
}

function ContextBar({ used, total }: { used: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const barColor = percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-yellow-500' : 'bg-blue-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[--text-muted]">上下文</span>
        <span className="text-[10px] text-[--text-muted]">
          {used.toLocaleString()} / {total.toLocaleString()} tok
        </span>
      </div>
      <div className="h-1 bg-[--surface-2] rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-300`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export default function InspectorPanel({ run }: { run: AgentRun }) {
  const activeNodes = run.nodes.filter(n => n.status === 'running').length
  const doneNodes = run.nodes.filter(n => n.status === 'done').length
  const totalTokens = run.nodes.reduce((sum, n) => sum + (n.metadata?.tokens ?? 0), 0)

  return (
    <div className="rounded-md bg-[--surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] p-3 space-y-2.5">
      {/* State row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[--text-muted]">状态</span>
        <span className={`text-[11px] font-medium ${STATE_COLORS[run.state]}`}>
          {STATE_LABELS[run.state]}
        </span>
      </div>

      {/* Node stats */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[--text-muted]">节点</span>
        <span className="text-[11px] text-[--text-secondary]">
          {doneNodes}/{run.nodes.length}
          {activeNodes > 0 && <span className="text-amber-400 ml-1">({activeNodes} 运行中)</span>}
        </span>
      </div>

      {/* Total tokens */}
      {totalTokens > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[--text-muted]">Tokens</span>
          <span className="text-[11px] text-[--text-secondary]">{totalTokens.toLocaleString()}</span>
        </div>
      )}

      {/* Compression ratio */}
      {run.context.compressionRatio < 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[--text-muted]">压缩率</span>
          <span className="text-[11px] text-[--text-secondary]">
            {(run.context.compressionRatio * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Context bar */}
      <ContextBar used={run.context.usedTokens} total={run.context.windowSize} />
    </div>
  )
}
