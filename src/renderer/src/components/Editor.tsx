import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../stores/useAppStore'

export default function Editor() {
  const {
    currentChapter,
    updateChapterContent,
    saveChapter,
    autoAnalyze,
    isAnalyzing,
    previewOriginalContent
  } = useAppStore()

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleChange = useCallback((value: string) => {
    updateChapterContent(value)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveChapter(), 1000)
  }, [updateChapterContent, saveChapter])

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  if (!currentChapter) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">选择或创建一个章节开始写作</p>
          <p className="text-sm">在左侧栏选择项目和章节</p>
        </div>
      </div>
    )
  }

  const wordCount = currentChapter.content.replace(/\s/g, '').length
  const markCount = currentChapter.polishingMarks?.length || 0
  const isPreviewing = previewOriginalContent !== null

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800/50">
        <h2 className="text-sm font-medium text-gray-300">{currentChapter.title}</h2>
        <div className="flex items-center gap-3">
          {isPreviewing && (
            <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">
              预览润色效果中 · 右侧点击「采纳」或「忽略」
            </span>
          )}
          {markCount > 0 && (
            <span className="text-xs text-yellow-500/80">{markCount} 处 AI 润色</span>
          )}
          <span className="text-xs text-gray-500">{wordCount} 字</span>
          <button
            onClick={autoAnalyze}
            disabled={isAnalyzing}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
          >
            {isAnalyzing ? '分析中...' : 'AI 润色分析'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={currentChapter.content}
        onChange={e => handleChange(e.target.value)}
        placeholder="开始写作..."
        className="flex-1 resize-none bg-transparent p-6 text-base leading-relaxed focus:outline-none placeholder-gray-600"
        spellCheck={false}
      />
    </div>
  )
}
