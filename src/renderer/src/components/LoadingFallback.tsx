/**
 * Suspense 加载占位符。
 * 配合 React.lazy 使用，在 chunk 加载期间显示。
 */
export default function LoadingFallback({ label = '加载中' }: { label?: string }): JSX.Element {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2.5 p-6 bg-[var(--nw-bg-color)]">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--nw-text-muted)] animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--nw-text-muted)] animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--nw-text-muted)] animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-[11px] text-[var(--nw-text-muted)]">{label}</span>
    </div>
  )
}
