import { useState, useMemo } from 'react'
import { useAppStore } from '../stores/useAppStore'
import type { PolishResult } from '../../../shared/types'
import DialoguePanel from './DialoguePanel'

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
  const { isSummarizing, summaryResult, summaryError, regenerateSummary } = useAppStore()
  const [activeTab, setActiveTab] = useState('events')

  const sections = useMemo(
    () => (summaryResult ? parseSummary(summaryResult) : []),
    [summaryResult]
  )
  const currentSection = sections.find(s => s.key === activeTab) || sections[0]

  if (isSummarizing) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm">正在生成摘要...</p>
        </div>
      </div>
    )
  }

  if (summaryError) {
    return (
      <div className="flex-1 p-4">
        <div className="bg-red-900/30 border border-red-800 rounded p-3 text-sm text-red-300">{summaryError}</div>
        <button onClick={regenerateSummary} className="mt-3 text-xs text-purple-400 hover:text-purple-300">重新生成</button>
      </div>
    )
  }

  if (!summaryResult) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* 竖向子标签栏 */}
        <div className="w-8 bg-gray-900/40 border-r border-gray-700/40 flex flex-col items-center py-2 gap-1 shrink-0">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveTab(s.key)}
              title={s.label}
              className={`w-6 h-6 rounded text-xs flex items-center justify-center transition-colors ${
                currentSection?.key === s.key
                  ? 'bg-purple-600/30 text-purple-300'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              {s.icon}
            </button>
          ))}
        </div>
        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-3">
          {currentSection && currentSection.items.length > 0 ? (
            <ul className="space-y-2">
              {currentSection.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-300 leading-relaxed">
                  <span className="shrink-0 w-1 h-1 rounded-full bg-purple-400 mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">暂无内容</p>
          )}
        </div>
      </div>
      {/* 重新生成 */}
      <div className="p-2 border-t border-gray-700/60 shrink-0">
        <button onClick={regenerateSummary} className="w-full text-xs text-purple-400 hover:text-purple-300 py-1.5 rounded hover:bg-gray-700/50 transition-colors">
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
    <div className={`border rounded-lg transition-all ${isActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'}`}>
      <div className="p-3 cursor-pointer" onClick={() => setActiveSuggestion(isActive ? null : suggestion.id)}>
        <div className="flex items-start gap-2 mb-1.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 text-xs flex items-center justify-center mt-0.5">i</span>
          <p className="text-xs text-gray-300 leading-relaxed flex-1">{suggestion.reason}</p>
        </div>
        <div className="ml-7 mt-2">
          <p className="text-xs text-gray-500 mb-1">原文</p>
          <p className="text-xs text-gray-400 leading-relaxed bg-gray-900/50 rounded p-2">{suggestion.original}</p>
        </div>
        {!isActive && <p className="text-xs text-gray-600 ml-7 mt-1.5">点击预览润色效果</p>}
      </div>
      {isActive && (
        <div className="px-3 pb-3 border-t border-gray-700 pt-3">
          <p className="text-xs text-green-400 mb-3">编辑器中已显示润色后的效果，确认后将替换原文</p>
          <div className="flex gap-2">
            <button onClick={e => { e.stopPropagation(); acceptSuggestion(suggestion.id) }} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded text-xs font-medium transition-colors">采纳</button>
            <button onClick={e => { e.stopPropagation(); dismissSuggestion(suggestion.id) }} className="flex-1 bg-gray-700 hover:bg-gray-600 py-1.5 rounded text-xs transition-colors">忽略</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PolishContent() {
  const { isAnalyzing, polishSuggestions, analyzeError, acceptAllSuggestions, dismissAllSuggestions, regeneratePolish } = useAppStore()

  if (isAnalyzing) {
    return (
      <div className="flex-1 flex items-center justify-center">
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
      <div className="flex-1 p-4">
        <div className="bg-red-900/30 border border-red-800 rounded p-3 text-sm text-red-300">{analyzeError}</div>
        <button onClick={regeneratePolish} className="mt-3 text-xs text-blue-400 hover:text-blue-300">重新生成</button>
      </div>
    )
  }

  if (polishSuggestions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-2">~</div>
          <p className="text-sm">暂无润色建议</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 批量操作 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/60 shrink-0">
        <span className="text-xs text-gray-400">{polishSuggestions.length} 条建议</span>
        <div className="flex gap-2">
          <button onClick={acceptAllSuggestions} className="text-xs text-green-400 hover:text-green-300">全部采纳</button>
          <button onClick={dismissAllSuggestions} className="text-xs text-gray-500 hover:text-gray-400">全部忽略</button>
        </div>
      </div>
      {/* 列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {polishSuggestions.map(s => <SuggestionCard key={s.id} suggestion={s} />)}
      </div>
      {/* 重新生成 */}
      <div className="p-2 border-t border-gray-700/60 shrink-0">
        <button onClick={regeneratePolish} className="w-full text-xs text-blue-400 hover:text-blue-300 py-1.5 rounded hover:bg-gray-700/50 transition-colors">
          ↻ 重新生成
        </button>
      </div>
    </div>
  )
}

// ─── Main RightPanel ───

const TABS = [
  { key: 'polish' as const, label: '润色', icon: '◎' },
  { key: 'summary' as const, label: '摘要', icon: '◉' },
  { key: 'dialogue' as const, label: '对话', icon: '💬' }
]

export default function RightPanel({ width }: { width?: number }) {
  const { rightPanel, setRightPanel, llmConfig, navLevel } = useAppStore()

  if (!rightPanel) return null

  const features = llmConfig.aiFeatures
  // Polish/summary only at chapter level, dialogue at all project levels
  const visibleTabs = TABS.filter(t => {
    if (!features[t.key]) return false
    if (t.key === 'polish' || t.key === 'summary') return navLevel === 'chapter'
    if (t.key === 'dialogue') return navLevel !== 'projects'
    return true
  })

  return (
    <div className="border-l border-gray-700 bg-gray-800 flex shrink-0" style={{ width: width ?? 320 }}>
      {/* 竖向标签栏 */}
      <div className="w-8 bg-gray-900/60 border-r border-gray-700/60 flex flex-col items-center py-2 gap-1 shrink-0">
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setRightPanel(tab.key)}
            title={tab.label}
            className={`w-6 h-6 rounded text-xs flex items-center justify-center transition-colors ${
              rightPanel === tab.key
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            {tab.icon}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setRightPanel(null)}
          title="关闭面板"
          className="w-6 h-6 rounded text-xs text-gray-600 hover:text-gray-300 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
        >
          ×
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {rightPanel === 'polish' && <PolishContent />}
        {rightPanel === 'summary' && <SummaryContent />}
        {rightPanel === 'dialogue' && <DialoguePanel />}
      </div>
    </div>
  )
}
