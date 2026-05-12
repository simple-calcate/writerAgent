import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import FormatPanel from './FormatPanel'

function ToolBtn({
  onClick,
  disabled,
  active,
  title,
  children,
  variant = 'default'
}: {
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  title: string
  children: React.ReactNode
  variant?: 'default' | 'primary'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 text-xs rounded transition-colors inline-flex items-center gap-1 ${
        variant === 'primary'
          ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600'
          : active
            ? 'bg-gray-600 text-white'
            : 'bg-gray-700/50 hover:bg-gray-600 text-gray-300 hover:text-white disabled:opacity-40'
      } disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-gray-700/60" />
}

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      }
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
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700/60 bg-gray-800/40">
        {/* Left: chapter title + status */}
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-medium text-gray-300 truncate">{currentChapter.title}</h2>
          <span className={`text-[11px] px-1.5 py-0.5 rounded shrink-0 ${
            saveStatus === 'saved' ? 'text-green-500/70' :
            saveStatus === 'saving' ? 'text-blue-400' :
            'text-gray-500'
          }`}>
            {saveStatus === 'saved' ? '已保存' :
             saveStatus === 'saving' ? '保存中...' :
             '未保存'}
          </span>
          {isPreviewing && (
            <span className="text-[11px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded shrink-0">
              润色预览中
            </span>
          )}
        </div>

        {/* Right: tool groups */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Stats */}
          <span className="text-[11px] text-gray-500 mr-1">
            {wordCount} 字{markCount > 0 ? ` · ${markCount} 处润色` : ''}
          </span>

          <Divider />

          {/* Edit group */}
          <ToolBtn
            onClick={undo}
            disabled={undoStack.length === 0}
            title="撤销 (Ctrl+Z)"
          >
            ↩ 撤销
          </ToolBtn>

          <Divider />

          {/* Version group */}
          <ToolBtn onClick={createVersion} title="创建版本快照">
            ☆ 存版本
          </ToolBtn>
          <ToolBtn onClick={toggleHistory} title="查看版本历史">
            ◷ 历史
          </ToolBtn>

          <Divider />

          {/* Tools group */}
          <FormatPanel />
          <ToolBtn onClick={exportTxt} title="导出为 txt 文件">
            ↓ 导出
          </ToolBtn>

          <Divider />

          {/* AI group */}
          <ToolBtn
            onClick={autoAnalyze}
            disabled={isAnalyzing}
            variant="primary"
            title="AI 自动分析并润色"
          >
            {isAnalyzing ? '◎ 分析中...' : '◎ AI 润色'}
          </ToolBtn>
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
