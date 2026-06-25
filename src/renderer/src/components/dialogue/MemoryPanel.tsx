import { useState, useEffect } from 'react'
import type { MemoryState } from '../../../../shared/types'

interface BackendMemory {
  episodic: string
  semantic: string
  style: string
  dialogue: string
}

interface MemoryPanelProps {
  memory: MemoryState
  projectId?: string | null
  refreshKey?: number
}

export default function MemoryPanel({ memory, projectId, refreshKey }: MemoryPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showLongTerm, setShowLongTerm] = useState(false)
  const [showBackend, setShowBackend] = useState(false)
  const [backendMemory, setBackendMemory] = useState<BackendMemory | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    window.api.memoryGetContext(projectId).then(ctx => {
      if (ctx && (ctx.episodic || ctx.semantic || ctx.style || ctx.dialogue)) {
        setBackendMemory({
          episodic: ctx.episodic,
          semantic: ctx.semantic,
          style: ctx.style,
          dialogue: ctx.dialogue
        })
      } else {
        setBackendMemory(null)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [projectId, refreshKey])

  const hasRuntime = memory.shortTerm.length > 0 || memory.longTerm.length > 0
  const hasBackend = backendMemory && (backendMemory.episodic || backendMemory.semantic || backendMemory.style || backendMemory.dialogue)

  if (!hasRuntime && !hasBackend && !loading) return null

  return (
    <div className="rounded-md bg-[--surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-[--text-muted] hover:text-[--text-secondary] transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <span>记忆</span>
          <span className="text-[10px] text-[--text-muted]">
            {memory.shortTerm.length + memory.longTerm.length}{hasBackend ? `+${backendMemory ? 4 : 0}` : ''} 条
          </span>
        </div>
        <svg className={`w-3 h-3 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-2">
          {/* Runtime: Short-term */}
          {hasRuntime && (
            <div>
              <p className="text-[10px] text-[--text-muted] mb-1">运行时 · 短期</p>
              {memory.shortTerm.length > 0 ? (
                <div className="space-y-0.5">
                  {memory.shortTerm.slice(-5).map((m, i) => (
                    <div key={i} className="text-[11px] text-[--text-secondary] truncate px-2 py-0.5 rounded bg-[--surface-2]">
                      {m}
                    </div>
                  ))}
                  {memory.shortTerm.length > 5 && (
                    <p className="text-[9px] text-[--text-muted] pl-2">+{memory.shortTerm.length - 5} 更多</p>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-[--text-muted] italic">暂无</p>
              )}
            </div>
          )}

          {/* Runtime: Long-term toggle */}
          {memory.longTerm.length > 0 && (
            <div>
              <button
                onClick={() => setShowLongTerm(!showLongTerm)}
                className="text-[10px] text-[--text-muted] hover:text-[--text-secondary] transition-colors"
              >
                运行时 · 长期 ({memory.longTerm.length}) {showLongTerm ? '▾' : '▸'}
              </button>
              {showLongTerm && (
                <div className="mt-1 space-y-0.5">
                  {memory.longTerm.slice(-5).map((m, i) => (
                    <div key={i} className="text-[11px] text-[--text-secondary] truncate px-2 py-0.5 rounded bg-[--surface-2]">
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Backend memory toggle */}
          {hasBackend && (
            <div>
              <button
                onClick={() => setShowBackend(!showBackend)}
                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                持久记忆 {showBackend ? '▾' : '▸'}
              </button>
              {showBackend && backendMemory && (
                <div className="mt-1 space-y-1.5">
                  {backendMemory.episodic && (
                    <BackendSection label="事件记忆" content={backendMemory.episodic} />
                  )}
                  {backendMemory.semantic && (
                    <BackendSection label="语义记忆" content={backendMemory.semantic} />
                  )}
                  {backendMemory.style && (
                    <BackendSection label="风格记忆" content={backendMemory.style} />
                  )}
                  {backendMemory.dialogue && (
                    <BackendSection label="对话摘要" content={backendMemory.dialogue} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BackendSection({ label, content }: { label: string; content: string }) {
  const [expanded, setExpanded] = useState(false)
  const lines = content.split('\n').filter(Boolean)
  const preview = lines.slice(0, 3).join(' ')

  return (
    <div className="rounded bg-[--surface-2] px-2 py-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-[--text-muted] hover:text-[--text-secondary] transition-colors w-full text-left"
      >
        {label} ({lines.length} 行) {expanded ? '▾' : '▸'}
      </button>
      {expanded ? (
        <div className="mt-0.5 text-[10px] text-[--text-secondary] whitespace-pre-wrap max-h-40 overflow-y-auto">
          {content}
        </div>
      ) : (
        <p className="text-[10px] text-[--text-muted] truncate mt-0.5">{preview}</p>
      )}
    </div>
  )
}
