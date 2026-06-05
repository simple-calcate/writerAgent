import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import type { DialogueLevel, DialogueToolApproval, ReasoningChain } from '../../../shared/types'
import { ToolCallCard, ThinkingIndicator, QuickReplyGroups, renderMarkdown, type QuestionGroup } from './dialogue'

const LEVEL_META: Record<DialogueLevel, { label: string; icon: string }> = {
  book: { label: '书籍对话', icon: '📚' },
  volume: { label: '卷对话', icon: '📖' },
  chapter: { label: '章节对话', icon: '📝' }
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

        {approval.cachedResult ? (
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

// ─── Quick Reply Extraction ───

function extractQuestionGroups(text: string): QuestionGroup[] {
  if (!text) return []

  const lines = text.split('\n')
  const groups: QuestionGroup[] = []
  let currentQuestion = ''
  const currentOptions: { label: string; value: string }[] = []

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
    currentOptions.length = 0
    currentQuestion = ''
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const isQuestion = questionPatterns.some(p => p.test(trimmed))
    const numMatch = trimmed.match(numberedPattern)
    const letMatch = trimmed.match(letteredPattern)

    if (isQuestion && !numMatch && !letMatch) {
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

  flushGroup()

  if (groups.length === 0) {
    const allOptions: { label: string; value: string }[] = []
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
    deleteMessage
  } = useAppStore()

  const [input, setInput] = useState('')
  const [reasoningChains, setReasoningChains] = useState<ReasoningChain[]>([])
  const [selectedChains, setSelectedChains] = useState<ReasoningChain[]>([])
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
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {dialogueMessages.length === 0 && !isStreaming && (
          <div className="text-center text-gray-600 mt-8">
            <p className="text-sm mb-1">{meta.icon}</p>
            <p className="text-xs">输入你的想法，AI 将引导你探索创作方向</p>
          </div>
        )}

        {dialogueMessages.filter(msg => !msg.deleted).map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
            <div className={`relative max-w-[85%] rounded-lg px-3 py-2 ${
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
              {/* User message with reasoning chain badges */}
              {msg.role === 'user' ? (
                <div className="space-y-1.5">
                  {/* Reasoning chain badges */}
                  {msg.reasoningChainIds && msg.reasoningChainIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {msg.reasoningChainIds.map((id, i) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                            <path d="M12 6v6l4 2"/>
                          </svg>
                          {msg.reasoningChainNames?.[i] || id}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* User message content */}
                  <p className="text-xs text-gray-200 whitespace-pre-wrap">{msg.content}</p>
                </div>
              ) : (
                renderMarkdown(msg.content)
              )}

              {/* 删除按钮 - 消息右上角，悬停时显示 */}
              <button
                onClick={() => deleteMessage(msg.id)}
                className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600/50 text-gray-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-900/50 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm"
                title="删除消息"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
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
