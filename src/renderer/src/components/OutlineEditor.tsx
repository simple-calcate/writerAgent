import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/useAppStore'
import type { DialogueLevel } from '../../../shared/types'

// ─── Markdown Renderer ───

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const sizes = ['text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs', 'text-[11px]']
      elements.push(
        <div key={i} className={`${sizes[level - 1] || 'text-xs'} font-semibold text-[var(--nw-text-primary)] mt-3 mb-1`}>
          {headerMatch[2]}
        </div>
      )
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      elements.push(<hr key={i} className="border-white/10 my-2" />)
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <div key={i} className="border-l-2 border-blue-500/50 pl-3 text-xs text-[var(--nw-text-secondary)] italic my-0.5">
          {renderInline(line.slice(2))}
        </div>
      )
      continue
    }

    // Unordered list
    if (/^[\-\*]\s+/.test(line)) {
      elements.push(
        <div key={i} className="flex gap-1.5 text-xs text-[var(--nw-text-secondary)] leading-relaxed ml-2">
          <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-[var(--nw-text-muted)]" />
          <span>{renderInline(line.replace(/^[\-\*]\s+/, ''))}</span>
        </div>
      )
      continue
    }

    // Ordered list
    const numMatch = line.match(/^(\d+)[\.\)]\s+(.+)/)
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-1.5 text-xs text-[var(--nw-text-secondary)] leading-relaxed ml-2">
          <span className="shrink-0 text-[var(--nw-text-muted)] w-4">{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      )
      continue
    }

    // Checkbox
    const checkMatch = line.match(/^[\-\*]\s+\[([ xX])\]\s+(.+)/)
    if (checkMatch) {
      const checked = checkMatch[1] !== ' '
      elements.push(
        <div key={i} className="flex gap-1.5 text-xs text-[var(--nw-text-secondary)] leading-relaxed ml-2">
          <span className={`shrink-0 mt-0.5 w-3.5 h-3.5 rounded border ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-white/15'} flex items-center justify-center text-[9px]`}>
            {checked ? '✓' : ''}
          </span>
          <span className={checked ? 'line-through text-[var(--nw-text-muted)]' : ''}>{renderInline(checkMatch[2])}</span>
        </div>
      )
      continue
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />)
      continue
    }

    // Normal text
    elements.push(
      <p key={i} className="text-xs text-[var(--nw-text-secondary)] leading-relaxed">{renderInline(line)}</p>
    )
  }

  return elements
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2]) {
      parts.push(<strong key={match.index} className="text-[var(--nw-text-primary)] font-semibold">{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<em key={match.index} className="text-[var(--nw-text-secondary)] italic">{match[3]}</em>)
    } else if (match[4]) {
      parts.push(
        <code key={match.index} className="bg-[var(--nw-surface-2)] text-amber-300 px-1 py-0.5 rounded text-[11px]">
          {match[4]}
        </code>
      )
    } else if (match[5]) {
      parts.push(<del key={match.index} className="text-[var(--nw-text-muted)]">{match[5]}</del>)
    }
    lastIndex = match.index + match[0].length
  }

  if (parts.length === 0) return text
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

// ─── Outline Title Helper ───

function getOutlineTitle(level: DialogueLevel): string {
  switch (level) {
    case 'book': return '书籍大纲'
    case 'volume': return '卷纲'
    case 'chapter': return '章纲'
  }
}

// ─── Main Component ───

export default function OutlineEditor() {
  const {
    currentOutline,
    editingOutlineLevel,
    editingOutlineEntityId,
    currentProject,
    volumes,
    chapters,
    saveOutline,
    closeOutline
  } = useAppStore()

  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load content when outline changes
  useEffect(() => {
    setContent(currentOutline?.content || '')
    setSaved(false)
  }, [currentOutline])

  // Get entity name for display
  const entityName = (() => {
    if (!editingOutlineLevel || !editingOutlineEntityId) return ''
    switch (editingOutlineLevel) {
      case 'book': return currentProject?.name || ''
      case 'volume': return volumes.find(v => v.id === editingOutlineEntityId)?.name || ''
      case 'chapter': return chapters.find(c => c.id === editingOutlineEntityId)?.title || ''
    }
  })()

  const handleSave = useCallback(async () => {
    if (!editingOutlineLevel) return
    setSaving(true)
    try {
      await saveOutline(content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [content, editingOutlineLevel, saveOutline])

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleSave])

  // Tab key support in textarea
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent = content.substring(0, start) + '  ' + content.substring(end)
      setContent(newContent)
      // Restore cursor position
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      })
    }
  }

  if (!editingOutlineLevel) return null

  const title = getOutlineTitle(editingOutlineLevel)

  return (
    <div className="flex flex-col h-full bg-[var(--nw-surface-2)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/10/60 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={closeOutline}
            className="text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)] transition-colors text-xs shrink-0"
          >
            ◀ 返回
          </button>
          <span className="text-[var(--nw-text-muted)] text-xs shrink-0">|</span>
          <span className="text-xs text-[var(--nw-text-secondary)] truncate">{title}</span>
          {entityName && (
            <span className="text-[10px] text-[var(--nw-text-muted)] truncate">— {entityName}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="text-[10px] text-green-400">已保存</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Markdown editor */}
        <div className="flex-1 flex flex-col border-r border-white/10/60">
          <div className="px-3 py-1.5 border-b border-[var(--nw-panel-border)] shrink-0">
            <span className="text-[10px] text-[var(--nw-text-muted)]">Markdown 编辑</span>
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`在此输入${title}内容（支持 Markdown 格式）...`}
            className="flex-1 bg-transparent text-[var(--nw-text-secondary)] text-xs leading-relaxed p-4 resize-none focus:outline-none font-mono"
            spellCheck={false}
          />
        </div>

        {/* Right: Live preview */}
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-1.5 border-b border-[var(--nw-panel-border)] shrink-0">
            <span className="text-[10px] text-[var(--nw-text-muted)]">预览</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {content.trim() ? (
              renderMarkdown(content)
            ) : (
              <p className="text-xs text-[var(--nw-text-muted)] italic">预览将在此处显示...</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1 border-t border-[var(--nw-panel-border)] shrink-0 flex items-center justify-between">
        <span className="text-[10px] text-[var(--nw-text-muted)]">Ctrl+S 保存 | Tab 缩进 | 支持 Markdown 语法</span>
        <span className="text-[10px] text-[var(--nw-text-muted)]">{content.length} 字符</span>
      </div>
    </div>
  )
}
