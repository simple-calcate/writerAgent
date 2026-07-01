import { useState, useRef, useEffect, useMemo } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import type { DialogueLevel, ReasoningChain } from '../../../../shared/types'
import { ToolCallCard, ThinkingIndicator, renderMarkdown } from '../dialogue'
import { PendingApprovalCard, PlanModeBadge } from './ApprovalCard'
import AgentFlowPanel from '../dialogue/AgentFlowPanel'
import AgentTrajectoryPanel from '../dialogue/AgentTrajectoryPanel'
import RewriteApprovalCard from '../dialogue/RewriteApprovalCard'
import ExecutionGraphView from '../dialogue/ExecutionGraphView'
import MemoryPanel from '../dialogue/MemoryPanel'
import InspectorPanel from '../dialogue/InspectorPanel'
import CommandCenter from '../dialogue/CommandCenter'
import MultiAgentCanvas from '../dialogue/MultiAgentCanvas'
import MemoryGraphView from '../dialogue/MemoryGraphView'
import ConflictResolver from '../dialogue/ConflictResolver'
import ExecutionInspector from '../dialogue/ExecutionInspector'
import { LEVEL_META, formatTime, estimateMessageTokens, extractQuestionGroups, stripQuestionTags } from './helpers'
import InputDock from './InputDock'

// ═══════════════════════════════════════════════════════
// MESSAGE LAYER
// ═══════════════════════════════════════════════════════

function MessageCard({ msg, onDelete }: { msg: any; onDelete: (id: string) => void }) {
  const isUser = msg.role === 'user'

  return (
    <div className="group space-y-1">
      <div className="flex items-center gap-2 text-[11px] text-[var(--nw-text-muted)] opacity-60 group-hover:opacity-100 transition-opacity duration-150">
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
          className="ml-auto text-[var(--nw-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-150 p-0.5"
          title="删除消息"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="rounded-md bg-[var(--nw-surface-1)] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] group-hover:translate-y-[-1px] transition-all duration-150 ease-out px-3 py-2">
        {isUser ? (
          <p className="text-[12px] text-[var(--nw-text-secondary)] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="text-[12px] leading-relaxed">{renderMarkdown(stripQuestionTags(msg.content))}</div>
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
  return <span className="w-2 h-2 rounded-full bg-[var(--nw-text-muted)]" />
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
  const textColor = usage.percent > 90 ? 'text-red-400' : usage.percent > 70 ? 'text-yellow-400' : 'text-[var(--nw-text-muted)]'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-[var(--nw-surface-2)] rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-300`} style={{ width: `${usage.percent}%` }} />
      </div>
      <span className={`text-[10px] ${textColor} whitespace-nowrap`}>
        {usage.percent}% · {usage.totalTokens.toLocaleString()} / {usage.historyBudget.toLocaleString()} tok · {usage.messageCount} 条
      </span>
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
    compressDialogue,
    currentRun,
    runtimePause,
    runtimeResume,
    maRun,
    maPause,
    maResume,
    maReplay,
    currentProject
  } = useAppStore()

  const [input, setInput] = useState('')
  const [reasoningChains, setReasoningChains] = useState<ReasoningChain[]>([])
  const [selectedChains, setSelectedChains] = useState<ReasoningChain[]>([])
  const [showChainSelector, setShowChainSelector] = useState(false)
  const [contextWindow, setContextWindow] = useState<number>(128000)
  const [memoryRefreshKey, setMemoryRefreshKey] = useState(0)
  const [showMemoryPanel, setShowMemoryPanel] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chainSelectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [dialogueMessages, streamingText, thinkingText])

  useEffect(() => {
    window.api.getReasoningChains().then(setReasoningChains).catch(err => {
      console.error('[DialoguePanel] 加载推理链失败:', err)
    })
  }, [])

  useEffect(() => {
    window.api.getLLMConfig().then(cfg => {
      setShowMemoryPanel(cfg.agentConfig?.showMemoryPanel !== false)
    }).catch(err => {
      console.error('[DialoguePanel] 加载 LLM 配置失败:', err)
    })
  }, [])

  useEffect(() => {
    window.api.resolveDialogueContextWindow().then(cw => {
      if (cw) setContextWindow(cw)
    }).catch(err => {
      console.error('[DialoguePanel] 解析上下文窗口失败:', err)
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
        setMemoryRefreshKey(k => k + 1)
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
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--nw-bg-color)]">

      {/* ── HEADER ── */}
      <div className="px-4 py-2 border-b border-[var(--nw-border)] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px]">{meta.icon}</span>
          <span className="text-[12px] text-[var(--nw-text-primary)] font-medium">{meta.label}</span>
        </div>
        <button
          onClick={clearDialogue}
          className="text-[10px] text-[var(--nw-text-muted)] hover:text-red-400 transition-colors duration-150 px-1.5 py-0.5 rounded hover:bg-red-500/10"
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
            <div className="text-center text-[var(--nw-text-muted)] mt-10">
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
              <div className="flex items-center gap-2 text-[11px] text-[var(--nw-text-muted)]">
                <span className="font-mono">{formatTime(new Date().toISOString())}</span>
                <span className="text-emerald-400">AI</span>
                {isThinking && <ThinkingIndicator text={thinkingText} compact onCancel={cancelDialogueStream} />}
                {!isThinking && !streamingText && (
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--nw-text-muted)] animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--nw-text-muted)] animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--nw-text-muted)] animate-bounce [animation-delay:300ms]" />
                  </div>
                )}
              </div>

              {planModeActive && <PlanModeBadge />}

              {isThinking && thinkingText && (
                <ThinkingIndicator text={thinkingText} />
              )}

              {streamingText && (
                <div className="rounded-md bg-[var(--nw-surface-1)] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] px-3 py-2">
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

        {/* EXECUTION LAYER — v4 Multi-Agent Canvas (fallback to v3) */}
        {maRun && maRun.agents.length > 0 ? (
          <div className="border-t border-[var(--nw-border)] px-4 py-2">
            <MultiAgentCanvas agents={maRun.agents} />
            {pendingApprovals
              .filter(a => !streamingToolCalls.some(tc => tc.id === a.toolCallId))
              .map(a => (
                <PendingApprovalCard key={a.approvalId} approval={a} onApprove={approveTool} />
              ))}
          </div>
        ) : (streamingToolCalls.length > 0 || pendingApprovals.length > 0 || (currentRun && currentRun.nodes.length > 0)) && (
          <div className="border-t border-[var(--nw-border)] px-4 py-2">
            <ExecutionGraphView
              nodes={currentRun?.nodes ?? []}
              edges={currentRun?.edges ?? []}
            />
            {pendingApprovals
              .filter(a => !streamingToolCalls.some(tc => tc.id === a.toolCallId))
              .map(a => (
                <PendingApprovalCard key={a.approvalId} approval={a} onApprove={approveTool} />
              ))}
          </div>
        )}

        {/* SYSTEM INSPECTOR — v4 (fallback to v3) */}
        {maRun ? (
          <div className="border-t border-[var(--nw-border)] px-4 py-2 space-y-2">
            <ExecutionInspector run={maRun} />
            <MemoryGraphView memory={maRun.sharedMemory} />
            <ConflictResolver conflicts={maRun.sharedMemory.conflictLog} />
            <AgentFlowPanel />
            <AgentTrajectoryPanel />
            <RewriteApprovalCard />
          </div>
        ) : currentRun && (
          <div className="border-t border-[var(--nw-border)] px-4 py-2 space-y-2">
            <InspectorPanel run={currentRun} />
            <AgentFlowPanel />
            <AgentTrajectoryPanel />
            <RewriteApprovalCard />
          </div>
        )}

        {/* MEMORY — 始终可见（持久记忆 + 运行时记忆） */}
        {currentProject && showMemoryPanel && (
          <div className="border-t border-[var(--nw-border)] px-4 py-2">
            <MemoryPanel
              memory={currentRun?.memory ?? { shortTerm: [], longTerm: [] }}
              projectId={currentProject.id}
              refreshKey={memoryRefreshKey}
            />
          </div>
        )}

        {/* INPUT DOCK — v4 CommandCenter */}
        <CommandCenter
          runState={maRun?.state ?? currentRun?.state ?? 'idle'}
          onPause={maRun ? maPause : runtimePause}
          onResume={maRun ? maResume : runtimeResume}
          onReplay={maRun ? () => maReplay() : undefined}
        >
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
        </CommandCenter>

      </div>
    </div>
  )
}
