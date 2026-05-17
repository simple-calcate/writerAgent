import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { DEFAULT_KEY_BINDINGS, DEFAULT_CONTINUATION_CONFIG } from '../../../shared/types'
import type { KeyBindings, ContinuationConfig } from '../../../shared/types'
import ExportPanel from './ExportPanel'

// ─── Helpers ──────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Plain text (with \n\n paragraphs) → HTML paragraphs */
function plainTextToHtml(text: string): string {
  if (!text) return '<p><br></p>'
  const paragraphs = text.split(/\n\n+/)
  const html = paragraphs.map(p => {
    const trimmed = p.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('//')) {
      return `<p class="comment">${escapeHtml(trimmed)}</p>`
    }
    const inner = escapeHtml(trimmed).replace(/\n/g, '<br>')
    return `<p>${inner}</p>`
  }).filter(Boolean).join('')
  return html || '<p><br></p>'
}

/** contentEditable DOM → plain text with \n\n paragraph separators */
function htmlToPlainText(container: HTMLElement): string {
  const paragraphs: string[] = []
  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      const tag = el.tagName.toLowerCase()
      if (tag === 'p' || tag === 'div') {
        const text = el.innerText
        if (text.trim()) paragraphs.push(text)
      }
    }
  }
  return paragraphs.join('\n\n')
}

/** Get cursor position as a plain-text character offset within the editor */
function getCursorOffset(container: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0)

  let offset = 0
  const paragraphs = container.querySelectorAll('p')
  for (const p of paragraphs) {
    if (p.contains(range.startContainer)) {
      const preRange = document.createRange()
      preRange.selectNodeContents(p)
      preRange.setEnd(range.startContainer, range.startOffset)
      offset += preRange.toString().length
      break
    } else {
      offset += p.innerText.length + 2
    }
  }
  return offset
}

/** Set cursor at a plain-text character offset within the editor */
function setCursorAtOffset(container: HTMLElement, targetOffset: number) {
  const paragraphs = container.querySelectorAll('p')
  let accumulated = 0

  for (const p of paragraphs) {
    const text = p.innerText
    const paraLen = text.length

    if (accumulated + paraLen >= targetOffset) {
      const localOffset = targetOffset - accumulated
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
      let charCount = 0
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (charCount + node.length >= localOffset) {
          const range = document.createRange()
          range.setStart(node, localOffset - charCount)
          range.collapse(true)
          const sel = window.getSelection()
          if (sel) {
            sel.removeAllRanges()
            sel.addRange(range)
          }
          return
        }
        charCount += node.length
      }
      break
    }
    accumulated += paraLen + 2
  }
}

// ─── Sub-components ───────────────────────────────────────

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

// ─── Key binding matcher ──────────────────────────────────

function matchKey(e: React.KeyboardEvent | KeyboardEvent, binding: string): boolean {
  if (!binding) return false
  const parts = binding.toLowerCase().split('+').map(s => s.trim())
  const key = parts.find(p => !['ctrl', 'alt', 'shift', 'meta'].includes(p)) || ''
  const needCtrl = parts.includes('ctrl')
  const needAlt = parts.includes('alt')
  const needShift = parts.includes('shift')

  const eventKey = e.key.toLowerCase()
  if (key === 'tab' && eventKey === 'tab') {
    return needCtrl === (e.ctrlKey || e.metaKey) && needAlt === e.altKey && needShift === e.shiftKey
  }
  return eventKey === key && needCtrl === (e.ctrlKey || e.metaKey) && needAlt === e.altKey && needShift === e.shiftKey
}

// ─── Ghost text management ────────────────────────────────

function removeGhostText(container: HTMLElement) {
  container.querySelectorAll('.ghost-text').forEach(el => el.remove())
}

function hasGhostText(container: HTMLElement): boolean {
  return container.querySelector('.ghost-text') !== null
}

function insertGhostText(container: HTMLElement, offset: number, text: string) {
  removeGhostText(container)

  const paragraphs = container.querySelectorAll('p')
  let accumulated = 0

  for (const p of paragraphs) {
    const paraText = p.innerText
    const paraLen = paraText.length

    if (accumulated + paraLen >= offset || accumulated + paraLen === offset) {
      const localOffset = Math.min(offset - accumulated, paraLen)
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
      let charCount = 0

      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (charCount + node.length >= localOffset) {
          const span = document.createElement('span')
          span.className = 'ghost-text'
          span.textContent = text
          span.contentEditable = 'false'

          const range = document.createRange()
          const splitOffset = localOffset - charCount
          range.setStart(node, splitOffset)
          range.collapse(true)
          range.insertNode(span)
          return
        }
        charCount += node.length
      }
      break
    }
    accumulated += paraLen + 2
  }
}

/** Accept ghost text: convert ghost span to real text */
function acceptGhostText(container: HTMLElement, store: ReturnType<typeof useAppStore.getState>) {
  const ghost = container.querySelector('.ghost-text') as HTMLElement | null
  if (!ghost) return

  const ghostText = ghost.textContent || ''

  // Place cursor after where ghost was, then remove ghost
  const range = document.createRange()
  range.setStartAfter(ghost)
  range.collapse(true)
  ghost.remove()

  // Insert text as real content
  const textNode = document.createTextNode(ghostText)
  range.insertNode(textNode)
  range.setStartAfter(textNode)
  range.collapse(true)
  const sel = window.getSelection()
  if (sel) {
    sel.removeAllRanges()
    sel.addRange(range)
  }

  // Update store and clear continuation state
  const text = htmlToPlainText(container)
  store.updateChapterContent(text)
  store.clearContinuation()
}

// ─── Editor component ─────────────────────────────────────

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
    dismissContinuation,
    resetContinuationTimer,
    clearContinuation
  } = useAppStore()

  const editorRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const lastChapterIdRef = useRef<string | null>(null)
  const isComposingRef = useRef(false)
  const pendingSyncRef = useRef<{ html: string; cursorOffset: number } | null>(null)

  const keyBindings: KeyBindings = llmConfig.keyBindings || DEFAULT_KEY_BINDINGS
  const continuationCfg: ContinuationConfig = llmConfig.continuationConfig || DEFAULT_CONTINUATION_CONFIG

  // ── Sync HTML when chapter changes ──────────────────────
  useEffect(() => {
    if (!editorRef.current || !currentChapter) return
    if (currentChapter.id === lastChapterIdRef.current) return
    lastChapterIdRef.current = currentChapter.id
    editorRef.current.innerHTML = plainTextToHtml(currentChapter.content)
  }, [currentChapter?.id])

  // ── Sync innerHTML after programmatic content changes ───
  useEffect(() => {
    if (!editorRef.current || !pendingSyncRef.current) return
    const { html, cursorOffset } = pendingSyncRef.current
    pendingSyncRef.current = null
    editorRef.current.innerHTML = html
    setCursorAtOffset(editorRef.current, cursorOffset)
    editorRef.current.focus()
  }, [currentChapter?.content])

  // ── Wrapped undo with cursor restore ────────────────────
  const handleUndo = useCallback(() => {
    const state = useAppStore.getState()
    // Dismiss ghost first
    if (editorRef.current && hasGhostText(editorRef.current)) {
      removeGhostText(editorRef.current)
      clearContinuation()
    }
    if (state.undoStack.length > 0 && editorRef.current) {
      const prev = state.undoStack[state.undoStack.length - 1]
      const sel = window.getSelection()
      const cursorOffset = sel && editorRef.current.contains(sel.anchorNode)
        ? getCursorOffset(editorRef.current)
        : 0
      pendingSyncRef.current = { html: plainTextToHtml(prev.content), cursorOffset }
      undo()
    } else {
      document.execCommand('undo')
      if (editorRef.current) {
        const text = htmlToPlainText(editorRef.current)
        updateChapterContent(text)
      }
    }
  }, [undo, updateChapterContent, clearContinuation])

  // ── Handle contentEditable input ────────────────────────
  const handleInput = useCallback(() => {
    if (!editorRef.current || isComposingRef.current) return
    const el = editorRef.current

    // If user typed while ghost was visible, remove ghost (auto-dismiss)
    if (hasGhostText(el)) {
      removeGhostText(el)
      clearContinuation()
    }

    const cursor = getCursorOffset(el)
    const text = htmlToPlainText(el)
    updateChapterContent(text)

    // Style // paragraphs directly in DOM
    for (const p of el.querySelectorAll('p, div')) {
      const t = (p.textContent || '').trimStart()
      if (t.startsWith('//')) {
        p.classList.add('comment')
      } else {
        p.classList.remove('comment')
      }
    }

    setSaveStatus('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      await saveChapter()
      setSaveStatus('saved')
    }, 1000)

    // Continuation timer — only on non-comment lines
    if (continuationCfg.enabled) {
      const textUpToCursor = text.substring(0, cursor)
      const lastNewline = textUpToCursor.lastIndexOf('\n')
      const currentLine = textUpToCursor.substring(lastNewline + 1).trimStart()
      const isComment = currentLine.startsWith('//')

      if (!isComment) {
        resetContinuationTimer(cursor)
      }
    }
  }, [updateChapterContent, saveChapter, resetContinuationTimer, continuationCfg, clearContinuation])

  // ── Keyboard handling ───────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Tab: accept ghost text
    if (e.key === 'Tab' && editorRef.current && hasGhostText(editorRef.current)) {
      e.preventDefault()
      acceptGhostText(editorRef.current, useAppStore.getState())
      return
    }
    // Any other key while ghost visible: dismiss ghost, let key through
    if (editorRef.current && hasGhostText(editorRef.current)) {
      removeGhostText(editorRef.current)
      clearContinuation()
    }
  }, [clearContinuation])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchKey(e, keyBindings.undo)) {
        const state = useAppStore.getState()
        if (state.undoStack.length > 0) {
          e.preventDefault()
          handleUndo()
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveChapter()
        setSaveStatus('saved')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, saveChapter, keyBindings])

  // ── Click elsewhere: dismiss ghost ──────────────────────
  const handleMouseDown = useCallback(() => {
    if (editorRef.current && hasGhostText(editorRef.current)) {
      removeGhostText(editorRef.current)
      clearContinuation()
    }
  }, [clearContinuation])

  // ── Paste: strip formatting, dismiss ghost ──────────────
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    if (editorRef.current && hasGhostText(editorRef.current)) {
      removeGhostText(editorRef.current)
      clearContinuation()
    }
    const text = e.clipboardData.getData('text/plain')
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    sel.deleteFromDocument()
    const range = sel.getRangeAt(0)
    const node = document.createTextNode(text)
    range.insertNode(node)
    range.setStartAfter(node)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    handleInput()
  }, [handleInput, clearContinuation])

  // ── Cleanup save timer ──────────────────────────────────
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  // ── Scroll to polish suggestion position ────────────────
  useEffect(() => {
    if (scrollToPosition === null || !editorRef.current) return
    setCursorAtOffset(editorRef.current, scrollToPosition)
    editorRef.current.focus()
    clearScrollToPosition()
  }, [scrollToPosition, clearScrollToPosition])

  // ── Insert ghost text when continuation arrives ─────────
  const lastSuggestionRef = useRef<string | null>(null)
  useEffect(() => {
    if (!editorRef.current) return
    // Only act when suggestion actually changes
    if (continuationSuggestion === lastSuggestionRef.current) return
    lastSuggestionRef.current = continuationSuggestion

    if (continuationSuggestion) {
      const cursor = useAppStore.getState().continuationCursorPos ?? currentChapter?.content.length ?? 0
      insertGhostText(editorRef.current, cursor, continuationSuggestion)
    } else {
      removeGhostText(editorRef.current)
    }
  }, [continuationSuggestion])

  // ── IME composition handling (Chinese input) ────────────
  const handleCompositionStart = useCallback(() => { isComposingRef.current = true }, [])
  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false
    handleInput()
  }, [handleInput])

  // ── Empty state ─────────────────────────────────────────
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
            onClick={handleUndo}
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

          <ExportMenu onExportCurrent={exportTxt} onBatchExport={toggleExport} />
        </div>
      </div>

      {/* Rich Text Editor */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onMouseDown={handleMouseDown}
          onPaste={handlePaste}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          className="rich-editor absolute inset-0"
          spellCheck={false}
        />
      </div>

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
