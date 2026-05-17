import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { DEFAULT_KEY_BINDINGS, DEFAULT_CONTINUATION_CONFIG } from '../../../shared/types'
import type { KeyBindings, ContinuationConfig } from '../../../shared/types'
import FormatPanel from './FormatPanel'
import ExportPanel from './ExportPanel'

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

function ExportMenu({
  onExportCurrent,
  onBatchExport
}: {
  onExportCurrent: () => void
  onBatchExport: () => void
}) {
  const [open, setOpen] = useState(false)
  const { currentProject } = useAppStore()

  return (
    <div className="relative">
      <ToolBtn onClick={() => setOpen(!open)} title="导出">
        ↓ 导出
      </ToolBtn>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 w-40 z-50">
          <button
            onClick={() => { onExportCurrent(); setOpen(false) }}
            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            导出当前章节
          </button>
          {currentProject && (
            <button
              onClick={() => { onBatchExport(); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              批量导出项目
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// 快捷键匹配
function matchKey(e: React.KeyboardEvent | KeyboardEvent, binding: string): boolean {
  if (!binding) return false
  const parts = binding.toLowerCase().split('+').map(s => s.trim())
  const key = parts.find(p => !['ctrl', 'alt', 'shift', 'meta'].includes(p)) || ''
  const needCtrl = parts.includes('ctrl')
  const needAlt = parts.includes('alt')
  const needShift = parts.includes('shift')

  const eventKey = e.key.toLowerCase()
  // Tab 特殊处理
  if (key === 'tab' && eventKey === 'tab') {
    return needCtrl === (e.ctrlKey || e.metaKey) && needAlt === e.altKey && needShift === e.shiftKey
  }
  return eventKey === key && needCtrl === (e.ctrlKey || e.metaKey) && needAlt === e.altKey && needShift === e.shiftKey
}

const EDITOR_STYLES = 'flex-1 resize-none bg-transparent p-6 text-base leading-relaxed focus:outline-none placeholder-gray-600 indent-[2em]'

export default function Editor() {
  const {
    currentChapter,
    updateChapterContent,
    saveChapter,
    previewOriginalContent,
    undo,
    undoStack,
    exportTxt,
    toggleExport,
    toggleHistory,
    createVersion,
    scrollToPosition,
    clearScrollToPosition,
    polishSuggestions,
    activeSuggestionId,
    llmConfig,
    continuationSuggestion,
    continuationLoading,
    acceptContinuation,
    dismissContinuation,
    resetContinuationTimer
  } = useAppStore()

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

  const keyBindings: KeyBindings = llmConfig.keyBindings || DEFAULT_KEY_BINDINGS
  const continuationCfg: ContinuationConfig = llmConfig.continuationConfig || DEFAULT_CONTINUATION_CONFIG

  const handleChange = useCallback((value: string) => {
    updateChapterContent(value)
    setSaveStatus('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      await saveChapter()
      setSaveStatus('saved')
    }, 1000)

    // 续写计时器
    if (continuationCfg.enabled) {
      const textarea = textareaRef.current
      if (textarea) {
        const cursor = textarea.selectionStart
        const text = value
        const lineStart = text.lastIndexOf('\n', cursor - 1) + 1
        const lineEnd = text.indexOf('\n', cursor)
        const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd).trimStart()
        const isComment = currentLine.startsWith('//')

        if (isComment) {
          const { continuationTimer } = useAppStore.getState()
          if (continuationTimer) clearTimeout(continuationTimer)
          const timer = setTimeout(() => {
            useAppStore.getState().triggerContinuation(cursor)
          }, continuationCfg.commentDelayMs)
          useAppStore.setState({ continuationTimer: timer })
        } else {
          resetContinuationTimer(cursor)
        }
      }
    }
  }, [updateChapterContent, saveChapter, resetContinuationTimer, continuationCfg])

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 撤销
      if (matchKey(e, keyBindings.undo)) {
        e.preventDefault()
        undo()
        return
      }
      // 接受续写
      if (continuationSuggestion && matchKey(e, keyBindings.acceptContinuation)) {
        e.preventDefault()
        acceptContinuation()
        return
      }
      // 取消续写
      if (continuationSuggestion && matchKey(e, keyBindings.dismissContinuation)) {
        e.preventDefault()
        dismissContinuation()
        return
      }
      // Ctrl+S 保存（始终生效）
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveChapter()
        setSaveStatus('saved')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, saveChapter, keyBindings, continuationSuggestion, acceptContinuation, dismissContinuation])

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  // Scroll to suggestion position
  useEffect(() => {
    if (scrollToPosition === null || !textareaRef.current) return
    const textarea = textareaRef.current
    const content = textarea.value
    const activeSuggestion = polishSuggestions.find(s => s.id === activeSuggestionId)
    const selectLength = activeSuggestion ? activeSuggestion.polished.length : 0
    const textBefore = content.substring(0, scrollToPosition)
    const lineNumber = textBefore.split('\n').length - 1
    const lineHeight = 28
    const scrollTarget = lineNumber * lineHeight - textarea.clientHeight / 3
    textarea.scrollTop = Math.max(0, scrollTarget)
    textarea.setSelectionRange(scrollToPosition, scrollToPosition + selectLength)
    textarea.focus()
    clearScrollToPosition()
  }, [scrollToPosition, activeSuggestionId, polishSuggestions, clearScrollToPosition])

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
          {continuationLoading && (
            <span className="text-[11px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded shrink-0">
              AI 续写中...
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-gray-500 mr-1">
            {wordCount} 字{markCount > 0 ? ` · ${markCount} 处润色` : ''}
          </span>

          <Divider />

          <ToolBtn
            onClick={undo}
            disabled={undoStack.length === 0}
            title={`撤销 (${keyBindings.undo || 'Ctrl+Z'})`}
          >
            ↩ 撤销
          </ToolBtn>

          <Divider />

          <ToolBtn onClick={createVersion} title="创建版本快照">
            ☆ 存版本
          </ToolBtn>
          <ToolBtn onClick={toggleHistory} title="查看版本历史">
            ◷ 历史
          </ToolBtn>

          <Divider />

          <FormatPanel />
          <ExportMenu onExportCurrent={exportTxt} onBatchExport={toggleExport} />
        </div>
      </div>

      {/* Editor */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <textarea
          ref={textareaRef}
          value={currentChapter.content}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => {
            // 必须在此处 preventDefault 阻止 Tab 焦点跳转
            if (continuationSuggestion && (e.key === 'Tab' || matchKey(e, keyBindings.acceptContinuation))) {
              e.preventDefault()
              acceptContinuation()
            }
          }}
          placeholder="开始写作..."
          className={`${EDITOR_STYLES} absolute inset-0`}
          spellCheck={false}
        />
      </div>

      {/* 续写建议栏 */}
      {continuationSuggestion && (
        <div className="border-t border-gray-700/60 bg-gray-800/60 px-4 py-2 flex items-start gap-3">
          <span className="text-xs text-purple-400 shrink-0 mt-0.5">💡</span>
          <p className="text-xs text-gray-400 leading-relaxed flex-1 line-clamp-3">
            {continuationSuggestion}
          </p>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={acceptContinuation}
              className="text-[11px] px-2 py-1 bg-purple-600/80 hover:bg-purple-600 text-white rounded transition-colors"
            >
              {keyBindings.acceptContinuation || 'Tab'} 接受
            </button>
            <button
              onClick={dismissContinuation}
              className="text-[11px] px-2 py-1 bg-gray-600/80 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {continuationLoading && (
        <div className="border-t border-gray-700/60 bg-gray-800/60 px-4 py-2 flex items-center gap-2">
          <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-purple-400">AI 正在思考续写建议...</span>
        </div>
      )}

      <ExportPanel />
    </div>
  )
}
