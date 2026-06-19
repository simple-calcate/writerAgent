import { randomUUID } from 'crypto'
import type { EpisodicMemoryEntry, PlotEvent } from '../../shared/types'
import { getStore, save } from '../store/db-core'
import { callLLMSync } from '../agent/base-agent'
import type { LLMConfigSingle } from '../../shared/types'

const EXTRACT_EVENTS_PROMPT = `你是一位小说分析专家。请从章节内容中提取关键剧情事件。

以严格的 JSON 数组格式返回，不要包含其他文字：
[
  {
    "description": "事件描述",
    "characters": ["角色1", "角色2"],
    "location": "地点",
    "importance": "high",
    "consequences": ["后果1", "后果2"]
  }
]

importance 取值：low（日常）| medium（推进情节）| high（关键转折）| critical（重大事件）`

const SUMMARIZE_CHAPTER_PROMPT = `请用 2-3 句话概括以下章节的核心内容，突出关键事件和人物发展。`

// ─── CRUD ───

export function getEpisodicMemories(projectId: string): EpisodicMemoryEntry[] {
  return (getStore().episodicMemories || []).filter(m => m.projectId === projectId)
}

export function getEpisodicByChapter(chapterId: string): EpisodicMemoryEntry | undefined {
  return (getStore().episodicMemories || []).find(m => m.chapterId === chapterId)
}

export function saveEpisodicMemory(entry: EpisodicMemoryEntry): void {
  const store = getStore()
  if (!store.episodicMemories) store.episodicMemories = []
  const idx = store.episodicMemories.findIndex(m => m.id === entry.id)
  if (idx >= 0) {
    store.episodicMemories[idx] = entry
  } else {
    store.episodicMemories.push(entry)
  }
  save()
}

export function deleteEpisodicMemory(id: string): void {
  const store = getStore()
  if (!store.episodicMemories) return
  store.episodicMemories = store.episodicMemories.filter(m => m.id !== id)
  save()
}

// ─── 智能提取 ───

export async function extractEpisodicMemory(
  chapterId: string,
  chapterTitle: string,
  content: string,
  projectId: string,
  config: LLMConfigSingle,
  signal?: AbortSignal
): Promise<EpisodicMemoryEntry> {
  const existing = getEpisodicByChapter(chapterId)

  // 提取事件
  const eventsResult = await callLLMSync({
    config,
    messages: [
      { role: 'system', content: EXTRACT_EVENTS_PROMPT },
      { role: 'user', content: `章节标题：${chapterTitle}\n\n${content.substring(0, 4000)}` }
    ],
    temperature: 0.3,
    signal
  })

  const events = parseEvents(eventsResult.content)

  // 生成摘要
  const summaryResult = await callLLMSync({
    config,
    messages: [
      { role: 'system', content: SUMMARIZE_CHAPTER_PROMPT },
      { role: 'user', content: `章节标题：${chapterTitle}\n\n${content.substring(0, 3000)}` }
    ],
    temperature: 0.3,
    signal
  })

  // 提取关键决策
  const decisions = events
    .filter(e => e.importance === 'high' || e.importance === 'critical')
    .map(e => e.description)

  const entry: EpisodicMemoryEntry = {
    id: existing?.id || randomUUID(),
    projectId,
    chapterId,
    chapterTitle,
    events,
    summary: summaryResult.content.substring(0, 500),
    emotionalTone: detectEmotionalTone(content),
    keyDecisions: decisions,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  saveEpisodicMemory(entry)
  return entry
}

function parseEvents(raw: string): PlotEvent[] {
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    return parsed.map((e: any) => ({
      id: randomUUID(),
      description: e.description || '',
      characters: Array.isArray(e.characters) ? e.characters : [],
      location: e.location || '',
      importance: ['low', 'medium', 'high', 'critical'].includes(e.importance) ? e.importance : 'medium',
      consequences: Array.isArray(e.consequences) ? e.consequences : []
    }))
  } catch {
    return []
  }
}

function detectEmotionalTone(content: string): string {
  const tones: Record<string, string[]> = {
    '紧张': ['紧张', '危险', '恐惧', '害怕', '心跳', '颤抖'],
    '热血': ['战斗', '怒吼', '力量', '爆发', '燃烧', '咆哮'],
    '温馨': ['温暖', '微笑', '拥抱', '幸福', '甜蜜', '安心'],
    '悲伤': ['泪水', '悲伤', '痛苦', '失去', '离别', '孤独'],
    '悬疑': ['神秘', '诡异', '线索', '推理', '真相', '谜团'],
    '轻松': ['轻松', '幽默', '搞笑', '调侃', '打趣', '欢笑']
  }

  const scores: Record<string, number> = {}
  for (const [tone, keywords] of Object.entries(tones)) {
    scores[tone] = keywords.reduce((sum, kw) => sum + (content.includes(kw) ? 1 : 0), 0)
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  return sorted[0][1] > 0 ? sorted[0][0] : '平淡'
}

/**
 * 获取项目所有章节的事件记忆摘要（用于上下文）
 */
export function getEpisodicContext(projectId: string, maxEntries: number = 10): string {
  const memories = getEpisodicMemories(projectId)
  if (memories.length === 0) return ''

  const recent = memories.slice(-maxEntries)
  const parts = recent.map(m => {
    const eventsStr = m.events
      .filter(e => e.importance === 'high' || e.importance === 'critical')
      .map(e => `- ${e.description}`)
      .join('\n')
    return `【${m.chapterTitle}】${m.summary}${eventsStr ? '\n' + eventsStr : ''}`
  })

  return `## 剧情记忆\n${parts.join('\n\n')}`
}
