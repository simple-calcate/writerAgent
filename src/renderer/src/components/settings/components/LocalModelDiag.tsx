import { useState } from 'react'
import type { ThinkingDepth } from '../../../../../shared/types'

interface Props {
  config: {
    apiKey: string
    baseUrl: string
    model: string
    thinkingDepth?: ThinkingDepth
  }
}

export default function LocalModelDiagnostics({ config }: Props) {
  const [results, setResults] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleDiagnose = async () => {
    setRunning(true)
    setResults([])
    try {
      const res = await window.api.diagnoseLocalModel(config)
      setResults(res)
    } catch (err) {
      setResults([`❌ 诊断失败: ${(err instanceof Error ? err.message : String(err))}`])
    } finally {
      setRunning(false)
    }
  }

  const handleCopy = async () => {
    const text = [
      `网文写作助手 - 本地模型诊断报告`,
      `时间: ${new Date().toLocaleString()}`,
      `Base URL: ${config.baseUrl}`,
      `模型: ${config.model}`,
      ``,
      ...results
    ].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--nw-text-secondary)]">本地模型诊断</span>
        <div className="flex gap-1.5">
          <button
            onClick={handleDiagnose}
            disabled={running}
            className="px-2 py-1 text-[11px] bg-[var(--nw-surface-2)] hover:bg-white/10 text-[var(--nw-text-secondary)] rounded transition-colors disabled:opacity-50"
          >
            {running ? '诊断中...' : '开始诊断'}
          </button>
          {results.length > 0 && (
            <button
              onClick={handleCopy}
              className="px-2 py-1 text-[11px] bg-[var(--nw-surface-2)] hover:bg-white/10 text-[var(--nw-text-secondary)] rounded transition-colors"
            >
              {copied ? '已复制' : '复制报告'}
            </button>
          )}
        </div>
      </div>
      {results.length > 0 && (
        <div className="bg-[var(--nw-surface-2)] rounded p-2 space-y-1 max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <p key={i} className={`text-[11px] ${
              r.startsWith('✅') ? 'text-emerald-400' :
              r.startsWith('❌') ? 'text-red-400' :
              r.startsWith('💡') ? 'text-amber-400' :
              'text-[var(--nw-text-secondary)]'
            }`}>{r}</p>
          ))}
        </div>
      )}
    </div>
  )
}
