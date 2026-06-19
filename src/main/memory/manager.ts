import type { LLMConfigSingle, ProjectMemory } from '../../shared/types'
import { getStore, save } from '../store/db-core'
import { getEpisodicMemories, extractEpisodicMemory, getEpisodicContext } from './episodic'
import { getSemanticMemories, extractSemanticMemory, getSemanticContext } from './semantic'
import { getStyleMemories, analyzeStyle, getStyleContext } from './style'

export interface MemoryContext {
  episodic: string
  semantic: string
  style: string
  combined: string
}

/**
 * 获取项目的完整记忆上下文（用于注入到 Agent 提示词）
 */
export function getMemoryContext(projectId: string, maxChars: number = 5000): MemoryContext {
  const episodic = getEpisodicContext(projectId)
  const semantic = getSemanticContext(projectId)
  const style = getStyleContext(projectId)

  const parts = [episodic, semantic, style].filter(Boolean)
  const combined = parts.join('\n\n')

  return {
    episodic,
    semantic,
    style,
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
  lastUpdated: string | null
} {
  const episodic = getEpisodicMemories(projectId)
  const semantic = getSemanticMemories(projectId)
  const style = getStyleMemories(projectId)

  const dates = [
    ...episodic.map(e => e.updatedAt),
    ...semantic.map(e => e.updatedAt),
    ...style.map(e => e.updatedAt)
  ].sort()

  return {
    episodicCount: episodic.length,
    semanticCount: semantic.length,
    styleCount: style.length,
    lastUpdated: dates.length > 0 ? dates[dates.length - 1] : null
  }
}

/**
 * 清除项目的某类记忆
 */
export function clearMemory(projectId: string, layer: 'episodic' | 'semantic' | 'style' | 'all'): void {
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
