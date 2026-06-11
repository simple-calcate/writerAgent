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
        <span className="text-purple-400 text-xs">思考中</span>
        {text.length > 0 && <span className="text-gray-600 text-[10px]">{text.length} 字</span>}
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-[10px] text-red-400 hover:text-red-300 ml-1"
          >
            停止
          </button>
        )}
      </div>
    )
  }

  const newChunkLen = 20
  const tailLen = 80
  const stablePart = text.length > tailLen ? text.slice(0, -tailLen) : ''
  const tailPart = text.length > tailLen
    ? text.slice(-tailLen, -newChunkLen)
    : text.length > newChunkLen ? text.slice(0, -newChunkLen) : ''
  const newPart = text.length > newChunkLen ? text.slice(-newChunkLen) : text

  return (
    <div className="flex flex-col w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500" />
        </span>
        <span>思考过程</span>
        <span className="text-gray-600">{text.length} 字</span>
        <span className="text-gray-600">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && text.length > 0 && (
        <div ref={scrollRef} className="mt-1 max-h-32 overflow-y-auto rounded bg-gray-900/60 border border-gray-700/40">
          <div className="p-2 text-[11px] leading-[1.6] text-gray-400 font-mono whitespace-pre-wrap break-all">
            {stablePart && <span className="text-gray-600">{stablePart}</span>}
            {tailPart && <span className="text-gray-400">{tailPart}</span>}
            <span className="text-gray-300">{newPart}</span>
          </div>
        </div>
      )}
    </div>
  )
}
