import { useState } from 'react'
import type { AgentInstance, ExecutionNode, ExecutionNodeStatus } from '../../../../shared/types'

const ROLE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  planner: { label: '规划', icon: '🧭', color: 'text-blue-400 bg-blue-500/15' },
  executor: { label: '执行', icon: '⚡', color: 'text-amber-400 bg-amber-500/15' },
  critic: { label: '评审', icon: '🔍', color: 'text-purple-400 bg-purple-500/15' },
  researcher: { label: '研究', icon: '📚', color: 'text-emerald-400 bg-emerald-500/15' }
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-[var(--nw-text-muted)]',
  active: 'bg-amber-500 animate-pulse',
  blocked: 'bg-red-500'
}

const NODE_STATUS: Record<ExecutionNodeStatus, string> = {
  pending: 'bg-[var(--nw-text-muted)]',
  running: 'bg-amber-500 animate-pulse',
  done: 'bg-emerald-500',
  error: 'bg-red-500'
}

function NodeCard({ node }: { node: ExecutionNode }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`
        shrink-0 w-40 px-2.5 py-2 rounded-md
        bg-[var(--surface-1)] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]
        hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:translate-y-[-1px]
        transition-all duration-150 ease-out cursor-pointer
        ${node.status === 'running' ? 'scale-[1.02]' : ''}
      `}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${NODE_STATUS[node.status]}`} />
        <span className="text-[11px] text-[var(--text-primary)] truncate">{node.label}</span>
      </div>
      {expanded && node.output && (
        <div className="text-[10px] text-[var(--text-muted)] mt-1 max-h-16 overflow-y-auto">
          {typeof node.output === 'string' ? node.output.slice(0, 120) : JSON.stringify(node.output).slice(0, 120)}
        </div>
      )}
    </div>
  )
}

function AgentLane({ agent }: { agent: AgentInstance }) {
  const role = ROLE_LABELS[agent.role] || { label: agent.role, icon: '•', color: 'text-[var(--text-muted)]' }
  const isActive = agent.status === 'active'

  return (
    <div className={`border-b border-white/5 py-2 px-3 relative ${isActive ? 'bg-white/[0.01]' : ''}`}>
      {/* Lane header */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[agent.status]}`} />
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${role.color}`}>
          {role.icon} {role.label}
        </span>
        <span className="text-[9px] text-[var(--text-muted)]">
          {agent.graph.nodes.filter(n => n.status === 'done').length}/{agent.graph.nodes.length}
        </span>
      </div>

      {/* Horizontal node flow */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {agent.graph.nodes.length === 0 ? (
          <span className="text-[10px] text-[var(--text-muted)] italic">等待中...</span>
        ) : (
          agent.graph.nodes.map(node => (
            <NodeCard key={node.id} node={node} />
          ))
        )}
      </div>
    </div>
  )
}

export default function MultiAgentCanvas({ agents }: { agents: AgentInstance[] }) {
  const [collapsed, setCollapsed] = useState(false)
  const activeCount = agents.filter(a => a.status === 'active').length
  const totalNodes = agents.reduce((sum, a) => sum + a.graph.nodes.length, 0)
  const doneNodes = agents.reduce((sum, a) => sum + a.graph.nodes.filter(n => n.status === 'done').length, 0)

  if (agents.length === 0) return null

  return (
    <div className="rounded-md bg-[var(--surface-1)] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
          <span>多 Agent 画布</span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {agents.length} agent · {doneNodes}/{totalNodes} 节点
          </span>
        </div>
        <svg className={`w-3 h-3 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {!collapsed && (
        <div>
          {agents.map(agent => (
            <AgentLane key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}
