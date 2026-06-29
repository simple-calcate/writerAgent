import { useAppStore } from '../../stores/useAppStore'
import { BackButton } from './ContextMenu'

export function ChapterLevel() {
  const { currentChapter, navBack, setRightPanel, autoAnalyze, summarizeChapter, refineSummary, isAnalyzing, isSummarizing, isRefining, llmConfig, openDialogue, openOutline } = useAppStore()

  if (!currentChapter) return null

  const marksCount = currentChapter.polishingMarks?.length || 0
  const hasSummary = !!currentChapter.summaryResult
  const features = llmConfig.aiFeatures

  return (
    <div className="flex flex-col h-full">
      <BackButton label={currentChapter.title} onClick={navBack} />

      <div className="flex-1 overflow-y-auto py-1">
        {/* AI results */}
        {marksCount > 0 && (
          <button
            onClick={() => setRightPanel('polish')}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-blue-300 hover:bg-blue-500/10 transition-colors"
          >
            <span className="text-[12px]">◎</span>
            <span>润色标记</span>
            <span className="ml-auto text-[var(--nw-text-muted)]">{marksCount}</span>
          </button>
        )}
        {hasSummary && (
          <button
            onClick={() => setRightPanel('summary')}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-purple-300 hover:bg-purple-500/10 transition-colors"
          >
            <span className="text-[12px]">◉</span>
            <span>章节摘要</span>
          </button>
        )}

        {/* AI actions */}
        <div className="border-t border-[var(--nw-panel-border)] mt-1 pt-1">
          {features.polish.enabled && (
            <button
              onClick={autoAnalyze}
              disabled={isAnalyzing}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
            >
              <span className="text-[12px]">◎</span>
              <span>{isAnalyzing ? '正在润色...' : '开始润色'}</span>
            </button>
          )}
          {features.summary.enabled && (
            <button
              onClick={summarizeChapter}
              disabled={isSummarizing}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
            >
              <span className="text-[12px]">◉</span>
              <span>{isSummarizing ? '正在生成...' : '生成摘要'}</span>
            </button>
          )}
          {features.refineSummary.enabled && (
            <button
              onClick={refineSummary}
              disabled={isRefining}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-50"
            >
              <span className="text-[12px]">📝</span>
              <span>{isRefining ? '正在精炼...' : '精炼总结'}</span>
            </button>
          )}
          {features.dialogue.enabled && (
            <button
              onClick={() => openDialogue('chapter')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <span className="text-[12px]">💬</span>
              <span>AI 对话</span>
            </button>
          )}
          <button
            onClick={() => openOutline('chapter', currentChapter.id)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            <span className="text-[12px]">📋</span>
            <span>章纲</span>
          </button>
        </div>
      </div>
    </div>
  )
}
