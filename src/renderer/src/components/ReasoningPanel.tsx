import { useState, useEffect, useRef } from 'react'
import type { ReasoningStepResult } from '../../../shared/types'

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

  // Auto-expand current running step
  useEffect(() => {
    for (const step of steps) {
      const result = stepResults.get(step.id)
      if (result?.status === 'running') {
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
      <div className="h-full flex items-center justify-center text-gray-500 text-xs">
        <p>等待推理触发...</p>
      </div>
    )
  }

  const completedCount = steps.filter(s => stepResults.get(s.id)?.status === 'done').length
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-medium text-gray-300 truncate">{chainName}</h3>
          <div className="flex items-center gap-1">
            {status === 'running' && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            )}
            {status === 'completed' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
            {status === 'error' && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            )}
            {onClose && (
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs ml-1">✕</button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-700 rounded-full h-1">
            <div
              className={`h-1 rounded-full transition-all duration-300 ${
                status === 'error' ? 'bg-red-500' : status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 shrink-0">{completedCount}/{steps.length}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-1.5">
          <button
            onClick={expandAll}
            className="text-[10px] text-gray-500 hover:text-gray-300"
          >
            全部展开
          </button>
          <button
            onClick={collapseAll}
            className="text-[10px] text-gray-500 hover:text-gray-300"
          >
            全部折叠
          </button>
          {onToggleContext && (
            <button
              onClick={() => onToggleContext(!includeInContext)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                includeInContext
                  ? 'bg-blue-900/30 text-blue-400'
                  : 'bg-gray-700 text-gray-400 hover:text-gray-300'
              }`}
            >
              {includeInContext ? '已纳入上下文' : '未纳入上下文'}
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

          return (
            <div key={step.id} className="border-b border-gray-700/50">
              {/* Step header */}
              <button
                onClick={() => toggleStep(step.id)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-700/30 transition-colors text-left"
              >
                <span className={`text-[10px] w-4 text-center shrink-0 ${
                  isDone ? 'text-emerald-400' : isRunning ? 'text-blue-400' : isError ? 'text-red-400' : 'text-gray-600'
                }`}>
                  {isDone ? '✓' : isRunning ? '◌' : isError ? '✕' : (index + 1)}
                </span>
                <span className={`text-xs flex-1 ${
                  isDone ? 'text-gray-300' : isRunning ? 'text-blue-300' : isError ? 'text-red-300' : 'text-gray-500'
                }`}>
                  {step.name}
                </span>
                {isRunning && (
                  <span className="text-[10px] text-blue-400 animate-pulse">分析中...</span>
                )}
                <span className="text-[10px] text-gray-600">
                  {isExpanded ? '▼' : '▶'}
                </span>
              </button>

              {/* Step content */}
              {isExpanded && result && (
                <div className="px-3 pb-2">
                  <div className={`text-xs whitespace-pre-wrap leading-relaxed ${
                    isError ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {result.result || (isRunning ? '正在分析...' : '等待中...')}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {status === 'completed' && (
        <div className="px-3 py-2 border-t border-gray-700 bg-gray-800/50">
          <p className="text-[10px] text-gray-500 text-center">
            推理完成 · {includeInContext ? '结果已纳入上下文' : '结果未纳入上下文'}
          </p>
        </div>
      )}
    </div>
  )
}
