import { useRef, useEffect, useState } from 'react'

interface ThinkingIndicatorProps {
  text: string
  onCancel?: () => void
  compact?: boolean
}

export function ThinkingIndicator({ text, onCancel, compact }: ThinkingIndicatorProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [text])

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
        </span>
        <span className="text-purple-400 text-[11px]">思考中</span>
        {text.length > 0 && <span className="text-[--nw-text-muted] text-[10px]">{text.length} 字</span>}
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-[10px] text-red-400 hover:text-red-300 ml-1 transition-colors duration-150"
          >
            停止
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[11px] text-purple-400/70 hover:text-purple-400 transition-colors duration-150"
      >
        <span className="w-1 h-1 rounded-full bg-purple-500/60" />
        <span className="italic">思考过程</span>
        <span className="text-[--nw-text-muted] text-[10px]">{text.length} 字</span>
        <svg className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {expanded && text.length > 0 && (
        <div ref={scrollRef} className="mt-1.5 max-h-36 overflow-y-auto">
          {/* ghost layer — semi-transparent thinking */}
          <div className="text-[11px] leading-[1.7] text-[--nw-text-muted] opacity-60 italic border-l border-[--nw-border] pl-2 font-mono whitespace-pre-wrap break-all">
            {text}
          </div>
        </div>
      )}
    </div>
  )
}
