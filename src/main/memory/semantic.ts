import { randomUUID } from 'crypto'
import type { SemanticMemoryEntry, SemanticRelation } from '../../shared/types'
import { getStore, save } from '../store/db-core'
import { callLLMSync } from '../agent/base-agent'
import type { LLMConfigSingle } from '../../shared/types'

const EXTRACT_SEMANTIC_PROMPT = `你是一位小说世界观分析专家。请从内容中提取世界观/设定/人物信息。

以严格的 JSON 数组格式返回，不要包含其他文字：
[
  {
    "category": "character",
    "name": "名称",
    "content": "描述",
    "relations": [{"targetId": "相关名称", "type": "related_to", "description": "关系描述"}],
    "tags": ["标签1", "标签2"]
  }
]

category 取值：
- character：人物角色
- worldbuilding：世界观设定
- setting：场景/地点
- rule：规则/法则
- lore：传说/背景

relation type 取值：related_to | part_of | opposes | supports | depends_on`

// ─── CRUD ───

export function getSemanticMemories(projectId: string): SemanticMemoryEntry[] {
  return (getStore().semanticMemories || []).filter(m => m.projectId === projectId)
}

export function getSemanticByCategory(projectId: string, category: SemanticMemoryEntry['category']): SemanticMemoryEntry[] {
  return getSemanticMemories(projectId).filter(m => m.category === category)
}

export function getSemanticByName(projectId: string, name: string): SemanticMemoryEntry | undefined {
  return getSemanticMemories(projectId).find(m => m.name === name)
}

export function saveSemanticMemory(entry: SemanticMemoryEntry): void {
  const store = getStore()
  if (!store.semanticMemories) store.semanticMemories = []
  const idx = store.semanticMemories.findIndex(m => m.id === entry.id)
  if (idx >= 0) {
    store.semanticMemories[idx] = entry
  } else {
    store.semanticMemories.push(entry)
  }
  save()
}

export function deleteSemanticMemory(id: string): void {
  const store = getStore()
  if (!store.semanticMemories) return
  store.semanticMemories = store.semanticMemories.filter(m => m.id !== id)
  save()
}

export function upsertSemanticMemory(entry: Omit<SemanticMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): SemanticMemoryEntry {
  const existing = getSemanticByName(entry.projectId, entry.name)
  const full: SemanticMemoryEntry = {
    id: existing?.id || randomUUID(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...entry
  }
  saveSemanticMemory(full)
  return full
}

// ─── 智能提取 ───

export async function extractSemanticMemory(
  content: string,
  projectId: string,
  config: LLMConfigSingle,
  signal?: AbortSignal
): Promise<SemanticMemoryEntry[]> {
  const result = await callLLMSync({
    config,
    messages: [
      { role: 'system', content: EXTRACT_SEMANTIC_PROMPT },
      { role: 'user', content: content.substring(0, 4000) }
    ],
    temperature: 0.3,
    signal
  })

  const parsed = parseSemanticEntries(result.content, projectId)
  const saved: SemanticMemoryEntry[] = []
  for (const entry of parsed) {
    saved.push(upsertSemanticMemory(entry))
  }
  return saved
}

function parseSemanticEntries(raw: string, projectId: string): Array<Omit<SemanticMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>> {
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []

    const validCategories = ['worldbuilding', 'character', 'setting', 'rule', 'lore']
    return parsed
      .filter((e: any) => e.name && e.content)
      .map((e: any) => ({
        projectId,
        category: validCategories.includes(e.category) ? e.category : 'worldbuilding',
        name: e.name,
        content: e.content,
        relations: Array.isArray(e.relations) ? e.relations.map((r: any) => ({
          targetId: r.targetId || '',
          type: ['related_to', 'part_of', 'opposes', 'supports', 'depends_on'].includes(r.type) ? r.type : 'related_to',
          description: r.description || ''
        })) : [],
        tags: Array.isArray(e.tags) ? e.tags : []
      }))
  } catch {
    return []
  }
}

/**
 * 获取项目的语义记忆上下文（用于 LLM）
 */
export function getSemanticContext(projectId: string, maxChars: number = 3000): string {
  const memories = getSemanticMemories(projectId)
  if (memories.length === 0) return ''

  const parts: string[] = []
  const categories = ['character', 'worldbuilding', 'setting', 'rule', 'lore'] as const
  const categoryLabels: Record<string, string> = {
    character: '人物',
    worldbuilding: '世界观',
    setting: '场景',
    rule: '规则',
    lore: '传说'
  }

  for (const cat of categories) {
    const items = memories.filter(m => m.category === cat)
    if (items.length === 0) continue

    const itemsStr = items.map(m => {
      const relations = m.relations.length > 0
        ? `（关联：${m.relations.map(r => r.targetId).join('、')}）`
        : ''
      return `- ${m.name}：${m.content.substring(0, 200)}${relations}`
    }).join('\n')

    parts.push(`### ${categoryLabels[cat]}\n${itemsStr}`)
  }

  if (parts.length === 0) return ''

  const full = `## 世界观与设定\n${parts.join('\n\n')}`
  return full.length > maxChars ? full.substring(0, maxChars) + '...' : full
}
