import { useState } from 'react'
import type { ExecutionNode, ExecutionEdge, ExecutionNodeStatus } from '../../../../shared/types'

const STATUS_COLORS: Record<ExecutionNodeStatus, string> = {
  pending: 'bg-[--nw-text-muted]',
  running: 'bg-amber-500 animate-pulse',
  done: 'bg-emerald-500',
  error: 'bg-red-500'
}

const TYPE_LABELS: Record<string, string> = {
  tool: '🔧',
  thinking: '💭',
  retrieval: '🔍',
  rewrite: '✏️'
}

function StatusDot({ status }: { status: ExecutionNodeStatus }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
      </span>
    )
  }
  return <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
}

function ExecutionNodeView({ node }: { node: ExecutionNode }) {
  const [expanded, setExpanded] = useState(false)
  const isRunning = node.status === 'running'

  return (
    <div
      className={`
        px-3 py-2 rounded-md
        bg-[--surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]
        hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:translate-y-[-1px]
        transition-all duration-150 ease-out cursor-pointer
        ${isRunning ? 'scale-[1.02]' : ''}
      `}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <StatusDot status={node.status} />
        <span className="text-[10px]">{TYPE_LABELS[node.type] || '•'}</span>
        <span className="text-[12px] text-[--text-primary] flex-1 truncate">{node.label}</span>
        {node.startTime && node.endTime && (
          <span className="text-[10px] text-[--text-muted]">
            {((node.endTime - node.startTime) / 1000).toFixed(1)}s
          </span>
        )}
        {node.metadata?.tokens && (
          <span className="text-[10px] text-[--text-muted]">
            {node.metadata.tokens} tok
          </span>
        )}
      </div>
      {expanded && node.output && (
        <div className="text-[11px] text-[--text-muted] mt-1.5 pl-6 max-h-24 overflow-y-auto">
          {typeof node.output === 'string'
            ? node.output.slice(0, 200) + (node.output.length > 200 ? '...' : '')
            : JSON.stringify(node.output).slice(0, 200)}
        </div>
      )}
    </div>
  )
}

function ExecutionEdgeView({ fromNode, toNode }: { fromNode?: ExecutionNode; toNode?: ExecutionNode }) {
  if (!fromNode || !toNode) return null
  return (
    <div className="flex items-center justify-center py-0.5">
      <div className="w-px h-3 bg-white/10" />
    </div>
  )
}

export default function ExecutionGraphView({ nodes, edges }: { nodes: ExecutionNode[]; edges: ExecutionEdge[] }) {
  const [collapsed, setCollapsed] = useState(false)

  if (nodes.length === 0) return null

  const activeCount = nodes.filter(n => n.status === 'running').length
  const doneCount = nodes.filter(n => n.status === 'done').length

  return (
    <div className="rounded-md bg-[--surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-[--text-muted] hover:text-[--text-secondary] transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
          <span>执行图</span>
          <span className="text-[10px] text-[--text-muted]">
            {doneCount}/{nodes.length}
          </span>
        </div>
        <svg className={`w-3 h-3 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-0">
          {nodes.map((node, idx) => (
            <div key={node.id}>
              <ExecutionNodeView node={node} />
              {idx < nodes.length - 1 && (
                <ExecutionEdgeView
                  fromNode={node}
                  toNode={nodes[idx + 1]}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
