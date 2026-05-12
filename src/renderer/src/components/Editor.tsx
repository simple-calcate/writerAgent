import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/useAppStore'

export default function Editor() {
  const {
    currentChapter,
    updateChapterContent,
    saveChapter,
    autoAnalyze,
    isAnalyzing,
    previewOriginalContent,
    undo,
    undoStack,
    exportTxt,
    toggleHistory,
    createVersion
  } = useAppStore()

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

  const handleChange = useCallback((value: string) => {
    updateChapterContent(value)
    setSaveStatus('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      await saveChapter()
      setSaveStatus('saved')
    }, 1000)
  }, [updateChapterContent, saveChapter])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      }
      // Ctrl+S manual save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveChapter()
        setSaveStatus('saved')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, saveChapter])

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
        <div className="flex items-center gap-2">
          {isPreviewing && (
            <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">
              预览中
            </span>
          )}

          {/* Save status */}
          <span className={`text-xs px-2 py-0.5 rounded ${
            saveStatus === 'saved' ? 'text-green-500/70' :
            saveStatus === 'saving' ? 'text-blue-400' :
            'text-gray-500'
          }`}>
            {saveStatus === 'saved' ? '已保存' :
             saveStatus === 'saving' ? '保存中...' :
             '未保存'}
          </span>

          {markCount > 0 && (
            <span className="text-xs text-yellow-500/80">{markCount} 处润色</span>
          )}
          <span className="text-xs text-gray-500">{wordCount} 字</span>

          <div className="w-px h-4 bg-gray-700 mx-1" />

          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
            title="撤销 (Ctrl+Z)"
          >
            撤销
          </button>

          <button
            onClick={createVersion}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            title="手动保存为一个版本节点"
          >
            存为版本
          </button>

          <button
            onClick={toggleHistory}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            历史
          </button>

          <button
            onClick={exportTxt}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            导出
          </button>

          <div className="w-px h-4 bg-gray-700 mx-1" />

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
