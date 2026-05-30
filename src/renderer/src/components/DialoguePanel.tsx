import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import type { DialogueLevel, ToolCallInfo, DialogueToolApproval, ReasoningChain } from '../../../shared/types'

const LEVEL_META: Record<DialogueLevel, { label: string; icon: string }> = {
  book: { label: '书籍对话', icon: '📚' },
  volume: { label: '卷对话', icon: '📖' },
  chapter: { label: '章节对话', icon: '📝' }
}

// ─── Quick Reply Extraction ───

interface QuickReply {
  label: string
  value: string
}

interface QuestionGroup {
  question: string
  options: QuickReply[]
}

function extractQuestionGroups(text: string): QuestionGroup[] {
  if (!text) return []

  const lines = text.split('\n')
  const groups: QuestionGroup[] = []
  let currentQuestion = ''
  let currentOptions: QuickReply[] = []

  const numberedPattern = /^[\s]*(\d+)[\.\)、]\s+(.+)/
  const letteredPattern = /^[\s]*([A-Z])[\.、]\s+(.+)/i
  const questionPatterns = [
    /[？?]\s*$/,
    /^.*(?:你想|你想要|请问|选择|哪个|哪种|什么|怎样的?|什么样的)/,
    /^.*(?:方案[一二A-B]|选项[一二1-2])/
  ]

  const flushGroup = () => {
    if (currentOptions.length >= 2) {
      groups.push({
        question: currentQuestion || `问题 ${groups.length + 1}`,
        options: currentOptions.slice(0, 5)
      })
    }
    currentOptions = []
    currentQuestion = ''
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Check if this line is a question
    const isQuestion = questionPatterns.some(p => p.test(trimmed))

    // Check if this line is an option
    const numMatch = trimmed.match(numberedPattern)
    const letMatch = trimmed.match(letteredPattern)

    if (isQuestion && !numMatch && !letMatch) {
      // This is a question line - flush previous group and start new one
      flushGroup()
      currentQuestion = trimmed
    } else if (numMatch) {
      currentOptions.push({
        label: `${numMatch[1]}. ${numMatch[2].trim()}`,
        value: numMatch[2].trim()
      })
    } else if (letMatch) {
      currentOptions.push({
        label: `${letMatch[1].toUpperCase()}. ${letMatch[2].trim()}`,
        value: letMatch[2].trim()
      })
    }
  }

  // Flush last group
  flushGroup()

  // If no groups found but there are options, create a single group
  if (groups.length === 0) {
    const allOptions: QuickReply[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      const numMatch = trimmed.match(numberedPattern)
      const letMatch = trimmed.match(letteredPattern)
      if (numMatch) {
        allOptions.push({
          label: `${numMatch[1]}. ${numMatch[2].trim()}`,
          value: numMatch[2].trim()
        })
      } else if (letMatch) {
        allOptions.push({
          label: `${letMatch[1].toUpperCase()}. ${letMatch[2].trim()}`,
          value: letMatch[2].trim()
        })
      }
    }
    if (allOptions.length >= 2) {
      groups.push({
        question: '请选择',
        options: allOptions.slice(0, 5)
      })
    }
  }

  return groups
}

// Quick Reply Buttons Component - supports multiple question groups
function QuickReplyGroups({ groups, onSend }: { groups: QuestionGroup[]; onSend: (answers: string) => void }) {
  const [selections, setSelections] = useState<Record<number, string>>({})

  if (groups.length === 0) return null

  const handleSelect = (groupIndex: number, value: string) => {
    setSelections(prev => ({ ...prev, [groupIndex]: value }))
  }

  const handleSend = () => {
    const answers = groups.map((group, i) => {
      const selection = selections[i]
      if (selection) return selection
      return ''
    }).filter(Boolean)

    if (answers.length > 0) {
      onSend(answers.join('；'))
    }
  }

  const allSelected = groups.every((_, i) => selections[i])

  return (
    <div className="space-y-2 mt-2">
      {groups.map((group, gi) => (
        <div key={gi}>
          <p className="text-[10px] text-gray-500 mb-1">{group.question}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((reply, ri) => (
              <button
                key={ri}
                onClick={() => handleSelect(gi, reply.value)}
                className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                  selections[gi] === reply.value
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-blue-200 border border-blue-600/30 hover:border-blue-500/50'
                }`}
              >
                {reply.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {groups.length > 1 && (
        <button
          onClick={handleSend}
          disabled={!allSelected}
          className="w-full py-1.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          发送回答
        </button>
      )}
    </div>
  )
}

function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return []
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.match(/^```/)) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].match(/^```/)) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(
        <pre key={`code-${elements.length}`} className="bg-gray-900/80 border border-gray-700/50 rounded p-2 my-1.5 overflow-x-auto">
          <code className="text-[11px] text-green-300 font-mono leading-relaxed whitespace-pre">{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const sizes = ['text-base', 'text-sm', 'text-xs', 'text-xs', 'text-[11px]', 'text-[11px]']
      elements.push(
        <div key={i} className={`font-semibold text-gray-200 ${sizes[level - 1]} ${level <= 2 ? 'mt-3 mb-1.5' : 'mt-2 mb-1'} border-b border-gray-700/30 pb-0.5`}>
          {renderInline(headerMatch[2])}
        </div>
      )
      i++
      continue
    }

    // Horizontal rule
    if (line.match(/^(\*{3,}|-{3,}|_{3,})\s*$/)) {
      elements.push(<hr key={i} className="border-gray-700/50 my-2" />)
      i++
      continue
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/)) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }
      const parseRow = (row: string) => row.split('|').map(c => c.trim()).filter(Boolean)
      const headers = parseRow(tableLines[0])
      const rows = tableLines.slice(2).map(parseRow)
      elements.push(
        <div key={`table-${elements.length}`} className="my-1.5 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>{headers.map((h, hi) => <th key={hi} className="border border-gray-700/50 px-2 py-1 text-left text-gray-300 bg-gray-800/60 font-medium">{renderInline(h)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="border border-gray-700/50 px-2 py-1 text-gray-400">{renderInline(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Blockquote
    if (line.match(/^>\s?/)) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].match(/^>\s?/)) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      elements.push(
        <blockquote key={`bq-${elements.length}`} className="border-l-2 border-blue-500/50 pl-3 my-1.5 text-xs text-gray-400 italic">
          {quoteLines.map((ql, qi) => <p key={qi}>{renderInline(ql)}</p>)}
        </blockquote>
      )
      continue
    }

    // Unordered list
    if (line.match(/^[\-\*]\s+/)) {
      elements.push(
        <div key={i} className="flex gap-1.5 text-xs text-gray-300 leading-relaxed ml-1">
          <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-gray-500" />
          <span>{renderInline(line.replace(/^[\-\*]\s+/, ''))}</span>
        </div>
      )
      i++
      continue
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)[\.\)]\s+(.+)/)
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-1.5 text-xs text-gray-300 leading-relaxed ml-1">
          <span className="shrink-0 text-gray-500 w-4">{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      )
      i++
      continue
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-1.5" />)
      i++
      continue
    }

    // Normal text
    elements.push(
      <p key={i} className="text-xs text-gray-300 leading-relaxed">{renderInline(line)}</p>
    )
    i++
  }

  return elements
}

function renderInline(text: string): React.ReactNode {
  if (!text) return text

  const parts: React.ReactNode[] = []
  let remaining = text
  let keyCounter = 0
  const codeRegex = /`([^`]+)`/g
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = codeRegex.exec(remaining)) !== null) {
    if (m.index > lastIdx) {
      parts.push(...processInlineFormatting(remaining.slice(lastIdx, m.index), keyCounter++))
    }
    parts.push(<code key={`ic-${keyCounter++}`} className="bg-gray-800 text-amber-300 px-1 py-0.5 rounded text-[11px] font-mono">{m[1]}</code>)
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < remaining.length) {
    parts.push(...processInlineFormatting(remaining.slice(lastIdx), keyCounter++))
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function processInlineFormatting(text: string, keyPrefix: number): React.ReactNode[] {
  if (!text) return []
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|\[([^\]]+)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[1]) {
      parts.push(<strong key={`b-${keyPrefix}-${match.index}`} className="text-gray-200 font-semibold">{match[1]}</strong>)
    } else if (match[2]) {
      parts.push(<em key={`i-${keyPrefix}-${match.index}`} className="text-gray-300 italic">{match[2]}</em>)
    } else if (match[3]) {
      parts.push(<del key={`s-${keyPrefix}-${match.index}`} className="text-gray-500 line-through">{match[3]}</del>)
    } else if (match[4] && match[5]) {
      parts.push(
        <a key={`a-${keyPrefix}-${match.index}`} href={match[5]} target="_blank" rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline">{match[4]}</a>
      )
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

// ─── Tool Call Card ───

const CACHEABLE_TOOLS = new Set(['summarize_chapter', 'refine_summary'])
const WRITE_TOOLS = new Set(['create_chapter', 'rename_chapter', 'write_outline', 'write_volume_outline', 'write_chapter_outline', 'write_chapter_content'])

function getResultPreview(result: string): string {
  const lines = result.split('\n').filter(l => l.trim())
  // First line is usually the summary (e.g., "已更新章纲（120 字）")
  return lines[0] || result.substring(0, 80)
}

function ToolCallCard({ toolCall, approval, onApprove }: { toolCall: ToolCallInfo; approval?: DialogueToolApproval; onApprove: (approvalId: string, approved: boolean, refreshCache?: boolean) => void }) {
  const isWriteTool = WRITE_TOOLS.has(toolCall.toolName)
  const [expanded, setExpanded] = useState(isWriteTool)
  const showResult = toolCall.status === 'done' && toolCall.result && expanded

  return (
    <div className="border border-gray-600/50 rounded-lg bg-gray-800/60 mb-2 overflow-hidden">
      <button
        onClick={() => toolCall.status === 'done' && setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
          toolCall.status === 'done' ? 'cursor-pointer hover:bg-gray-700/40' : 'cursor-default'
        }`}
      >
        {toolCall.status === 'running' ? (
          <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
        ) : toolCall.status === 'pending_approval' ? (
          <span className="text-yellow-400">⏳</span>
        ) : (
          <span className="text-green-400">✓</span>
        )}
        <span className={
          toolCall.status === 'running' ? 'text-amber-300' :
          toolCall.status === 'pending_approval' ? 'text-yellow-300' :
          'text-gray-300'
        }>
          {toolCall.displayName}
        </span>
        {toolCall.status === 'done' && (
          <span className="ml-auto text-gray-600 text-[10px]">{expanded ? '收起' : '展开'}</span>
        )}
      </button>

      {/* Approval UI */}
      {toolCall.status === 'pending_approval' && approval && (
        <div className="px-3 pb-3 border-t border-gray-700/40 pt-2 space-y-2">
          <p className="text-xs text-gray-400">{approval.description}</p>

          {/* Cache hit: show cached result + 3 buttons */}
          {approval.cachedResult && CACHEABLE_TOOLS.has(toolCall.toolName) ? (
            <>
              <div className="text-xs text-gray-500 bg-gray-900/40 rounded p-2 max-h-32 overflow-y-auto">
                <p className="text-[10px] text-gray-600 mb-1">缓存结果：</p>
                {renderMarkdown(approval.cachedResult.substring(0, 200) + (approval.cachedResult.length > 200 ? '...' : ''))}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onApprove(approval.approvalId, true, false)}
                  className="flex-1 bg-green-600/80 hover:bg-green-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
                >
                  使用缓存
                </button>
                <button
                  onClick={() => onApprove(approval.approvalId, true, true)}
                  className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
                >
                  刷新
                </button>
                <button
                  onClick={() => onApprove(approval.approvalId, false)}
                  className="flex-1 bg-gray-600/80 hover:bg-gray-600 text-gray-200 px-2 py-1.5 rounded text-[11px] transition-colors"
                >
                  拒绝
                </button>
              </div>
            </>
          ) : (
            /* Write tool: confirm/reject */
            <div className="flex gap-1.5">
              <button
                onClick={() => onApprove(approval.approvalId, true)}
                className="flex-1 bg-green-600/80 hover:bg-green-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
              >
                确认执行
              </button>
              <button
                onClick={() => onApprove(approval.approvalId, false)}
                className="flex-1 bg-red-600/80 hover:bg-red-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
              >
                拒绝
              </button>
            </div>
          )}
        </div>
      )}

      {/* Done: show result for write tools (auto-expanded), or collapsible for others */}
      {showResult && toolCall.result && (
        <div className="px-3 pb-3 border-t border-gray-700/40 pt-2">
          <div className="text-xs text-gray-400 leading-relaxed max-h-64 overflow-y-auto">
            {renderMarkdown(toolCall.result)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Standalone Pending Approval Card (for approvals arriving before tool-start) ───

function PendingApprovalCard({ approval, onApprove }: { approval: DialogueToolApproval; onApprove: (approvalId: string, approved: boolean, refreshCache?: boolean) => void }) {
  return (
    <div className="border border-yellow-600/40 rounded-lg bg-yellow-900/10 mb-2 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <span className="text-yellow-400">⏳</span>
        <span className="text-yellow-300">{approval.displayName}</span>
        <span className="ml-auto text-[10px] text-yellow-600">等待确认</span>
      </div>
      <div className="px-3 pb-3 border-t border-gray-700/40 pt-2 space-y-2">
        <p className="text-xs text-gray-400">{approval.description}</p>

        {approval.cachedResult && CACHEABLE_TOOLS.has(approval.toolName) ? (
          <>
            <div className="text-xs text-gray-500 bg-gray-900/40 rounded p-2 max-h-32 overflow-y-auto">
              <p className="text-[10px] text-gray-600 mb-1">缓存结果：</p>
              {renderMarkdown(approval.cachedResult.substring(0, 200) + (approval.cachedResult.length > 200 ? '...' : ''))}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => onApprove(approval.approvalId, true, false)}
                className="flex-1 bg-green-600/80 hover:bg-green-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
              >
                使用缓存
              </button>
              <button
                onClick={() => onApprove(approval.approvalId, true, true)}
                className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
              >
                刷新
              </button>
              <button
                onClick={() => onApprove(approval.approvalId, false)}
                className="flex-1 bg-gray-600/80 hover:bg-gray-600 text-gray-200 px-2 py-1.5 rounded text-[11px] transition-colors"
              >
                拒绝
              </button>
            </div>
          </>
        ) : (
          <div className="flex gap-1.5">
            <button
              onClick={() => onApprove(approval.approvalId, true)}
              className="flex-1 bg-green-600/80 hover:bg-green-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
            >
              确认执行
            </button>
            <button
              onClick={() => onApprove(approval.approvalId, false)}
              className="flex-1 bg-red-600/80 hover:bg-red-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
            >
              拒绝
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Plan Mode Badge ───

function PlanModeBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/20 border border-purple-700/40 rounded-lg mb-2 text-xs">
      <span className="text-purple-400">📋</span>
      <span className="text-purple-300">计划模式</span>
      <span className="text-[10px] text-purple-500">AI 正在进行剧情规划，将提供双分支方案</span>
    </div>
  )
}

function ThinkingIndicator({ text, onCancel }: { text: string; onCancel?: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [text])

  const newChunkLen = 20
  const tailLen = 80
  const stablePart = text.length > tailLen ? text.slice(0, -tailLen) : ''
  const tailPart = text.length > tailLen
    ? text.slice(-tailLen, -newChunkLen)
    : text.length > newChunkLen ? text.slice(0, -newChunkLen) : ''
  const newPart = text.length > newChunkLen ? text.slice(-newChunkLen) : text

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center gap-2 px-1 pb-1.5 shrink-0">
        <div className="relative w-3 h-3">
          <div className="absolute inset-0 rounded-full border-2 border-purple-500/30" />
          <div className="absolute inset-0 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
        </div>
        <span className="text-[11px] text-purple-400 font-medium tracking-wide">思考中</span>
        <span className="text-[10px] text-gray-600">{text.length > 0 ? text.length + ' 字' : ''}</span>
        {onCancel && (
          <button
            onClick={onCancel}
            className="ml-auto text-[10px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded border border-red-500/30 hover:border-red-400/50 transition-colors"
          >
            停止
          </button>
        )}
      </div>
      {text.length > 0 && (
        <div ref={scrollRef} className="max-h-32 overflow-y-auto rounded bg-gray-900/60 border border-gray-700/40">
          <div className="p-2 text-[13px] leading-[1.7] text-gray-400 font-mono whitespace-pre-wrap break-all">
            {stablePart && <span className="text-gray-600">{stablePart}</span>}
            {tailPart && <span className="text-gray-400">{tailPart}</span>}
            <span key={text.length} className="thinking-tail text-gray-200">{newPart}</span>
          </div>
        </div>
      )}
      {text.length === 0 && (
        <div className="flex items-center justify-center py-2">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1 h-1 rounded-full bg-purple-500/40 animate-pulse" style={{ animationDelay: i * 200 + 'ms' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DialoguePanel() {
  const {
    dialogueLevel,
    dialogueMessages,
    isStreaming,
    streamingText,
    streamingToolCalls,
    dialogueError,
    pendingApprovals,
    planModeActive,
    isThinking,
    thinkingText,
    sendDialogueMessage,
    cancelDialogueStream,
    clearDialogue,
    approveTool
  } = useAppStore()

  const [input, setInput] = useState('')
  const [reasoningChains, setReasoningChains] = useState<ReasoningChain[]>([])
  const [showChainSelector, setShowChainSelector] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chainSelectorRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [dialogueMessages, streamingText, thinkingText])

  // Load reasoning chains
  useEffect(() => {
    window.api.getReasoningChains().then(setReasoningChains)
  }, [])

  // Click outside to close chain selector
  useEffect(() => {
    if (!showChainSelector) return
    const handler = (e: MouseEvent) => {
      if (chainSelectorRef.current && !chainSelectorRef.current.contains(e.target as Node)) {
        setShowChainSelector(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showChainSelector])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    sendDialogueMessage(text)
  }

  const handleQuickReply = (value: string) => {
    if (!value || isStreaming) return
    sendDialogueMessage(value)
  }

  const handleTriggerReasoning = (chain: ReasoningChain) => {
    setShowChainSelector(false)
    // Send a message with chain ID for the dialogue system to detect
    const userMsg = input.trim() || '请执行推理分析'
    const triggerMsg = `[reasoning:${chain.id}] ${userMsg}`
    setInput('')
    sendDialogueMessage(triggerMsg)
  }

  // Extract question groups from the last assistant message
  const lastAssistantMsg = [...dialogueMessages].reverse().find(m => m.role === 'assistant')
  const questionGroups = lastAssistantMsg ? extractQuestionGroups(lastAssistantMsg.content) : []
  const showQuickReplies = questionGroups.length > 0 && !isStreaming

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!dialogueLevel) return null

  const meta = LEVEL_META[dialogueLevel]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700/60 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{meta.icon}</span>
          <span className="text-xs text-gray-300">{meta.label}</span>
        </div>
        <button
          onClick={clearDialogue}
          className="text-[10px] text-gray-600 hover:text-red-400 transition-colors"
          title="清空对话"
        >
          清空
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {dialogueMessages.length === 0 && !isStreaming && (
          <div className="text-center text-gray-600 mt-8">
            <p className="text-sm mb-1">{meta.icon}</p>
            <p className="text-xs">输入你的想法，AI 将引导你探索创作方向</p>
          </div>
        )}

        {dialogueMessages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-blue-600/30 border border-blue-600/40'
                : 'bg-gray-700/50 border border-gray-700/60'
            }`}>
              {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mb-2">
                  {msg.toolCalls.map(tc => <ToolCallCard key={tc.id} toolCall={tc} onApprove={approveTool} />)}
                </div>
              )}
              {msg.role === 'assistant' && msg.thinkingContent && (
                <div className="mb-2">
                  <ThinkingIndicator text={msg.thinkingContent} />
                </div>
              )}
              {msg.role === 'assistant' ? renderMarkdown(msg.content) : (
                <p className="text-xs text-gray-200 whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 bg-gray-700/50 border border-gray-700/60">
              {/* Plan mode indicator */}
              {planModeActive && <PlanModeBadge />}

              {/* Tool calls with approval */}
              {streamingToolCalls.length > 0 && (
                <div className="mb-2">
                  {streamingToolCalls.map(tc => (
                    <ToolCallCard
                      key={tc.id}
                      toolCall={tc}
                      approval={pendingApprovals.find(a => a.toolCallId === tc.id)}
                      onApprove={approveTool}
                    />
                  ))}
                </div>
              )}

              {/* Standalone pending approvals (arrived before tool-start) */}
              {pendingApprovals
                .filter(a => !streamingToolCalls.some(tc => tc.id === a.toolCallId))
                .map(a => (
                  <PendingApprovalCard key={a.approvalId} approval={a} onApprove={approveTool} />
                ))}
              {streamingText ? renderMarkdown(streamingText) : isThinking ? (
                <ThinkingIndicator text={thinkingText} />
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {dialogueError && (
          <div className="bg-red-900/30 border border-red-800 rounded p-2 text-xs text-red-300">
            {dialogueError}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {showQuickReplies && (
        <div className="px-3 py-2 border-t border-gray-700/40 bg-gray-800/30">
          <QuickReplyGroups groups={questionGroups} onSend={handleQuickReply} />
        </div>
      )}

      {/* Input */}
      <div className="p-2 border-t border-gray-700/60 shrink-0">
        <div className="flex gap-1.5">
          <div className="relative flex-1" ref={chainSelectorRef}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的想法..."
              rows={2}
              className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 pr-8 text-xs text-gray-300 focus:outline-none focus:border-blue-500 resize-none"
            />
            {/* Reasoning chain button */}
            <button
              onClick={() => setShowChainSelector(!showChainSelector)}
              className="absolute right-1.5 bottom-1.5 w-6 h-6 flex items-center justify-center text-gray-500 hover:text-purple-400 hover:bg-gray-700/50 rounded transition-colors"
              title="触发推理链"
            >
              🧠
            </button>

            {/* Chain selector dropdown */}
            {showChainSelector && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-10">
                <div className="p-2 border-b border-gray-700">
                  <p className="text-[10px] text-gray-500">选择推理链</p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {reasoningChains.map(chain => (
                    <button
                      key={chain.id}
                      onClick={() => handleTriggerReasoning(chain)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">{chain.name}</span>
                        <span className="text-[10px] text-gray-600">{chain.steps.length} 步</span>
                      </div>
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{chain.description}</p>
                    </button>
                  ))}
                </div>
                {reasoningChains.length === 0 && (
                  <p className="text-[11px] text-gray-600 text-center py-3">暂无推理链</p>
                )}
              </div>
            )}
          </div>
          {isStreaming ? (
            <button
              onClick={cancelDialogueStream}
              className="self-end bg-red-600/80 hover:bg-red-600 text-white px-3 py-2 rounded text-xs transition-colors"
            >
              停止
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="self-end bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
