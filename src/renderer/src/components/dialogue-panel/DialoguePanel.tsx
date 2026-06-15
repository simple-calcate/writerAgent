import { useState, useRef, useEffect, useMemo } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import type { DialogueLevel, ReasoningChain } from '../../../../shared/types'
import { ToolCallCard, ThinkingIndicator, QuickReplyGroups, renderMarkdown, type QuestionGroup } from '../dialogue'
import { PendingApprovalCard, PlanModeBadge } from './ApprovalCard'

const LEVEL_META: Record<DialogueLevel, { label: string; icon: string }> = {
  book: { label: '书籍对话', icon: '📚' },
  volume: { label: '卷对话', icon: '📖' },
  chapter: { label: '章节对话', icon: '📝' }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 估算 token 数（渲染进程侧，简化版）
function estimateTokens(text: string): number {
  if (!text) return 0
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const nonCjk = text.length - cjk
  return Math.ceil(cjk * 1.5 + nonCjk / 4 + 3)
}

// 上下文使用指示器
function ContextUsageBar({ messages, contextWindow }: { messages: Array<{ role: string; content: string }>; contextWindow: number }) {
  const usage = useMemo(() => {
    const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0)
    // 对话历史占总预算的 25%，预留 25% 给输出
    const historyBudget = Math.floor(contextWindow * 0.25)
    const percent = Math.min(100, Math.round((totalTokens / historyBudget) * 100))
    return { totalTokens, historyBudget, percent, messageCount: messages.length }
  }, [messages, contextWindow])

  // 超过 50% 才显示
  if (usage.percent < 50) return null

  const barColor = usage.percent > 90 ? 'bg-red-500' : usage.percent > 70 ? 'bg-yellow-500' : 'bg-blue-500'
  const textColor = usage.percent > 90 ? 'text-red-400' : usage.percent > 70 ? 'text-yellow-400' : 'text-gray-500'

  return (
    <div className="px-3 py-1.5 border-t border-gray-700/30 bg-gray-800/10 opacity-70">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-gray-700/50 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all duration-300`} style={{ width: `${usage.percent}%` }} />
        </div>
        <span className={`text-[10px] ${textColor} whitespace-nowrap`}>
          {usage.percent}% · {usage.totalTokens.toLocaleString()} / {usage.historyBudget.toLocaleString()} tok · {usage.messageCount} 条
        </span>
      </div>
    </div>
  )
}

// ─── Quick Reply Extraction (segment-based, no keyword detection) ───

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

  // Split text into segments by blank lines
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
        // Number restart detection: if current number <= last number, start new group
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
        // Text before first option in this segment becomes the question
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [dialogueMessages, streamingText, thinkingText])

  // Load reasoning chains
  useEffect(() => {
    window.api.getReasoningChains().then(setReasoningChains)
  }, [])

  // Load context window from API config
  useEffect(() => {
    window.api.resolveDialogueContextWindow().then(cw => {
      if (cw) setContextWindow(cw)
    })
  }, [dialogueLevel])

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

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    // Command detection
    if (text.startsWith('/')) {
      const command = text.split(/\s+/)[0].toLowerCase()
      setInput('')
      setSelectedChains([])

      if (command === '/compress') {
        await compressDialogue()
        return
      }

      // Unknown command
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
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {dialogueMessages.length === 0 && !isStreaming && (
          <div className="text-center text-gray-600 mt-8">
            <p className="text-sm mb-1">{meta.icon}</p>
            <p className="text-xs">输入你的想法，AI 将引导你探索创作方向</p>
          </div>
        )}

        {dialogueMessages.filter(msg => !msg.deleted).map((msg, idx) => {
          const isUser = msg.role === 'user'
          const borderColor = isUser ? 'border-blue-500' : 'border-emerald-500'
          const roleLabel = isUser ? '你' : 'AI'
          const roleColor = isUser ? 'text-blue-400' : 'text-emerald-400'
          const showDivider = idx > 0

          return (
            <div key={msg.id}>
              {showDivider && (
                <div className="border-t border-dashed border-gray-700/40 my-2 mx-1" />
              )}
              <div className="flex group">
                <div className={`flex-1 border-l-2 ${borderColor} pl-3 pr-6 py-1 relative`}>
                  {/* Header: timestamp + role + delete */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-gray-600 font-mono">{formatTime(msg.timestamp)}</span>
                    <span className={`text-[11px] font-medium ${roleColor}`}>{roleLabel}</span>
                    {/* Reasoning chain badges */}
                    {!isUser && msg.reasoningChainIds && msg.reasoningChainIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 ml-1">
                        {msg.reasoningChainIds.map((id, i) => (
                          <span key={id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] bg-purple-500/15 text-purple-400 border border-purple-500/20 rounded">
                            🧠 {msg.reasoningChainNames?.[i] || id}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="ml-auto text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-150"
                      title="删除消息"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>

                  {/* Tool calls */}
                  {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mb-1.5">
                      {msg.toolCalls.map(tc => <ToolCallCard key={tc.id} toolCall={tc} onApprove={approveTool} />)}
                    </div>
                  )}

                  {/* Thinking content (historical) */}
                  {msg.role === 'assistant' && msg.thinkingContent && (
                    <div className="mb-1.5">
                      <ThinkingIndicator text={msg.thinkingContent} />
                    </div>
                  )}

                  {/* Content */}
                  {isUser ? (
                    <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className="text-xs">{renderMarkdown(msg.content)}</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Streaming message */}
        {isStreaming && (
          <>
            <div className="border-t border-dashed border-gray-700/40 my-2 mx-1" />
            <div className="flex">
              <div className="flex-1 border-l-2 border-emerald-500 pl-3 pr-6 py-1">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-gray-600 font-mono">{formatTime(new Date().toISOString())}</span>
                  <span className="text-[11px] font-medium text-emerald-400">AI</span>
                  {isThinking && <ThinkingIndicator text={thinkingText} compact onCancel={cancelDialogueStream} />}
                  {!isThinking && !streamingText && (
                    <div className="flex gap-1">
                      <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>

                {/* Plan mode indicator */}
                {planModeActive && <PlanModeBadge />}

                {/* Tool calls with approval */}
                {streamingToolCalls.length > 0 && (
                  <div className="mb-1.5">
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

                {/* Standalone pending approvals */}
                {pendingApprovals
                  .filter(a => !streamingToolCalls.some(tc => tc.id === a.toolCallId))
                  .map(a => (
                    <PendingApprovalCard key={a.approvalId} approval={a} onApprove={approveTool} />
                  ))}

                {/* Streaming content */}
                {streamingText && (
                  <div className="text-xs">{renderMarkdown(streamingText)}</div>
                )}
              </div>
            </div>
          </>
        )}

        {dialogueError && (
          <div className="bg-red-900/30 border border-red-800 rounded p-2 text-xs text-red-300">
            {dialogueError}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Context Usage */}
      <ContextUsageBar messages={dialogueMessages.filter(m => !m.deleted)} contextWindow={contextWindow} />

      {/* Quick Replies */}
      {showQuickReplies && (
        <div className="px-3 py-2 border-t border-gray-700/40 bg-gray-800/30">
          <QuickReplyGroups groups={questionGroups} onSend={handleQuickReply} />
        </div>
      )}

      {/* Selected chains */}
      {selectedChains.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-700/40 bg-purple-900/10">
          <div className="flex flex-wrap gap-1.5">
            {selectedChains.map(chain => (
              <span
                key={chain.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-purple-600/20 text-purple-300 border border-purple-600/30 rounded-full"
              >
                🧠 {chain.name}
                <button
                  onClick={() => handleRemoveChain(chain.id)}
                  className="text-purple-400 hover:text-purple-200 ml-0.5"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
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
              className={`absolute right-1.5 bottom-1.5 w-6 h-6 flex items-center justify-center rounded transition-colors ${
                selectedChains.length > 0
                  ? 'text-purple-400 bg-purple-600/20'
                  : 'text-gray-500 hover:text-purple-400 hover:bg-gray-700/50'
              }`}
              title="添加推理链"
            >
              🧠
            </button>

            {/* Chain selector dropdown */}
            {showChainSelector && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-10">
                <div className="p-2 border-b border-gray-700">
                  <p className="text-[10px] text-gray-500">选择推理链（可多选）</p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {reasoningChains.map(chain => {
                    const isSelected = selectedChains.some(c => c.id === chain.id)
                    return (
                      <button
                        key={chain.id}
                        onClick={() => handleToggleChain(chain)}
                        className={`w-full px-3 py-2 text-left hover:bg-gray-700/50 transition-colors ${
                          isSelected ? 'bg-purple-900/20' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isSelected && <span className="text-purple-400 text-[10px]">✓</span>}
                            <span className="text-xs text-gray-300">{chain.name}</span>
                          </div>
                          <span className="text-[10px] text-gray-600">{chain.steps.length} 步</span>
                        </div>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{chain.description}</p>
                      </button>
                    )
                  })}
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
              disabled={!input.trim() && selectedChains.length === 0}
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
