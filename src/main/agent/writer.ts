import type { AgentExecutionContext } from '../../shared/types'
import { callWithTools } from '../llm/call-with-tools'
import { buildDialogueSystemPrompt } from '../llm/dialogue-prompts'
import { getOutline, getSkills, getChapters, getVolumes } from '../store/db'
import { resolveAIConfig, getContextConfig } from '../store/db'
import { log } from '../utils/logger'

export interface WriterParams {
  instruction: string
  context: AgentExecutionContext
  streamId?: string
  existingContent?: string
  criticFeedback?: string
  memoryContext?: string
}

export async function executeWriter(params: WriterParams): Promise<string> {
  const { instruction, context, streamId, existingContent, criticFeedback, memoryContext } = params
  const { config, project, volume, chapter, mainWindow, signal } = context

  const allChapters = getChapters(project.id)
  const allVolumes = getVolumes(project.id)

  // 复用 dialogue-prompts 构建完整系统提示词（含章节列表、大纲、技能等）
  const outlines = [
    getOutline('book', project.id),
    volume ? getOutline('volume', volume.id) : null,
    chapter ? getOutline('chapter', chapter.id) : null
  ].filter(Boolean)

  const allSkills = getSkills()
  const skillIds = project.featureSkillIds?.dialogue || project.enabledSkillIds || []
  const enabledSkills = skillIds.length > 0 ? allSkills.filter(s => skillIds.includes(s.id)) : []

  const systemPrompt = buildDialogueSystemPrompt({
    level: context.taskContext.level,
    project,
    volume: volume || null,
    chapter: chapter || null,
    allVolumes,
    allChapters,
    outlines: outlines as any[],
    isPlanMode: false,
    skills: enabledSkills,
    reasoningContext: memoryContext || '',
    contextWindow: config.contextWindow,
    contextConfig: getContextConfig()
  })

  // 构建用户消息（含额外上下文）
  const contextParts: string[] = []
  if (context.taskContext.previousSummaries && context.taskContext.previousSummaries.length > 0) {
    contextParts.push(`## 前文摘要\n${context.taskContext.previousSummaries.join('\n')}`)
  }
  if (existingContent) contextParts.push(`## 已有内容\n${existingContent}`)
  if (criticFeedback) contextParts.push(`## 评审反馈（请根据此反馈改进）\n${criticFeedback}`)

  const userMessage = contextParts.length > 0
    ? `${contextParts.join('\n\n')}\n\n## 写作任务\n${instruction}`
    : `## 写作任务\n${instruction}`

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage }
  ]

  const result = await callWithTools({
    config,
    mainWindow,
    messages,
    level: context.taskContext.level,
    project,
    volume: volume || null,
    chapter: chapter || null,
    allChapters,
    allVolumes,
    aiConfig: resolveAIConfig(project),
    contextConfig: getContextConfig(),
    temperature: 0.8,
    signal,
    streamId
  })

  log.debug(`[Writer] 完成: ${result.toolCallsMade} 次工具调用`)
  return result.content
}
