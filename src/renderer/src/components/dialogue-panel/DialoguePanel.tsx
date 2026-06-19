import { useState, useRef, useEffect, useMemo } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import type { DialogueLevel, ReasoningChain } from '../../../../shared/types'
import { ToolCallCard, ThinkingIndicator, QuickReplyGroups, renderMarkdown, type QuestionGroup } from '../dialogue'
import { PendingApprovalCard, PlanModeBadge } from './ApprovalCard'
import AgentFlowPanel from '../dialogue/AgentFlowPanel'
import AgentTrajectoryPanel from '../dialogue/AgentTrajectoryPanel'
import RewriteApprovalCard from '../dialogue/RewriteApprovalCard'

const LEVEL_META: Record<DialogueLevel, { label: string; icon: string }> = {
  book: { label: '书籍对话', icon: '📚' },
  volume: { label: '卷对话', icon: '📖' },
  chapter: { label: '章节对话', icon: '📝' }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── Token Estimation ───

function estimateTokens(text: string): number {
  if (!text) return 0
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const nonCjk = text.length - cjk
  return Math.ceil(cjk * 1.5 + nonCjk / 4 + 3)
}

function estimateMessageTokens(msg: { content: string; toolCalls?: Array<{ result?: string }> }): number {
  let tokens = estimateTokens(msg.content) + 4
  if (msg.toolCalls) {
    for (const tc of msg.toolCalls) {
      if (tc.result) tokens += estimateTokens(tc.result) + 4
    }
  }
  return tokens
}

// ─── Quick Reply Extraction ───

const NUM_RE = /^(\d+)[\.\)、]\s+(.+)/
const LET_RE = /^([A-Za-z])[\.、]\s+(.+)/

function stripMarkdown(line: string): string {
  return line
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .trim()
}

function extractQuestionGroups(text: string): QuestionGroup[] {
  if (!text) return []

  const lines = text.split('\n')
  const groups: QuestionGroup[] = []

  const segments: string[][] = []
  let current: string[] = []
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length > 0) {
        segments.push(current)
        current = []
      }
    } else {
      current.push(line.trim())
    }
  }
  if (current.length > 0) segments.push(current)

  for (const seg of segments) {
    const options: { label: string; value: string }[] = []
    let question = ''

    for (let i = 0; i < seg.length; i++) {
      const clean = stripMarkdown(seg[i])
      const numMatch = clean.match(NUM_RE)
      const letMatch = clean.match(LET_RE)

      if (numMatch) {
        const num = parseInt(numMatch[1])
        if (options.length > 0) {
          const lastNum = parseInt(options[options.length - 1].label)
          if (num <= lastNum) {
            if (options.length >= 2) {
              groups.push({ question, options: [...options] })
            }
            options.length = 0
            question = ''
          }
        }
        if (options.length === 0 && i > 0 && question === '') {
          const preceding = seg.slice(0, i).filter(l => {
            const c = stripMarkdown(l)
            return !c.match(NUM_RE) && !c.match(LET_RE)
          })
          if (preceding.length > 0) question = preceding.map(stripMarkdown).join(' ')
        }
        options.push({ label: `${numMatch[1]}. ${numMatch[2].trim()}`, value: numMatch[2].trim() })
      } else if (letMatch) {
        const curChar = letMatch[1].toUpperCase()
        if (options.length > 0) {
          const lastChar = options[options.length - 1].label[0]
          if (/[A-Z]/.test(lastChar) && curChar <= lastChar) {
            if (options.length >= 2) {
              groups.push({ question, options: [...options] })
            }
            options.length = 0
            question = ''
          }
        }
        if (options.length === 0 && i > 0 && question === '') {
          const preceding = seg.slice(0, i).filter(l => {
            const c = stripMarkdown(l)
            return !c.match(NUM_RE) && !c.match(LET_RE)
          })
          if (preceding.length > 0) question = preceding.map(stripMarkdown).join(' ')
        }
        options.push({ label: `${curChar}. ${letMatch[2].trim()}`, value: letMatch[2].trim() })
      }
    }

    if (options.length >= 2) {
      groups.push({ question, options })
    }
  }

  return groups
}

// ═══════════════════════════════════════════════════════
// MESSAGE LAYER
// ═══════════════════════════════════════════════════════

function MessageCard({ msg, onDelete }: { msg: any; onDelete: (id: string) => void }) {
  const isUser = msg.role === 'user'

  return (
    <div className="group space-y-1">
      {/* metadata — fades on idle, reveals on hover */}
      <div className="flex items-center gap-2 text-[11px] text-[--nw-text-muted] opacity-60 group-hover:opacity-100 transition-opacity duration-150">
        <span className="font-mono">{formatTime(msg.timestamp)}</span>
        <span className={isUser ? 'text-blue-400' : 'text-emerald-400'}>
          {isUser ? '你' : 'AI'}
        </span>
        {!isUser && msg.reasoningChainIds && msg.reasoningChainIds.length > 0 && (
          <div className="flex flex-wrap gap-1 ml-1">
            {msg.reasoningChainIds.map((id: string, i: number) => (
              <span key={id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] bg-purple-500/15 text-purple-400 rounded-full">
                🧠 {msg.reasoningChainNames?.[i] || id}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => onDelete(msg.id)}
          className="ml-auto text-[--nw-text-muted] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-150 p-0.5"
          title="删除消息"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* content — hover physics */}
      <div className="rounded-md bg-[--nw-surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] group-hover:translate-y-[-1px] transition-all duration-150 ease-out px-3 py-2">
        {isUser ? (
          <p className="text-[12px] text-[--nw-text-secondary] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="text-[12px] leading-relaxed">{renderMarkdown(msg.content)}</div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// EXECUTION LAYER
// ═══════════════════════════════════════════════════════

function StatusDot({ status }: { status: string }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
      </span>
    )
  }
  if (status === 'pending_approval') return <span className="w-2 h-2 rounded-full bg-yellow-500" />
  if (status === 'done') return <span className="w-2 h-2 rounded-full bg-emerald-500" />
  return <span className="w-2 h-2 rounded-full bg-[--nw-text-muted]" />
}

function ExecutionTimeline({
  toolCalls,
  approvals,
  onApprove
}: {
  toolCalls: any[]
  approvals: any[]
  onApprove: (approvalId: string, approved: boolean, refreshCache?: boolean) => void
}) {
  const [expanded, setExpanded] = useState(true)

  if (toolCalls.length === 0) return null

  return (
    <div className="rounded-md bg-[--nw-surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-[--nw-text-muted] hover:text-[--nw-text-secondary] transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>工具执行</span>
          <span className="text-[10px] text-[--nw-text-muted]">{toolCalls.length} 个</span>
        </div>
        <svg className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="relative px-3 pb-2">
          {/* vertical timeline line */}
          <div className="absolute left-[22px] top-0 bottom-2 w-[1px] bg-[--nw-border]" />

          <div className="space-y-1">
            {toolCalls.map((tc, idx) => (
              <div key={tc.id} className="relative">
                {/* flow dot on timeline */}
                <div className="absolute left-[17px] top-[10px] z-10">
                  <span className={`w-2 h-2 rounded-full block ${
                    tc.status === 'running' ? 'bg-amber-400 animate-pulse' :
                    tc.status === 'pending_approval' ? 'bg-yellow-400' :
                    tc.status === 'done' ? 'bg-emerald-400' :
                    'bg-[--nw-text-muted]'
                  }`} />
                </div>

                {/* card */}
                <div className="ml-8 flex items-center gap-2 px-2 py-1.5 rounded bg-[--nw-surface-2] hover:translate-y-[-1px] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition-all duration-150 ease-out">
                  <span className={`text-[11px] flex-1 ${
                    tc.status === 'running' ? 'text-amber-300' :
                    tc.status === 'pending_approval' ? 'text-yellow-300' :
                    'text-[--nw-text-primary]'
                  }`}>
                    {tc.displayName}
                  </span>
                  <span className="text-[10px] text-[--nw-text-muted]">
                    {tc.status === 'running' ? '执行中' : tc.status === 'pending_approval' ? '等待确认' : '完成'}
                  </span>
                </div>

                {/* Approval UI inline */}
                {tc.status === 'pending_approval' && (
                  <div className="ml-8 mt-1">
                    <ToolCallCard toolCall={tc} approval={approvals.find(a => a.toolCallId === tc.id)} onApprove={onApprove} />
                  </div>
                )}

                {/* Result inline */}
                {tc.status === 'done' && tc.result && (
                  <div className="ml-8 mt-1 text-[11px] text-[--nw-text-muted] bg-[--nw-surface-2] rounded px-2 py-1.5 max-h-24 overflow-y-auto">
                    {renderMarkdown(tc.result.substring(0, 200) + (tc.result.length > 200 ? '...' : ''))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// SYSTEM INSPECTOR
// ═══════════════════════════════════════════════════════

function ContextUsageBar({ messages, contextWindow }: { messages: Array<{ content: string; toolCalls?: Array<{ result?: string }> }>; contextWindow: number }) {
  const usage = useMemo(() => {
    const totalTokens = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
    const historyBudget = Math.floor(contextWindow * 0.25)
    const percent = Math.min(100, Math.round((totalTokens / historyBudget) * 100))
    return { totalTokens, historyBudget, percent, messageCount: messages.length }
  }, [messages, contextWindow])

  if (usage.percent < 50) return null

  const barColor = usage.percent > 90 ? 'bg-red-500' : usage.percent > 70 ? 'bg-yellow-500' : 'bg-blue-500'
  const textColor = usage.percent > 90 ? 'text-red-400' : usage.percent > 70 ? 'text-yellow-400' : 'text-[--nw-text-muted]'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-[--nw-surface-2] rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-300`} style={{ width: `${usage.percent}%` }} />
      </div>
      <span className={`text-[10px] ${textColor} whitespace-nowrap`}>
        {usage.percent}% · {usage.totalTokens.toLocaleString()} / {usage.historyBudget.toLocaleString()} tok · {usage.messageCount} 条
      </span>
    </div>
  )
}

function SystemInspector({
  messages,
  contextWindow
}: {
  messages: Array<{ content: string; toolCalls?: Array<{ result?: string }> }>
  contextWindow: number
}) {
  return (
    <div className="border-t border-[--nw-border] bg-[--nw-surface-1] px-3 py-2">
      <ContextUsageBar messages={messages} contextWindow={contextWindow} />
      <div className="flex gap-2 mt-2">
        <div className="flex-1">
          <AgentFlowPanel />
        </div>
        <div className="flex-1">
          <AgentTrajectoryPanel />
        </div>
      </div>
      <RewriteApprovalCard />
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// INPUT DOCK
// ═══════════════════════════════════════════════════════

function InputDock({
  input,
  setInput,
  onSend,
  onKeyDown,
  isStreaming,
  selectedChains,
  onRemoveChain,
  onToggleChain,
  showChainSelector,
  setShowChainSelector,
  reasoningChains,
  chainSelectorRef,
  showQuickReplies,
  questionGroups,
  onQuickReply,
  cancelStream
}: {
  input: string
  setInput: (v: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  isStreaming: boolean
  selectedChains: ReasoningChain[]
  onRemoveChain: (id: string) => void
  onToggleChain: (chain: ReasoningChain) => void
  showChainSelector: boolean
  setShowChainSelector: (v: boolean) => void
  reasoningChains: ReasoningChain[]
  chainSelectorRef: React.RefObject<HTMLDivElement>
  showQuickReplies: boolean
  questionGroups: QuestionGroup[]
  onQuickReply: (value: string) => void
  cancelStream: () => void
}) {
  return (
    <div className="border-t border-[--nw-border] p-3 bg-[--nw-surface-1]">
      {/* quick replies */}
      {showQuickReplies && (
        <div className="mb-2">
          <QuickReplyGroups groups={questionGroups} onSend={onQuickReply} />
        </div>
      )}

      {/* selected chains */}
      {selectedChains.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedChains.map(chain => (
            <span
              key={chain.id}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-purple-600/20 text-purple-300 rounded-full"
            >
              🧠 {chain.name}
              <button
                onClick={() => onRemoveChain(chain.id)}
                className="text-purple-400 hover:text-purple-200 ml-0.5"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* input row */}
      <div className="flex gap-2">
        <div className="relative flex-1" ref={chainSelectorRef}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="输入你的想法..."
            rows={2}
            className="w-full bg-[--nw-surface-2] rounded-md px-3 py-2 pr-9 text-[13px] text-[--nw-text-primary] border border-[--nw-border] outline-none focus:border-[--nw-accent] resize-none placeholder:text-[--nw-text-muted] transition-colors duration-150"
          />
          <button
            onClick={() => setShowChainSelector(!showChainSelector)}
            className={`absolute right-2 bottom-2 w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150 ${
              selectedChains.length > 0
                ? 'text-purple-400 bg-purple-500/20'
                : 'text-[--nw-text-muted] hover:text-purple-400 hover:bg-white/5'
            }`}
            title="添加推理链"
          >
            🧠
          </button>

          {/* Chain selector dropdown */}
          {showChainSelector && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[--nw-surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] rounded-md overflow-hidden z-10">
              <div className="p-2.5 border-b border-[--nw-border]">
                <p className="text-[11px] text-[--nw-text-muted]">选择推理链（可多选）</p>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {reasoningChains.map(chain => {
                  const isSelected = selectedChains.some(c => c.id === chain.id)
                  return (
                    <button
                      key={chain.id}
                      onClick={() => onToggleChain(chain)}
                      className={`w-full px-3 py-2.5 text-left hover:bg-white/5 transition-colors duration-150 ${
                        isSelected ? 'bg-purple-500/10' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isSelected && <span className="text-purple-400 text-[10px]">✓</span>}
                          <span className="text-[12px] text-[--nw-text-secondary]">{chain.name}</span>
                        </div>
                        <span className="text-[10px] text-[--nw-text-muted]">{chain.steps.length} 步</span>
                      </div>
                      <p className="text-[11px] text-[--nw-text-muted] truncate mt-0.5">{chain.description}</p>
                    </button>
                  )
                })}
              </div>
              {reasoningChains.length === 0 && (
                <p className="text-[11px] text-[--nw-text-muted] text-center py-4">暂无推理链</p>
              )}
            </div>
          )}
        </div>

        {isStreaming ? (
          <button
            onClick={cancelStream}
            className="self-end bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-md text-[12px] font-medium transition-colors duration-150"
          >
            停止
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!input.trim() && selectedChains.length === 0}
            className="self-end bg-[--nw-accent] hover:bg-[--nw-accent-hover] text-white px-4 py-2 rounded-md text-[12px] font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            发送
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════

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
    approveTool,
    deleteMessage,
    compressDialogue
  } = useAppStore()

  const [input, setInput] = useState('')
  const [reasoningChains, setReasoningChains] = useState<ReasoningChain[]>([])
  const [selectedChains, setSelectedChains] = useState<ReasoningChain[]>([])
  const [showChainSelector, setShowChainSelector] = useState(false)
  const [contextWindow, setContextWindow] = useState<number>(128000)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chainSelectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [dialogueMessages, streamingText, thinkingText])

  useEffect(() => {
    window.api.getReasoningChains().then(setReasoningChains)
  }, [])

  useEffect(() => {
    window.api.resolveDialogueContextWindow().then(cw => {
      if (cw) setContextWindow(cw)
    })
  }, [dialogueLevel])

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

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    if (text.startsWith('/')) {
      const command = text.split(/\s+/)[0].toLowerCase()
      setInput('')
      setSelectedChains([])
      if (command === '/compress') {
        await compressDialogue()
      }
      return
    }

    const chainIds = selectedChains.map(c => c.id)
    const chainNames = selectedChains.map(c => c.name)
    setInput('')
    setSelectedChains([])
    sendDialogueMessage(text, chainIds.length > 0 ? chainIds : undefined, chainNames.length > 0 ? chainNames : undefined)
  }

  const handleQuickReply = (value: string) => {
    if (!value || isStreaming) return
    sendDialogueMessage(value)
  }

  const handleToggleChain = (chain: ReasoningChain) => {
    setSelectedChains(prev => {
      const exists = prev.find(c => c.id === chain.id)
      if (exists) return prev.filter(c => c.id !== chain.id)
      return [...prev, chain]
    })
    setShowChainSelector(false)
  }

  const handleRemoveChain = (chainId: string) => {
    setSelectedChains(prev => prev.filter(c => c.id !== chainId))
  }

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
  const activeMessages = dialogueMessages.filter(msg => !msg.deleted)

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[--nw-bg-color]">

      {/* ── HEADER ── */}
      <div className="px-4 py-2 border-b border-[--nw-border] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px]">{meta.icon}</span>
          <span className="text-[12px] text-[--nw-text-primary] font-medium">{meta.label}</span>
        </div>
        <button
          onClick={clearDialogue}
          className="text-[10px] text-[--nw-text-muted] hover:text-red-400 transition-colors duration-150 px-1.5 py-0.5 rounded hover:bg-red-500/10"
          title="清空对话"
        >
          清空
        </button>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* MESSAGE LAYER */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {activeMessages.length === 0 && !isStreaming && (
            <div className="text-center text-[--nw-text-muted] mt-10">
              <p className="text-xl mb-2 opacity-40">{meta.icon}</p>
              <p className="text-[13px]">输入你的想法，AI 将引导你探索创作方向</p>
            </div>
          )}

          {activeMessages.map(msg => (
            <MessageCard key={msg.id} msg={msg} onDelete={deleteMessage} />
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] text-[--nw-text-muted]">
                <span className="font-mono">{formatTime(new Date().toISOString())}</span>
                <span className="text-emerald-400">AI</span>
                {isThinking && <ThinkingIndicator text={thinkingText} compact onCancel={cancelDialogueStream} />}
                {!isThinking && !streamingText && (
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[--nw-text-muted] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[--nw-text-muted] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[--nw-text-muted] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>

              {planModeActive && <PlanModeBadge />}

              {/* Streaming thinking (historical) */}
              {isThinking && thinkingText && (
                <ThinkingIndicator text={thinkingText} />
              )}

              {/* Streaming content */}
              {streamingText && (
                <div className="rounded-md bg-[--nw-surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] px-3 py-2">
                  <div className="text-[12px] leading-relaxed">{renderMarkdown(streamingText)}</div>
                </div>
              )}
            </div>
          )}

          {dialogueError && (
            <div className="bg-red-900/25 border border-red-800/40 rounded-md px-3 py-2 text-[12px] text-red-300">
              {dialogueError}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* EXECUTION LAYER */}
        {(streamingToolCalls.length > 0 || pendingApprovals.length > 0) && (
          <div className="border-t border-[--nw-border] px-4 py-2">
            <ExecutionTimeline
              toolCalls={streamingToolCalls}
              approvals={pendingApprovals}
              onApprove={approveTool}
            />
            {/* Standalone pending approvals */}
            {pendingApprovals
              .filter(a => !streamingToolCalls.some(tc => tc.id === a.toolCallId))
              .map(a => (
                <PendingApprovalCard key={a.approvalId} approval={a} onApprove={approveTool} />
              ))}
          </div>
        )}

        {/* SYSTEM INSPECTOR */}
        <SystemInspector
          messages={activeMessages}
          contextWindow={contextWindow}
        />

        {/* INPUT DOCK */}
        <InputDock
          input={input}
          setInput={setInput}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          isStreaming={isStreaming}
          selectedChains={selectedChains}
          onRemoveChain={handleRemoveChain}
          onToggleChain={handleToggleChain}
          showChainSelector={showChainSelector}
          setShowChainSelector={setShowChainSelector}
          reasoningChains={reasoningChains}
          chainSelectorRef={chainSelectorRef as React.RefObject<HTMLDivElement>}
          showQuickReplies={showQuickReplies}
          questionGroups={questionGroups}
          onQuickReply={handleQuickReply}
          cancelStream={cancelDialogueStream}
        />

      </div>
    </div>
  )
}
