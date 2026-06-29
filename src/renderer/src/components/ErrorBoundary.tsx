import { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** 区域名称，用于错误提示与日志 */
  name?: string
  /** 自定义降级 UI */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** 错误变化时回调（上报/日志） */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * 通用错误边界：捕获子树渲染错误，显示降级 UI 而非整页白屏。
 *
 * 用法：
 *   <ErrorBoundary name="编辑器">
 *     <Editor />
 *   </ErrorBoundary>
 *
 * 配合 lazy 使用时，加载失败（如 chunk 404）也会被捕获。
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 用 console.error 保留错误堆栈到 DevTools
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`, error, info)
    this.props.onError?.(error, info)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }
      return <DefaultFallback error={this.state.error} name={this.props.name} onReset={this.reset} />
    }
    return this.props.children
  }
}

function DefaultFallback({ error, name, onReset }: { error: Error; name?: string; onReset: () => void }): ReactNode {
  const isChunkError = /Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module/i.test(error.message)
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3 p-6 text-center bg-[var(--nw-bg-color)]">
      <div className="text-4xl opacity-60">{isChunkError ? '🔄' : '⚠️'}</div>
      <div className="text-sm font-medium text-[var(--nw-text-primary)]">
        {name ? `${name}出错了` : '这个区域出错了'}
      </div>
      <div className="text-[11px] text-[var(--nw-text-muted)] max-w-md leading-relaxed">
        {isChunkError
          ? '资源加载失败，可能是应用已更新。请重启应用或点击下方按钮重试。'
          : error.message || '渲染时发生未知错误'}
      </div>
      <button
        onClick={isChunkError ? () => window.location.reload() : onReset}
        className="mt-1 px-4 py-1.5 text-[12px] rounded-lg bg-[var(--nw-accent)] hover:bg-[var(--nw-accent-hover)] text-white transition-colors"
      >
        {isChunkError ? '重启应用' : '重试'}
      </button>
    </div>
  )
}
