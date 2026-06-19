import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import type { PolishResult, DialogueLevel } from '../../../../shared/types'
import DialoguePanel from '../DialoguePanel'
import ThinkingIndicator from './ThinkingIndicator'

// ─── Summary Tab ───

interface SummarySection {
  key: string
  label: string
  icon: string
  items: string[]
}

function parseSummary(text: string): SummarySection[] {
  const sections: SummarySection[] = []
  const lines = text.split('\n').filter(l => l.trim())
  const sectionMap: Record<string, { key: string; label: string; icon: string }> = {
    '主要人物': { key: 'characters', label: '人物', icon: '👤' },
    '关键事件': { key: 'events', label: '事件', icon: '⚡' },
    '伏笔': { key: 'foreshadowing', label: '伏笔', icon: '🔗' },
    '场景': { key: 'scenes', label: '场景', icon: '🏞' },
    '情感': { key: 'emotion', label: '情感', icon: '💭' }
  }

  let current: SummarySection | null = null
  for (const line of lines) {
    const headerMatch = line.match(/^\d+[\.\)、]\s*(.+)/) || line.match(/^\*\*(.+?)\*\*/)
    if (headerMatch) {
      const headerText = headerMatch[1]
      for (const [keyword, meta] of Object.entries(sectionMap)) {
        if (headerText.includes(keyword)) {
          if (current && current.items.length > 0) sections.push(current)
          current = { ...meta, items: [] }
          break
        }
      }
      continue
    }
    const itemMatch = line.match(/^[\-\*·•]\s+(.+)/)
    if (itemMatch && current) {
      current.items.push(itemMatch[1].trim())
    } else if (current && line.trim()) {
      current.items.push(line.trim())
    }
  }
  if (current && current.items.length > 0) sections.push(current)
  if (sections.length === 0) {
    sections.push({ key: 'content', label: '摘要', icon: '📝', items: lines.filter(l => l.trim()) })
  }
  return sections
}

function SummaryContent() {
  const { isSummarizing, isRefining, summaryResult, summaryError, regenerateSummary, aiIsThinking, aiThinkingText, cancelAIFeature } = useAppStore()
  const [activeTab, setActiveTab] = useState('events')

  const sections = useMemo(
    () => (summaryResult ? parseSummary(summaryResult) : []),
    [summaryResult]
  )
  const currentSection = sections.find(s => s.key === activeTab) || sections[0]

    if (isSummarizing || isRefining) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          {aiIsThinking ? (
            <ThinkingIndicator text={aiThinkingText} onCancel={cancelAIFeature} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-[--nw-text-muted]">
                <div className="animate-spin w-6 h-6 border-2 border-[--nw-accent] border-t-transparent rounded-full mx-auto mb-2.5" />
                <p className="text-[13px]">正在生成摘要...</p>
              </div>
            </div>
          )}
        </div>
      )
    }

    if (summaryError) {
      return (
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="bg-red-900/15 border border-red-800/30 rounded-xl p-4">
            <div className="flex items-start gap-2.5 mb-3">
              <span className="text-red-400 text-lg">⚠</span>
              <div>
                <p className="text-[13px] text-red-300 font-medium">摘要生成失败</p>
                <p className="text-[11px] text-red-400/70 mt-0.5">{summaryError}</p>
              </div>
            </div>
            <button onClick={regenerateSummary} className="text-[11px] text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors">
              ↻ 重新生成
            </button>
          </div>
        </div>
      )
    }

  if (!summaryResult) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* 竖向子标签栏 */}
        <div className="w-8.5 bg-[--nw-surface-2] border-r border-[#2a3347] flex flex-col items-center py-2.5 gap-1.5 shrink-0">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveTab(s.key)}
              title={s.label}
              className={`w-6.5 h-6.5 rounded-lg text-[12px] flex items-center justify-center transition-all ${
                currentSection?.key === s.key
                  ? 'bg-[--nw-accent-glow] text-[--nw-accent] shadow-sm'
                  : 'text-[--nw-text-muted] hover:text-[--nw-text-primary] hover:bg-[--nw-surface-1]'
              }`}
            >
              {s.icon}
            </button>
          ))}
        </div>
        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentSection && currentSection.items.length > 0 ? (
            <ul className="space-y-2.5">
              {currentSection.items.map((item, i) => (
                <li key={i} className="flex gap-3 text-[13px] text-[--nw-text-primary] leading-relaxed">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[--nw-accent] mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-[--nw-text-muted]">暂无内容</p>
          )}
        </div>
      </div>
      {/* 重新生成 */}
      <div className="p-2.5 border-t border-[#2a3347] shrink-0">
        <button onClick={regenerateSummary} className="w-full text-[12px] text-[--nw-accent] hover:text-[--nw-accent-hover] py-2 rounded-lg hover:bg-[--nw-accent-glow] transition-colors">
          ↻ 重新生成
        </button>
      </div>
    </div>
  )
}

// ─── Polish Tab ───

function SuggestionCard({ suggestion }: { suggestion: PolishResult }) {
  const { acceptSuggestion, dismissSuggestion, activeSuggestionId, setActiveSuggestion } = useAppStore()
  const isActive = activeSuggestionId === suggestion.id

  return (
    <div className={`border rounded-xl transition-all duration-200 ${isActive ? 'border-blue-500/50 bg-blue-500/8' : 'border-[#2a3347] hover:border-[#3a4255]'}`}>
      <div className="p-3.5 cursor-pointer" onClick={() => setActiveSuggestion(isActive ? null : suggestion.id)}>
        <div className="flex items-start gap-2.5 mb-2">
          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center mt-0.5">i</span>
          <p className="text-[12px] text-[--nw-text-secondary] leading-relaxed flex-1">{suggestion.reason}</p>
        </div>
        <div className="ml-7.5 mt-2.5">
          <p className="text-[11px] text-[--nw-text-muted] mb-1.5">原文</p>
          <p className="text-[12px] text-[--nw-text-secondary] leading-relaxed bg-[--nw-surface-2] rounded-lg p-2.5">{suggestion.original}</p>
        </div>
        {!isActive && <p className="text-[11px] text-[--nw-text-muted] ml-7.5 mt-2">点击预览润色效果</p>}
      </div>
      {isActive && (
        <div className="px-3.5 pb-3.5 border-t border-[#2a3347] pt-3">
          <p className="text-[11px] text-emerald-400 mb-3">编辑器中已显示润色后的效果，确认后将替换原文</p>
          <div className="flex gap-2">
            <button onClick={e => { e.stopPropagation(); acceptSuggestion(suggestion.id) }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-[12px] font-medium transition-colors">采纳</button>
            <button onClick={e => { e.stopPropagation(); dismissSuggestion(suggestion.id) }} className="flex-1 bg-[#2a3347] hover:bg-[#3a4255] py-2 rounded-lg text-[12px] transition-colors">忽略</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PolishContent() {
  const { isAnalyzing, polishSuggestions, analyzeError, analyzeErrorDetail, thinkingHistory, acceptAllSuggestions, dismissAllSuggestions, regeneratePolish, aiIsThinking, aiThinkingText, cancelAIFeature, clearThinkingHistory } = useAppStore()
  const [showThinking, setShowThinking] = useState(false)

  useEffect(() => {
    if (thinkingHistory) setShowThinking(true)
  }, [thinkingHistory])

  if (isAnalyzing) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        {aiIsThinking ? (
          <ThinkingIndicator text={aiThinkingText} onCancel={cancelAIFeature} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[--nw-text-muted]">
              <div className="animate-spin w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-[--nw-text-secondary]">正在分析全文...</p>
              <p className="text-xs text-[--nw-text-muted] mt-1">寻找需要优化的片段</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (analyzeError) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Thinking history */}
        {thinkingHistory && (
          <div className="border-b border-[#2a3347] shrink-0">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-[12px] text-[--nw-text-muted] hover:text-[--nw-text-primary] transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="text-purple-400">◎</span>
                AI 思考过程
              </span>
              <span className="text-[--nw-text-muted]">{showThinking ? '收起' : '展开'}</span>
            </button>
            {showThinking && (
              <div className="px-3.5 pb-3 max-h-48 overflow-y-auto">
                <div className="bg-[--nw-surface-2] border border-[#2a3347] rounded-lg p-3 text-[11px] leading-relaxed text-[--nw-text-muted] font-mono whitespace-pre-wrap break-all">
                  {thinkingHistory}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Error details */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="bg-red-900/15 border border-red-800/30 rounded-xl p-4">
            <div className="flex items-start gap-2.5 mb-3">
              <span className="text-red-400 text-lg">⚠</span>
              <div>
                <p className="text-[13px] text-red-300 font-medium">润色分析失败</p>
                <p className="text-[11px] text-red-400/70 mt-0.5">{analyzeError}</p>
              </div>
            </div>
            {analyzeErrorDetail && (
              <div className="bg-[--nw-surface-2] border border-[#2a3347] rounded-lg p-3 mt-3">
                <p className="text-[11px] text-[--nw-text-secondary] leading-relaxed">{analyzeErrorDetail}</p>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={regeneratePolish}
                className="text-[11px] text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors"
              >
                重新生成
              </button>
              {thinkingHistory && (
                <button
                  onClick={clearThinkingHistory}
                  className="text-[11px] text-[--nw-text-muted] hover:text-[--nw-text-secondary] px-3 py-1.5 rounded-lg hover:bg-[--nw-surface-1] transition-colors"
                >
                  清除记录
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Thinking history */}
      {thinkingHistory && (
        <div className="border-b border-[#2a3347] shrink-0">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-[12px] text-[--nw-text-muted] hover:text-[--nw-text-primary] transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="text-purple-400">◎</span>
              AI 思考过程
            </span>
            <span className="text-[--nw-text-muted]">{showThinking ? '收起' : '展开'}</span>
          </button>
          {showThinking && (
            <div className="px-3.5 pb-3 max-h-48 overflow-y-auto">
              <div className="bg-[--nw-surface-2] border border-[#2a3347] rounded-lg p-3 text-[11px] leading-relaxed text-[--nw-text-muted] font-mono whitespace-pre-wrap break-all">
                {thinkingHistory}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error when no suggestions */}
      {analyzeError && (
        <div className="px-3.5 py-2 border-b border-[#2a3347] shrink-0">
          <div className="bg-yellow-900/10 border border-yellow-800/20 rounded-lg px-3 py-2">
            <p className="text-[11px] text-yellow-400/70">{analyzeError}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {polishSuggestions.length === 0 && !analyzeError && (
        <div className="flex-1 flex items-center justify-center p-5">
          <div className="text-center text-[--nw-text-muted]">
            <div className="text-3xl mb-2.5 text-[#3a4255]">~</div>
            <p className="text-[13px]">暂无润色建议</p>
          </div>
        </div>
      )}

      {/* Suggestions list */}
      {polishSuggestions.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {polishSuggestions.map(s => <SuggestionCard key={s.id} suggestion={s} />)}
        </div>
      )}

      {/* Regenerate */}
      <div className="p-2.5 border-t border-[#2a3347] shrink-0">
        <div className="flex items-center justify-between">
          <button onClick={regeneratePolish} className="flex-1 text-[12px] text-blue-400 hover:text-blue-300 py-2 rounded-lg hover:bg-blue-500/10 transition-colors">
            ↻ 重新生成
          </button>
          {thinkingHistory && (
            <button onClick={clearThinkingHistory} className="text-[11px] text-[--nw-text-muted] hover:text-[--nw-text-secondary] px-3 py-2 rounded-lg hover:bg-[--nw-surface-1] transition-colors ml-2">
              清除记录
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Outline Tab ───

function getOutlineTitle(level: DialogueLevel): string {
  switch (level) {
    case 'book': return '书籍大纲'
    case 'volume': return '卷纲'
    case 'chapter': return '章纲'
  }
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[2]) parts.push(<strong key={match.index} className="text-gray-200 font-semibold">{match[2]}</strong>)
    else if (match[3]) parts.push(<em key={match.index} className="text-gray-300 italic">{match[3]}</em>)
    else if (match[4]) parts.push(<code key={match.index} className="bg-gray-800 text-amber-300 px-1 py-0.5 rounded text-[11px]">{match[4]}</code>)
    else if (match[5]) parts.push(<del key={match.index} className="text-gray-500">{match[5]}</del>)
    lastIndex = match.index + match[0].length
  }
  if (parts.length === 0) return text
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

function renderOutlineMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const sizes = ['text-lg', 'text-base', 'text-sm', 'text-xs', 'text-[11px]', 'text-[10px]']
      elements.push(<div key={i} className={`${sizes[level - 1]} font-semibold text-gray-200 mt-3 mb-1`}>{headerMatch[2]}</div>)
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { elements.push(<hr key={i} className="border-gray-700 my-2" />); continue }
    if (line.startsWith('> ')) { elements.push(<div key={i} className="border-l-2 border-blue-500/50 pl-3 text-xs text-gray-400 italic my-0.5">{renderInlineMarkdown(line.slice(2))}</div>); continue }
    if (/^[\-\*]\s+\[([ xX])\]\s+/.test(line)) {
      const cm = line.match(/^[\-\*]\s+\[([ xX])\]\s+(.+)/)
      if (cm) {
        const checked = cm[1] !== ' '
        elements.push(<div key={i} className="flex gap-1.5 text-xs text-gray-300 leading-relaxed ml-2"><span className={`shrink-0 mt-0.5 w-3.5 h-3.5 rounded border ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-600'} flex items-center justify-center text-[9px]`}>{checked ? '✓' : ''}</span><span className={checked ? 'line-through text-gray-500' : ''}>{renderInlineMarkdown(cm[2])}</span></div>)
        continue
      }
    }
    if (/^[\-\*]\s+/.test(line)) { elements.push(<div key={i} className="flex gap-1.5 text-xs text-gray-300 leading-relaxed ml-2"><span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-gray-500" /><span>{renderInlineMarkdown(line.replace(/^[\-\*]\s+/, ''))}</span></div>); continue }
    const numMatch = line.match(/^(\d+)[\.\)]\s+(.+)/)
    if (numMatch) { elements.push(<div key={i} className="flex gap-1.5 text-xs text-gray-300 leading-relaxed ml-2"><span className="shrink-0 text-gray-500 w-4">{numMatch[1]}.</span><span>{renderInlineMarkdown(numMatch[2])}</span></div>); continue }
    if (!line.trim()) { elements.push(<div key={i} className="h-1.5" />); continue }
    elements.push(<p key={i} className="text-xs text-gray-300 leading-relaxed">{renderInlineMarkdown(line)}</p>)
  }
  return elements
}

function OutlineContent() {
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
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    setContent(currentOutline?.content || '')
    setSaved(false)
  }, [currentOutline])

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

  if (!editingOutlineLevel) return null

  const title = getOutlineTitle(editingOutlineLevel)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-white/5 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-[--nw-text-secondary]">{title}</span>
          {entityName && <span className="text-[10px] text-[--nw-text-muted] truncate">— {entityName}</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`text-[11px] px-3 py-1 rounded-lg transition-all ${showPreview ? 'bg-blue-500/15 text-blue-300' : 'text-[--nw-text-muted] hover:text-[--nw-text-secondary] hover:bg-white/5'}`}
          >
            {showPreview ? '编辑' : '预览'}
          </button>
          {saved && <span className="text-[10px] text-emerald-400/80">已保存</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg transition-all disabled:opacity-40 shadow-sm shadow-blue-500/10"
          >
            {saving ? '...' : '保存'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showPreview ? (
          <div className="flex-1 overflow-y-auto p-4">
            {content.trim() ? (
              renderOutlineMarkdown(content)
            ) : (
              <p className="text-xs text-[--nw-text-muted] italic">暂无内容</p>
            )}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`在此输入${title}内容（Markdown 格式）...`}
            className="flex-1 bg-transparent text-[13px] text-[--nw-text-primary] leading-relaxed p-4 resize-none focus:outline-none font-mono"
            spellCheck={false}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-white/5 shrink-0 flex items-center justify-between">
        <span className="text-[10px] text-[--nw-text-muted]">Ctrl+S 保存</span>
        <span className="text-[10px] text-[--nw-text-muted]">{content.length} 字符</span>
      </div>
    </div>
  )
}

// ─── Main RightPanel ───

const TABS = [
  { key: 'polish' as const, label: '润色', icon: '◎' },
  { key: 'summary' as const, label: '摘要', icon: '◉' },
  { key: 'dialogue' as const, label: '对话', icon: '💬' },
  { key: 'outline' as const, label: '大纲', icon: '📋' }
]

export default function RightPanel({ width }: { width?: number }) {
  const { rightPanel, setRightPanel, llmConfig, navLevel } = useAppStore()

  if (!rightPanel) return null

  const features = llmConfig.aiFeatures
  // Polish/summary only at chapter level, dialogue at all project levels, outline at project/volume/chapter
  const visibleTabs = TABS.filter(t => {
    if (t.key === 'outline') return navLevel === 'project' || navLevel === 'volume' || navLevel === 'chapter'
    const feat = features[t.key]
    if (!feat || !feat.enabled) return false
    if (t.key === 'polish' || t.key === 'summary') return navLevel === 'chapter'
    if (t.key === 'dialogue') return navLevel !== 'projects'
    return true
  })

  return (
    <div className="border-l glass-panel flex shrink-0" style={{ width: width ?? 320 }}>
      {/* 竖向标签栏 */}
      <div className="w-8.5 bg-[--nw-surface-2] border-r border-[#2a3347] flex flex-col items-center py-2.5 gap-1.5 shrink-0">
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setRightPanel(tab.key)}
            title={tab.label}
            className={`w-6.5 h-6.5 rounded-lg text-[11px] flex items-center justify-center transition-all ${
              rightPanel === tab.key
                ? 'bg-[--nw-accent] text-white shadow-sm shadow-[--nw-accent-glow]'
                : 'text-[--nw-text-muted] hover:text-[--nw-text-primary] hover:bg-[--nw-surface-1]'
            }`}
          >
            {tab.icon}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setRightPanel(null)}
          title="关闭面板"
          className="w-6.5 h-6.5 rounded-lg text-[11px] text-[--nw-text-muted] hover:text-[--nw-text-primary] hover:bg-[--nw-surface-1] flex items-center justify-center transition-colors"
        >
          ×
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {rightPanel === 'polish' && <PolishContent />}
        {rightPanel === 'summary' && <SummaryContent />}
        {rightPanel === 'dialogue' && <DialoguePanel />}
        {rightPanel === 'outline' && <OutlineContent />}
      </div>
    </div>
  )
}
