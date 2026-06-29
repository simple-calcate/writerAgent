import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { DEFAULT_KEY_BINDINGS, DEFAULT_CONTINUATION_CONFIG } from '../../../../shared/types'
import type { KeyBindings, ContinuationConfig } from '../../../../shared/types'
import ExportPanel from '../ExportPanel'
import {
  plainTextToHtml,
  htmlToPlainText,
  getCursorOffset,
  setCursorAtOffset
} from './helpers'

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
      className={`px-2.5 py-1.5 text-[12px] rounded-md transition-all duration-150 inline-flex items-center gap-1.5 ${
        variant === 'primary'
          ? 'bg-[var(--nw-accent)] hover:bg-[var(--nw-accent-hover)] text-white disabled:bg-white/10 shadow-sm shadow-[var(--nw-accent-glow)]'
          : active
            ? 'bg-[var(--nw-surface-2)] text-[var(--nw-text-primary)]'
            : 'bg-[var(--nw-surface-1)] hover:bg-[var(--nw-surface-2)] text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)]'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-white/10" />
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
        <div className="absolute top-full right-0 mt-1.5 bg-[var(--nw-surface-2)]/95 backdrop-blur border border-white/10 rounded-lg shadow-xl py-1.5 w-44 z-50">
          <button
            onClick={() => { onExportCurrent(); setOpen(false) }}
            className="w-full text-left px-3 py-2 text-[12px] text-[var(--nw-text-secondary)] hover:bg-white/5 hover:text-[var(--nw-text-primary)] transition-colors"
          >
            导出当前章节
          </button>
          {currentProject && (
            <button
              onClick={() => { onBatchExport(); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-[12px] text-[var(--nw-text-secondary)] hover:bg-white/5 hover:text-[var(--nw-text-primary)] transition-colors"
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

  const span = document.createElement('span')
  span.className = 'ghost-text'
  span.textContent = text
  span.contentEditable = 'false'

  const paragraphs = container.querySelectorAll('p')
  let accumulated = 0

  for (const p of paragraphs) {
    const paraText = p.innerText
    const paraLen = paraText.length

    if (accumulated + paraLen >= offset) {
      const localOffset = Math.min(offset - accumulated, paraLen)
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
      let charCount = 0

      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (charCount + node.length >= localOffset) {
          const range = document.createRange()
          range.setStart(node, localOffset - charCount)
          range.collapse(true)
          range.insertNode(span)
          return
        }
        charCount += node.length
      }

      // No text node found (empty paragraph) — create one and insert
      const textNode = document.createTextNode('')
      p.appendChild(textNode)
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.collapse(true)
      range.insertNode(span)
      return
    }
    accumulated += paraLen + 2
  }

  // Fallback: append to last paragraph
  const lastP = paragraphs[paragraphs.length - 1]
  if (lastP) {
    const textNode = document.createTextNode('')
    lastP.appendChild(textNode)
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.collapse(true)
    range.insertNode(span)
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

    // Continuation timer — only at chapter end, non-comment lines
    if (continuationCfg.enabled) {
      const isAtEnd = cursor >= text.length
      if (isAtEnd) {
        const lastNewline = text.lastIndexOf('\n')
        const currentLine = text.substring(lastNewline + 1).trimStart()
        const isComment = currentLine.startsWith('//')
        if (!isComment) {
          resetContinuationTimer(cursor)
        }
      } else {
        clearContinuation()
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

  // ── Sync editor content when polish preview activates/deactivates ──
  useEffect(() => {
    if (!editorRef.current || !currentChapter) return
    const html = plainTextToHtml(currentChapter.content)
    editorRef.current.innerHTML = html
  }, [activeSuggestionId])

  // ── Scroll to polish suggestion position ────────────────
  const pendingScrollRef = useRef<number | null>(null)
  useEffect(() => {
    if (scrollToPosition === null || !editorRef.current) return
    pendingScrollRef.current = scrollToPosition
    clearScrollToPosition()
    requestAnimationFrame(() => {
      const pos = pendingScrollRef.current
      pendingScrollRef.current = null
      if (pos === null || !editorRef.current) return
      try {
        setCursorAtOffset(editorRef.current, pos)
      } catch { /* ignore cursor errors */ }
    })
  }, [scrollToPosition, clearScrollToPosition])

  // ── Insert ghost text when continuation arrives ─────────
  const lastSuggestionRef = useRef<string | null>(null)
  const pendingGhostRef = useRef<{ text: string; cursor: number } | null>(null)

  // Try to insert ghost when suggestion changes
  useEffect(() => {
    // Only act when suggestion actually changes
    if (continuationSuggestion === lastSuggestionRef.current) return
    lastSuggestionRef.current = continuationSuggestion

    if (continuationSuggestion) {
      const cursor = useAppStore.getState().continuationCursorPos ?? currentChapter?.content.length ?? 0
      if (editorRef.current) {
        insertGhostText(editorRef.current, cursor, continuationSuggestion)
      } else {
        pendingGhostRef.current = { text: continuationSuggestion, cursor }
      }
    } else {
      if (editorRef.current) removeGhostText(editorRef.current)
    }
  }, [continuationSuggestion])

  // Flush pending ghost text once editor mounts
  useEffect(() => {
    if (editorRef.current && pendingGhostRef.current) {
      const { text, cursor } = pendingGhostRef.current
      pendingGhostRef.current = null
      insertGhostText(editorRef.current, cursor, text)
    }
  })

  // ── IME composition handling (Chinese input) ────────────
  const handleCompositionStart = useCallback(() => { isComposingRef.current = true }, [])
  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false
    handleInput()
  }, [handleInput])

  // ── Empty state ─────────────────────────────────────────
  if (!currentChapter) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--nw-text-muted)]">
        <div className="text-center">
          <p className="text-lg mb-2 text-[var(--nw-text-secondary)]">选择或创建一个章节开始写作</p>
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
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--nw-panel-border)] glass-panel">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-[13px] font-medium text-[var(--nw-text-primary)] truncate">{currentChapter.title}</h2>
          <span className={`text-[11px] px-2 py-0.5 rounded-md shrink-0 ${
            saveStatus === 'saved' ? 'text-emerald-400/80 bg-emerald-500/10' :
            saveStatus === 'saving' ? 'text-blue-400 bg-blue-500/10' :
            'text-[var(--nw-text-muted)] bg-[var(--nw-surface-1)]'
          }`}>
            {saveStatus === 'saved' ? '已保存' :
             saveStatus === 'saving' ? '保存中...' :
             '未保存'}
          </span>
          {isPreviewing && (
            <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md shrink-0">
              润色预览中
            </span>
          )}
          {continuationLoading && (
            <span className="text-[11px] text-[var(--nw-accent)] bg-[var(--nw-accent-glow)] px-2 py-0.5 rounded-md shrink-0">
              AI 续写中...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-[var(--nw-text-muted)] mr-1">
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
        <div className="border-t border-[var(--nw-panel-border)] bg-[var(--nw-surface-1)]/80 px-4 py-2.5 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-[var(--nw-accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-[var(--nw-accent)]">AI 正在思考续写建议...</span>
        </div>
      )}

      <ExportPanel />
    </div>
  )
}
