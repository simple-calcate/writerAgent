import type { LLMConfigSingle, ProjectMemory, DialogueSummaryEntry } from '../../shared/types'
import { getStore, save } from '../store/db-core'
import { getEpisodicMemories, extractEpisodicMemory, getEpisodicContext } from './episodic'
import { getSemanticMemories, extractSemanticMemory, getSemanticContext } from './semantic'
import { getStyleMemories, analyzeStyle, getStyleContext } from './style'

export interface MemoryContext {
  episodic: string
  semantic: string
  style: string
  dialogue: string
  combined: string
}

/**
 * 获取项目的完整记忆上下文（用于注入到 Agent 提示词）
 */
export function getMemoryContext(projectId: string, maxChars: number = 5000): MemoryContext {
  const episodic = getEpisodicContext(projectId)
  const semantic = getSemanticContext(projectId)
  const style = getStyleContext(projectId)
  const dialogue = getDialogueSummaryContext(projectId)

  const parts = [episodic, semantic, style, dialogue].filter(Boolean)
  const combined = parts.join('\n\n')

  return {
    episodic,
    semantic,
    style,
    dialogue,
    combined: combined.length > maxChars ? combined.substring(0, maxChars) + '...' : combined
  }
}

/**
 * 在写作任务完成后自动提取和更新记忆
 */
export async function commitMemory(
  projectId: string,
  chapterId: string,
  chapterTitle: string,
  content: string,
  config: LLMConfigSingle,
  signal?: AbortSignal
): Promise<void> {
  // 并行提取三种记忆
  await Promise.allSettled([
    extractEpisodicMemory(chapterId, chapterTitle, content, projectId, config, signal),
    extractSemanticMemory(content, projectId, config, signal),
    analyzeStyle(content, projectId, config, signal)
  ])
}

/**
 * 获取项目的记忆摘要（轻量级，用于快速查看）
 */
export function getMemorySummary(projectId: string): {
  episodicCount: number
  semanticCount: number
  styleCount: number
  dialogueCount: number
  lastUpdated: string | null
} {
  const episodic = getEpisodicMemories(projectId)
  const semantic = getSemanticMemories(projectId)
  const style = getStyleMemories(projectId)
  const dialogue = getDialogueSummaries(projectId)

  const dates = [
    ...episodic.map(e => e.updatedAt),
    ...semantic.map(e => e.updatedAt),
    ...style.map(e => e.updatedAt),
    ...dialogue.map(e => e.compressedAt)
  ].sort()

  return {
    episodicCount: episodic.length,
    semanticCount: semantic.length,
    styleCount: style.length,
    dialogueCount: dialogue.length,
    lastUpdated: dates.length > 0 ? dates[dates.length - 1] : null
  }
}

/**
 * 清除项目的某类记忆
 */
export function clearMemory(projectId: string, layer: 'episodic' | 'semantic' | 'style' | 'dialogue' | 'all'): void {
  const store = getStore()

  if (layer === 'episodic' || layer === 'all') {
    store.episodicMemories = (store.episodicMemories || []).filter(m => m.projectId !== projectId)
  }
  if (layer === 'semantic' || layer === 'all') {
    store.semanticMemories = (store.semanticMemories || []).filter(m => m.projectId !== projectId)
  }
  if (layer === 'style' || layer === 'all') {
    store.styleMemories = (store.styleMemories || []).filter(m => m.projectId !== projectId)
  }
  if (layer === 'dialogue' || layer === 'all') {
    store.dialogueSummaries = (store.dialogueSummaries || []).filter(m => m.projectId !== projectId)
  }

  save()
}

/**
 * 将记忆上下文注入到 Agent 执行上下文中
 */
export function buildMemorySystemPrompt(projectId: string): string {
  const ctx = getMemoryContext(projectId)
  if (!ctx.combined) return ''
  return ctx.combined
}

// ─── 对话摘要记忆 ───

/**
 * 保存对话压缩摘要到记忆系统
 */
export function saveDialogueSummary(
  projectId: string,
  level: string,
  entityId: string,
  summary: string,
  messageCount: number
): void {
  if (!summary || !projectId) return

  const store = getStore()
  if (!store.dialogueSummaries) {
    store.dialogueSummaries = []
  }

  const entry: DialogueSummaryEntry = {
    id: `ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    level,
    entityId,
    summary,
    messageCount,
    compressedAt: new Date().toISOString()
  }

  store.dialogueSummaries.push(entry)

  // 每个项目最多保留 50 条对话摘要
  const projectSummaries = store.dialogueSummaries.filter(m => m.projectId === projectId)
  if (projectSummaries.length > 50) {
    const toRemove = projectSummaries.slice(0, projectSummaries.length - 50)
    const removeIds = new Set(toRemove.map(m => m.id))
    store.dialogueSummaries = store.dialogueSummaries.filter(m => !removeIds.has(m.id))
  }

  save()
}

/**
 * 获取项目的对话摘要列表
 */
export function getDialogueSummaries(projectId: string): DialogueSummaryEntry[] {
  const store = getStore()
  return (store.dialogueSummaries || []).filter(m => m.projectId === projectId)
}

/**
 * 获取对话摘要上下文字符串（用于注入提示词）
 */
function getDialogueSummaryContext(projectId: string): string {
  const summaries = getDialogueSummaries(projectId)
  if (summaries.length === 0) return ''

  const recent = summaries.slice(-5)
  const lines = recent.map(s => `- ${s.summary}`)
  return `【对话历史摘要】\n${lines.join('\n')}`
}
