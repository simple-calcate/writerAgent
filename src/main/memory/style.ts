import { randomUUID } from 'crypto'
import type { StyleMemoryEntry } from '../../shared/types'
import { getStore, save } from '../store/db-core'
import { callLLMSync } from '../agent/base-agent'
import type { LLMConfigSingle } from '../../shared/types'

const ANALYZE_STYLE_PROMPT = `你是一位文学风格分析专家。请分析以下文本的写作风格特征。

以严格的 JSON 数组格式返回，不要包含其他文字：
[
  {
    "aspect": "tone",
    "pattern": "描述风格特征",
    "examples": ["示例1", "示例2"],
    "confidence": 0.8
  }
]

aspect 取值：
- tone：整体语调（如：沉稳、激昂、轻松、严肃）
- vocabulary：用词特征（如：古风、现代、简洁、华丽）
- sentence_structure：句式特征（如：短句为主、长句铺陈、排比多）
- dialogue_style：对话风格（如：简洁有力、含蓄委婉、幽默风趣）
- pacing：节奏特征（如：快节奏、张弛有度、慢热）
- custom：其他独特特征

confidence 取值 0-1，表示该特征的明显程度。只分析最显著的 3-5 个特征。`

// ─── CRUD ───

export function getStyleMemories(projectId: string): StyleMemoryEntry[] {
  return (getStore().styleMemories || []).filter(m => m.projectId === projectId)
}

export function getStyleByAspect(projectId: string, aspect: StyleMemoryEntry['aspect']): StyleMemoryEntry | undefined {
  return getStyleMemories(projectId).find(m => m.aspect === aspect)
}

export function saveStyleMemory(entry: StyleMemoryEntry): void {
  const store = getStore()
  if (!store.styleMemories) store.styleMemories = []
  const idx = store.styleMemories.findIndex(m => m.id === entry.id)
  if (idx >= 0) {
    store.styleMemories[idx] = entry
  } else {
    store.styleMemories.push(entry)
  }
  save()
}

export function upsertStyleMemory(entry: Omit<StyleMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): StyleMemoryEntry {
  const existing = getStyleByAspect(entry.projectId, entry.aspect)
  const full: StyleMemoryEntry = {
    id: existing?.id || randomUUID(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...entry
  }
  saveStyleMemory(full)
  return full
}

export function deleteStyleMemory(id: string): void {
  const store = getStore()
  if (!store.styleMemories) return
  store.styleMemories = store.styleMemories.filter(m => m.id !== id)
  save()
}

// ─── 智能分析 ───

export async function analyzeStyle(
  content: string,
  projectId: string,
  config: LLMConfigSingle,
  signal?: AbortSignal
): Promise<StyleMemoryEntry[]> {
  const result = await callLLMSync({
    config,
    messages: [
      { role: 'system', content: ANALYZE_STYLE_PROMPT },
      { role: 'user', content: content.substring(0, 4000) }
    ],
    temperature: 0.3,
    signal
  })

  const parsed = parseStyleEntries(result.content, projectId)
  const saved: StyleMemoryEntry[] = []
  for (const entry of parsed) {
    saved.push(upsertStyleMemory(entry))
  }
  return saved
}

function parseStyleEntries(raw: string, projectId: string): Array<Omit<StyleMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>> {
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []

    const validAspects = ['tone', 'vocabulary', 'sentence_structure', 'dialogue_style', 'pacing', 'custom']
    return parsed
      .filter((e: any) => e.pattern)
      .map((e: any) => ({
        projectId,
        aspect: validAspects.includes(e.aspect) ? e.aspect : 'custom',
        pattern: e.pattern,
        examples: Array.isArray(e.examples) ? e.examples.slice(0, 3) : [],
        confidence: typeof e.confidence === 'number' ? Math.max(0, Math.min(1, e.confidence)) : 0.5,
        source: 'learned' as const
      }))
  } catch {
    return []
  }
}

/**
 * 获取项目的风格记忆上下文（用于 Writer Agent）
 */
export function getStyleContext(projectId: string): string {
  const memories = getStyleMemories(projectId)
  if (memories.length === 0) return ''

  const aspectLabels: Record<string, string> = {
    tone: '语调',
    vocabulary: '用词',
    sentence_structure: '句式',
    dialogue_style: '对话风格',
    pacing: '节奏',
    custom: '其他'
  }

  const parts = memories
    .sort((a, b) => b.confidence - a.confidence)
    .map(m => {
      const label = aspectLabels[m.aspect] || m.aspect
      const examples = m.examples.length > 0 ? `（如："${m.examples[0]}"）` : ''
      return `- ${label}：${m.pattern}${examples}`
    })

  return `## 文风特征\n${parts.join('\n')}`
}

/**
 * 用户手动设置风格偏好
 */
export function setUserStylePreference(
  projectId: string,
  aspect: StyleMemoryEntry['aspect'],
  pattern: string
): StyleMemoryEntry {
  return upsertStyleMemory({
    projectId,
    aspect,
    pattern,
    examples: [],
    confidence: 1.0,
    source: 'user_defined'
  })
}
