import type { MultiAgentRun, MultiAgentRunState } from '../../../../shared/types'

const STATE_LABELS: Record<MultiAgentRunState, string> = {
  running: '运行中',
  paused: '已暂停',
  replaying: '回放中',
  done: '已完成'
}

const STATE_COLORS: Record<MultiAgentRunState, string> = {
  running: 'text-amber-400',
  paused: 'text-yellow-400',
  replaying: 'text-blue-400',
  done: 'text-emerald-400'
}

export default function ExecutionInspector({ run }: { run: MultiAgentRun }) {
  const totalNodes = run.agents.reduce((sum, a) => sum + a.graph.nodes.length, 0)
  const doneNodes = run.agents.reduce((sum, a) => sum + a.graph.nodes.filter(n => n.status === 'done').length, 0)
  const activeAgents = run.agents.filter(a => a.status === 'active').length

  return (
    <div className="rounded-md bg-[--surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] p-3 space-y-2">
      {/* State */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[--text-muted]">状态</span>
        <span className={`text-[11px] font-medium ${STATE_COLORS[run.state]}`}>
          {STATE_LABELS[run.state]}
        </span>
      </div>

      {/* Agents */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[--text-muted]">Agents</span>
        <span className="text-[11px] text-[--text-secondary]">
          {run.agents.length}
          {activeAgents > 0 && <span className="text-amber-400 ml-1">({activeAgents} 活跃)</span>}
        </span>
      </div>

      {/* Nodes */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[--text-muted]">节点</span>
        <span className="text-[11px] text-[--text-secondary]">{doneNodes}/{totalNodes}</span>
      </div>

      {/* Memory */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[--text-muted]">记忆</span>
        <span className="text-[11px] text-[--text-secondary]">
          {run.sharedMemory.facts.length} 事实 · {run.sharedMemory.decisions.length} 决策
          {run.sharedMemory.conflictLog.length > 0 && (
            <span className="text-yellow-400 ml-1">· {run.sharedMemory.conflictLog.length} 冲突</span>
          )}
        </span>
      </div>

      {/* Timeline entries */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[--text-muted]">时间线</span>
        <span className="text-[11px] text-[--text-secondary]">{run.timeline.length} 条</span>
      </div>
    </div>
  )
}
