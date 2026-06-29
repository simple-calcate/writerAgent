import { useState } from 'react'
import type { GlobalMemory } from '../../../../shared/types'

export default function MemoryGraphView({ memory }: { memory: GlobalMemory }) {
  const [collapsed, setCollapsed] = useState(false)
  const [showDecisions, setShowDecisions] = useState(false)
  const [showConflicts, setShowConflicts] = useState(false)

  const totalItems = memory.facts.length + memory.decisions.length + memory.conflictLog.length
  if (totalItems === 0) return null

  return (
    <div className="rounded-md bg-[var(--surface-1)] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <span>共享记忆</span>
          <span className="text-[10px] text-[var(--text-muted)]">{totalItems} 条</span>
        </div>
        <svg className={`w-3 h-3 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-2">
          {/* Facts */}
          <div>
            <p className="text-[10px] text-[var(--text-muted)] mb-1">事实</p>
            {memory.facts.length > 0 ? (
              <div className="space-y-0.5">
                {memory.facts.slice(-5).map((f, i) => (
                  <div key={i} className="text-[11px] text-[var(--text-secondary)] px-2 py-0.5 rounded bg-[var(--surface-2)] truncate">
                    {f}
                  </div>
                ))}
                {memory.facts.length > 5 && (
                  <p className="text-[9px] text-[var(--text-muted)] pl-2">+{memory.facts.length - 5} 更多</p>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-[var(--text-muted)] italic">暂无</p>
            )}
          </div>

          {/* Decisions */}
          {memory.decisions.length > 0 && (
            <div>
              <button
                onClick={() => setShowDecisions(!showDecisions)}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                决策 ({memory.decisions.length}) {showDecisions ? '▾' : '▸'}
              </button>
              {showDecisions && (
                <div className="mt-1 space-y-0.5">
                  {memory.decisions.slice(-5).map((d, i) => (
                    <div key={i} className="text-[11px] text-[var(--text-secondary)] px-2 py-0.5 rounded bg-[var(--surface-2)] truncate">
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Conflicts */}
          {memory.conflictLog.length > 0 && (
            <div>
              <button
                onClick={() => setShowConflicts(!showConflicts)}
                className="text-[10px] text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                ⚠ 冲突 ({memory.conflictLog.length}) {showConflicts ? '▾' : '▸'}
              </button>
              {showConflicts && (
                <div className="mt-1 space-y-0.5">
                  {memory.conflictLog.slice(-5).map((c, i) => (
                    <div key={i} className="text-[11px] text-yellow-300/80 px-2 py-0.5 rounded bg-yellow-500/5 truncate">
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
