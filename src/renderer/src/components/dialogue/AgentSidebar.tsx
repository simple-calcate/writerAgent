import type { AgentInstance, AgentStatus } from '../../../../shared/types'

const ROLE_LABELS: Record<string, { label: string; icon: string }> = {
  planner: { label: '规划', icon: '🧭' },
  executor: { label: '执行', icon: '⚡' },
  critic: { label: '评审', icon: '🔍' },
  researcher: { label: '研究', icon: '📚' }
}

const STATUS_DOT: Record<AgentStatus, string> = {
  idle: 'bg-[var(--nw-text-muted)]',
  active: 'bg-amber-500 animate-pulse',
  blocked: 'bg-red-500'
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: '空闲',
  active: '活跃',
  blocked: '阻塞'
}

export default function AgentSidebar({
  agents,
  selectedId,
  onSelect
}: {
  agents: AgentInstance[]
  selectedId?: string
  onSelect?: (agentId: string) => void
}) {
  if (agents.length === 0) return null

  return (
    <div className="rounded-md bg-[var(--surface-1)] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] p-2 space-y-1">
      <p className="text-[10px] text-[var(--text-muted)] px-1 mb-1">Agents</p>
      {agents.map(agent => {
        const role = ROLE_LABELS[agent.role] || { label: agent.role, icon: '•' }
        const isSelected = selectedId === agent.id
        const doneCount = agent.graph.nodes.filter(n => n.status === 'done').length

        return (
          <button
            key={agent.id}
            onClick={() => onSelect?.(agent.id)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all duration-150 ${
              isSelected ? 'bg-white/5' : 'hover:bg-white/[0.03]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[agent.status]}`} />
            <span className="text-[11px]">{role.icon}</span>
            <span className="text-[11px] text-[var(--text-secondary)] flex-1 truncate">{role.label}</span>
            <span className="text-[9px] text-[var(--text-muted)]">{doneCount}/{agent.graph.nodes.length}</span>
          </button>
        )
      })}
    </div>
  )
}
