import type { ReasoningChain } from '../../../../shared/types'
import { QuickReplyGroups, type QuestionGroup } from '../dialogue'

export default function InputDock({
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
