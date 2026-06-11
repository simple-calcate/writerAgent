import { useEffect, useRef } from 'react'

export default function ThinkingIndicator({ text, onCancel }: { text: string; onCancel?: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as new text arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [text])

  // Split: stable (old) vs tail (recent) vs new (animated reveal)
  const newChunkLen = 20
  const tailLen = 80
  const stablePart = text.length > tailLen ? text.slice(0, -tailLen) : ''
  const tailPart = text.length > tailLen
    ? text.slice(-tailLen, -newChunkLen)
    : text.length > newChunkLen ? text.slice(0, -newChunkLen) : ''
  const newPart = text.length > newChunkLen ? text.slice(-newChunkLen) : text

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 pb-2 shrink-0">
        <div className="relative w-3.5 h-3.5">
          <div className="absolute inset-0 rounded-full border-2 border-purple-500/30" />
          <div className="absolute inset-0 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
        </div>
        <span className="text-xs text-purple-400 font-medium tracking-wide">思考中</span>
        <span className="text-[10px] text-gray-600">{text.length > 0 ? `${text.length} 字` : ''}</span>
        {onCancel && (
          <button
            onClick={onCancel}
            className="ml-auto text-[10px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded border border-red-500/30 hover:border-red-400/50 transition-colors"
          >
            停止
          </button>
        )}
      </div>
      {/* Thinking text area */}
      {text.length > 0 && (
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto rounded bg-gray-900/60 border border-gray-700/40"
        >
          <div className="p-2.5 text-[13px] leading-[1.7] text-gray-400 font-mono whitespace-pre-wrap break-all">
            {stablePart && <span className="text-gray-600">{stablePart}</span>}
            {tailPart && <span className="text-gray-400">{tailPart}</span>}
            <span key={text.length} className="thinking-tail text-gray-200">{newPart}</span>
          </div>
        </div>
      )}
      {/* Empty state */}
      {text.length === 0 && (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-purple-500/40 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
