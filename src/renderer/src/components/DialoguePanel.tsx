import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import type { DialogueLevel, ToolCallInfo, DialogueToolApproval } from '../../../shared/types'

const LEVEL_META: Record<DialogueLevel, { label: string; icon: string }> = {
  book: { label: '书籍对话', icon: '📚' },
  volume: { label: '卷对话', icon: '📖' },
  chapter: { label: '章节对话', icon: '📝' }
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5'
      elements.push(
        <Tag key={i} className={`font-medium text-gray-200 ${level === 1 ? 'text-sm mt-3 mb-1' : 'text-xs mt-2 mb-1'}`}>
          {headerMatch[2]}
        </Tag>
      )
      continue
    }

    // List items
    if (line.match(/^[\-\*]\s+/)) {
      elements.push(
        <div key={i} className="flex gap-1.5 text-xs text-gray-300 leading-relaxed ml-1">
          <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-gray-500" />
          <span>{renderInline(line.replace(/^[\-\*]\s+/, ''))}</span>
        </div>
      )
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
      continue
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-1.5" />)
      continue
    }

    // Normal text
    elements.push(
      <p key={i} className="text-xs text-gray-300 leading-relaxed">{renderInline(line)}</p>
    )
  }

  return elements
}

function renderInline(text: string): React.ReactNode {
  // Bold
  const parts: React.ReactNode[] = []
  const boldRegex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(<strong key={match.index} className="text-gray-200 font-medium">{match[1]}</strong>)
    lastIndex = match.index + match[0].length
  }

  if (parts.length === 0) return text
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
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

function ThinkingIndicator({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-purple-400">思考中...</span>
        {text.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors ml-auto"
          >
            {expanded ? '收起' : '展开思考过程'}
          </button>
        )}
      </div>
      {expanded && text.length > 0 && (
        <div className="text-[11px] text-gray-500 leading-relaxed max-h-48 overflow-y-auto border-l-2 border-purple-800/40 pl-2 ml-1.5 space-y-1">
          {text.split('\n').map((line, i) => (
            <p key={i}>{line || ' '}</p>
          ))}
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [dialogueMessages, streamingText, thinkingText])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    sendDialogueMessage(text)
  }

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

      {/* Input */}
      <div className="p-2 border-t border-gray-700/60 shrink-0">
        <div className="flex gap-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的想法..."
            rows={2}
            className="flex-1 bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500 resize-none"
          />
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
