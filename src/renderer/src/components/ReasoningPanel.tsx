import { useState, useEffect, useRef } from 'react'
import type { ReasoningStepResult } from '../../../shared/types'

// Simple markdown renderer for reasoning steps
function renderMarkdown(text: string): string {
  if (!text) return ''
  // Split into paragraphs first
  const paragraphs = text.split(/\n\n+/)
  return paragraphs.map(p => {
    // Process each paragraph
    let html = p
      .replace(/^### (.+)$/gm, '<div class="text-xs font-semibold text-[--nw-text-primary] mt-2 mb-1">$1</div>')
      .replace(/^## (.+)$/gm, '<div class="text-sm font-semibold text-[--nw-text-primary] mt-3 mb-1">$1</div>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[--nw-text-primary]">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="text-[--nw-text-secondary] italic">$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-gray-800/80 px-1.5 py-0.5 rounded text-emerald-300 text-[11px]">$1</code>')

    // Handle list items
    const lines = html.split('\n')
    let inList = false
    const processedLines: string[] = []

    for (const line of lines) {
      const bulletMatch = line.match(/^\s*[-*]\s+(.+)/)
      const numberMatch = line.match(/^\s*(\d+)\.\s+(.+)/)

      if (bulletMatch) {
        if (!inList) {
          processedLines.push('<div class="space-y-1 mt-1">')
          inList = true
        }
        processedLines.push(`<div class="flex gap-2"><span class="text-[--nw-text-muted] shrink-0">•</span><span class="text-[--nw-text-secondary]">${bulletMatch[1]}</span></div>`)
      } else if (numberMatch) {
        if (!inList) {
          processedLines.push('<div class="space-y-1 mt-1">')
          inList = true
        }
        processedLines.push(`<div class="flex gap-2"><span class="text-[--nw-text-muted] shrink-0 w-4">${numberMatch[1]}.</span><span class="text-[--nw-text-secondary]">${numberMatch[2]}</span></div>`)
      } else {
        if (inList) {
          processedLines.push('</div>')
          inList = false
        }
        processedLines.push(line)
      }
    }

    if (inList) {
      processedLines.push('</div>')
    }

    return `<div class="mb-2">${processedLines.join('\n')}</div>`
  }).join('')
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
      <div className="h-full flex flex-col items-center justify-center text-[--nw-text-muted] text-[12px] gap-2">
        <span className="text-3xl">🧠</span>
        <p className="text-[--nw-text-secondary]">等待推理触发...</p>
        <p className="text-[11px] text-[--nw-text-muted]">选择推理链后发送消息，AI 执行工具时会自动推理</p>
      </div>
    )
  }

  const completedCount = steps.filter(s => stepResults.get(s.id)?.status === 'done').length
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🧠</span>
            <h3 className="text-[12px] font-medium text-[--nw-text-primary] truncate">{chainName}</h3>
          </div>
          <div className="flex items-center gap-2">
            {status === 'running' && (
              <span className="flex items-center gap-1.5 text-[11px] text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                推理中
              </span>
            )}
            {status === 'completed' && (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                完成
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1.5 text-[11px] text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                错误
              </span>
            )}
            {onClose && (
              <button onClick={onClose} className="text-[--nw-text-muted] hover:text-[--nw-text-primary] text-xs ml-1 p-1 rounded-md hover:bg-white/5 transition-colors">✕</button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                status === 'error' ? 'bg-red-500' : status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-[--nw-text-muted] shrink-0 font-mono">{completedCount}/{steps.length}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2.5">
          <button
            onClick={expandAll}
            className="text-[10px] text-[--nw-text-muted] hover:text-[--nw-text-secondary] px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
          >
            全部展开
          </button>
          <button
            onClick={collapseAll}
            className="text-[10px] text-[--nw-text-muted] hover:text-[--nw-text-secondary] px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
          >
            全部折叠
          </button>
          {onToggleContext && (
            <button
              onClick={() => onToggleContext(!includeInContext)}
              className={`text-[10px] px-2 py-1 rounded-lg transition-all ml-auto ${
                includeInContext
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                  : 'bg-white/5 text-[--nw-text-muted] hover:text-[--nw-text-secondary] border border-white/5'
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
            <div key={step.id} className={`border-b border-white/5 transition-colors ${
              isRunning ? 'bg-blue-500/5' : ''
            }`}>
              {/* Step header */}
              <button
                onClick={() => toggleStep(step.id)}
                className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-white/[0.03] transition-colors text-left"
              >
                {/* Step number / status icon */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-medium ${
                  isDone ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                  isRunning ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' :
                  isError ? 'bg-red-500/15 text-red-400 border border-red-500/25' :
                  'bg-white/5 text-[--nw-text-muted] border border-white/10'
                }`}>
                  {isDone ? '✓' : isRunning ? (
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  ) : isError ? '✕' : (index + 1)}
                </div>

                {/* Step name */}
                <span className={`text-[12px] flex-1 ${
                  isDone ? 'text-[--nw-text-secondary]' : isRunning ? 'text-blue-300 font-medium' : isError ? 'text-red-300' : 'text-[--nw-text-muted]'
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
                  <span className="text-[10px] text-emerald-500/70">完成</span>
                )}
                <span className="text-[10px] text-[--nw-text-muted] ml-1">
                  {isExpanded ? '▾' : '▸'}
                </span>
              </button>

              {/* Step content */}
              {isExpanded && (
                <div className={`px-4 pb-3 ml-8 border-l-2 ${
                  isDone ? 'border-emerald-500/30' : isRunning ? 'border-blue-500/30' : 'border-white/10'
                }`}>
                  {isRunning && (
                    <div className="flex items-center gap-2.5 py-2 text-[11px] text-blue-400">
                      <div className="relative w-3 h-3">
                        <div className="absolute inset-0 rounded-full border-2 border-blue-500/30" />
                        <div className="absolute inset-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                      </div>
                      <span>正在分析...</span>
                    </div>
                  )}
                  {isDone && result.result && (
                    <div
                      className="text-[12px] text-[--nw-text-secondary] leading-relaxed py-1 reasoning-content"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(result.result) }}
                    />
                  )}
                  {isError && result?.result && (
                    <div className="text-[12px] text-red-400 py-1">
                      {result.result}
                    </div>
                  )}
                  {isPending && (
                    <div className="text-[11px] text-[--nw-text-muted] py-1">
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
        <div className="px-4 py-2.5 border-t border-white/5 bg-white/[0.01]">
          <p className="text-[11px] text-[--nw-text-muted] text-center">
            ✅ 推理完成 · {includeInContext ? '结果已纳入上下文' : '结果未纳入上下文'}
          </p>
        </div>
      )}
      {status === 'error' && (
        <div className="px-4 py-2.5 border-t border-red-500/20 bg-red-500/5">
          <p className="text-[11px] text-red-400/80 text-center">
            推理过程中出现错误
          </p>
        </div>
      )}
    </div>
  )
}
