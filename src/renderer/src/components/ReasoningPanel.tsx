import { useState, useEffect, useRef } from 'react'
import type { ReasoningStepResult } from '../../../shared/types'

// Simple markdown renderer for reasoning steps
function renderMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/^### (.+)$/gm, '<div class="text-xs font-semibold text-gray-200 mt-2 mb-1">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="text-sm font-semibold text-gray-200 mt-3 mb-1">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-200">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-gray-400">$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 rounded text-green-300">$1</code>')
    .replace(/^\s*[-*]\s+/gm, '<div class="flex gap-1.5"><span class="text-gray-500 shrink-0">•</span><span>')
    .replace(/^\s*(\d+)\.\s+/gm, '<div class="flex gap-1.5"><span class="text-gray-500 shrink-0 w-4">$1.</span><span>')
    .replace(/\n\n/g, '</div><div class="h-1.5"></div>')
    .replace(/\n/g, '</div><div class="flex gap-1.5">')
}

interface ReasoningPanelProps {
  sessionId: string | null
  chainName: string
  steps: { id: string; name: string }[]
  stepResults: Map<string, ReasoningStepResult>
  status: 'running' | 'completed' | 'error' | 'idle'
  includeInContext: boolean
  onToggleContext?: (include: boolean) => void
  onClose?: () => void
}

export default function ReasoningPanel({
  sessionId,
  chainName,
  steps,
  stepResults,
  status,
  includeInContext,
  onToggleContext,
  onClose
}: ReasoningPanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-expand current running step and completed steps
  useEffect(() => {
    for (const step of steps) {
      const result = stepResults.get(step.id)
      if (result?.status === 'running' || result?.status === 'done') {
        setExpandedSteps(prev => new Set([...prev, step.id]))
      }
    }
  }, [steps, stepResults])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [stepResults])

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedSteps(new Set(steps.map(s => s.id)))
  }

  const collapseAll = () => {
    setExpandedSteps(new Set())
  }

  if (!sessionId || status === 'idle') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs gap-2">
        <span className="text-2xl">🧠</span>
        <p>等待推理触发...</p>
        <p className="text-[10px] text-gray-600">选择推理链后发送消息，AI 执行工具时会自动推理</p>
      </div>
    )
  }

  const completedCount = steps.filter(s => stepResults.get(s.id)?.status === 'done').length
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm">🧠</span>
            <h3 className="text-xs font-medium text-gray-200 truncate">{chainName}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {status === 'running' && (
              <span className="flex items-center gap-1 text-[10px] text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                推理中
              </span>
            )}
            {status === 'completed' && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                完成
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1 text-[10px] text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                错误
              </span>
            )}
            {onClose && (
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs ml-1 p-0.5">✕</button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                status === 'error' ? 'bg-red-500' : status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 shrink-0 font-mono">{completedCount}/{steps.length}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={expandAll}
            className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-gray-700/50"
          >
            全部展开
          </button>
          <button
            onClick={collapseAll}
            className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-gray-700/50"
          >
            全部折叠
          </button>
          {onToggleContext && (
            <button
              onClick={() => onToggleContext(!includeInContext)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ml-auto ${
                includeInContext
                  ? 'bg-blue-900/30 text-blue-400 border border-blue-800/50'
                  : 'bg-gray-700/50 text-gray-500 hover:text-gray-400 border border-gray-700'
              }`}
            >
              {includeInContext ? '✓ 已纳入上下文' : '未纳入上下文'}
            </button>
          )}
        </div>
      </div>

      {/* Steps */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {steps.map((step, index) => {
          const result = stepResults.get(step.id)
          const isExpanded = expandedSteps.has(step.id)
          const isRunning = result?.status === 'running'
          const isDone = result?.status === 'done'
          const isError = result?.status === 'error'
          const isPending = !result

          return (
            <div key={step.id} className={`border-b border-gray-700/30 transition-colors ${
              isRunning ? 'bg-blue-900/10' : ''
            }`}>
              {/* Step header */}
              <button
                onClick={() => toggleStep(step.id)}
                className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-gray-700/20 transition-colors text-left"
              >
                {/* Step number / status icon */}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                  isDone ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/50' :
                  isRunning ? 'bg-blue-900/30 text-blue-400 border border-blue-700/50' :
                  isError ? 'bg-red-900/30 text-red-400 border border-red-700/50' :
                  'bg-gray-800 text-gray-600 border border-gray-700'
                }`}>
                  {isDone ? '✓' : isRunning ? (
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  ) : isError ? '✕' : (index + 1)}
                </div>

                {/* Step name */}
                <span className={`text-xs flex-1 ${
                  isDone ? 'text-gray-300' : isRunning ? 'text-blue-300 font-medium' : isError ? 'text-red-300' : 'text-gray-500'
                }`}>
                  {step.name}
                </span>

                {/* Status label */}
                {isRunning && (
                  <span className="text-[10px] text-blue-400 animate-pulse flex items-center gap-1">
                    <span className="inline-block w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="inline-block w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="inline-block w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
                {isDone && (
                  <span className="text-[10px] text-emerald-600">完成</span>
                )}
                <span className="text-[10px] text-gray-600 ml-1">
                  {isExpanded ? '▾' : '▸'}
                </span>
              </button>

              {/* Step content */}
              {isExpanded && (
                <div className={`px-3 pb-3 ml-7 border-l-2 ${
                  isDone ? 'border-emerald-800/50' : isRunning ? 'border-blue-800/50' : 'border-gray-800'
                }`}>
                  {isRunning && (
                    <div className="flex items-center gap-2 py-2 text-[11px] text-blue-400">
                      <div className="relative w-3 h-3">
                        <div className="absolute inset-0 rounded-full border-2 border-blue-500/30" />
                        <div className="absolute inset-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                      </div>
                      <span>正在分析...</span>
                    </div>
                  )}
                  {isDone && result.result && (
                    <div
                      className="text-[11px] text-gray-400 leading-relaxed py-1 reasoning-content"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(result.result) }}
                    />
                  )}
                  {isError && result?.result && (
                    <div className="text-[11px] text-red-400 py-1">
                      {result.result}
                    </div>
                  )}
                  {isPending && (
                    <div className="text-[11px] text-gray-600 py-1">
                      等待中...
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {status === 'completed' && (
        <div className="px-3 py-2 border-t border-gray-700 bg-gray-800/30">
          <p className="text-[10px] text-gray-500 text-center">
            ✅ 推理完成 · {includeInContext ? '结果已纳入上下文' : '结果未纳入上下文'}
          </p>
        </div>
      )}
      {status === 'error' && (
        <div className="px-3 py-2 border-t border-gray-700 bg-red-900/10">
          <p className="text-[10px] text-red-400 text-center">
            推理过程中出现错误
          </p>
        </div>
      )}
    </div>
  )
}
