import { useAppStore } from '../stores/useAppStore'
import type { PolishResult } from '../../../shared/types'

function SuggestionCard({ suggestion }: { suggestion: PolishResult }) {
  const { acceptSuggestion, dismissSuggestion, activeSuggestionId, setActiveSuggestion } = useAppStore()
  const isActive = activeSuggestionId === suggestion.id

  return (
    <div
      className={`border rounded-lg transition-all ${
        isActive
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-gray-700 hover:border-gray-600'
      }`}
    >
      {/* Header */}
      <div
        className="p-3 cursor-pointer"
        onClick={() => setActiveSuggestion(isActive ? null : suggestion.id)}
      >
        <div className="flex items-start gap-2 mb-1.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 text-xs flex items-center justify-center mt-0.5">
            i
          </span>
          <p className="text-xs text-gray-300 leading-relaxed flex-1">{suggestion.reason}</p>
        </div>

        {/* Original text preview */}
        <div className="ml-7 mt-2">
          <p className="text-xs text-gray-500 mb-1">原文</p>
          <p className="text-xs text-gray-400 leading-relaxed bg-gray-900/50 rounded p-2">
            {suggestion.original}
          </p>
        </div>

        {!isActive && (
          <p className="text-xs text-gray-600 ml-7 mt-1.5">点击预览润色效果</p>
        )}
      </div>

      {/* Expanded: actions */}
      {isActive && (
        <div className="px-3 pb-3 border-t border-gray-700 pt-3">
          <p className="text-xs text-green-400 mb-3">
            编辑器中已显示润色后的效果，确认后将替换原文
          </p>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); acceptSuggestion(suggestion.id) }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded text-xs font-medium transition-colors"
            >
              采纳
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); dismissSuggestion(suggestion.id) }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-1.5 rounded text-xs transition-colors"
            >
              忽略
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PolishPanel() {
  const {
    polishSuggestions,
    isAnalyzing,
    analyzeError,
    acceptAllSuggestions,
    dismissAllSuggestions
  } = useAppStore()

  if (isAnalyzing) {
    return (
      <div className="w-80 border-l border-gray-700 bg-gray-800 p-4 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm">正在分析全文...</p>
          <p className="text-xs text-gray-500 mt-1">寻找需要优化的片段</p>
        </div>
      </div>
    )
  }

  if (analyzeError) {
    return (
      <div className="w-80 border-l border-gray-700 bg-gray-800 p-4">
        <div className="bg-red-900/30 border border-red-800 rounded p-3 text-sm text-red-300">
          {analyzeError}
        </div>
      </div>
    )
  }

  if (polishSuggestions.length === 0) {
    return (
      <div className="w-80 border-l border-gray-700 bg-gray-800 flex flex-col items-center justify-center p-4">
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-2">~</div>
          <p className="text-sm">点击「AI 润色分析」</p>
          <p className="text-xs mt-1 text-gray-600">自动查找需要优化的片段</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 border-l border-gray-700 bg-gray-800 flex flex-col">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">
          润色建议 ({polishSuggestions.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={acceptAllSuggestions}
            className="text-xs text-green-400 hover:text-green-300"
          >
            全部采纳
          </button>
          <button
            onClick={dismissAllSuggestions}
            className="text-xs text-gray-500 hover:text-gray-400"
          >
            全部忽略
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {polishSuggestions.map(s => (
          <SuggestionCard key={s.id} suggestion={s} />
        ))}
      </div>
    </div>
  )
}
