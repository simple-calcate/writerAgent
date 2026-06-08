import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, BookAIConfig, WritingSkill } from '../../shared/types'
import { createClient } from './client'
import { streamWithThinking } from './streaming'
import { getFeatureSkillContent } from './feature-skills'

export async function generateContinuation(
  config: LLMConfigSingle,
  params: {
    content: string
    cursorPosition: number
    chapterOutline?: string | null
    volumeOutline?: string | null
    bookOutline?: string | null
    aiConfig?: Partial<BookAIConfig>
    skills?: WritingSkill[]
    mainWindow?: BrowserWindow
    signal?: AbortSignal
  }
): Promise<string> {
  const client = createClient(config)
  const { content, chapterOutline, volumeOutline, bookOutline, aiConfig } = params

  // 光标在末尾，取章节末尾内容作为上下文
  const tailContent = content.slice(-2000)

  // 检测最后一行是否为注释
  const lastNewline = content.lastIndexOf('\n')
  const lastLine = content.substring(lastNewline + 1).trimStart()
  const isComment = lastLine.startsWith('//')
  const commentText = isComment ? lastLine.replace(/^\/\/\s*/, '') : ''

  let outlineSection = ''
  if (chapterOutline) {
    outlineSection = `\n\n【本章大纲】\n${chapterOutline}`
  } else if (volumeOutline) {
    outlineSection = `\n\n【本卷大纲】\n${volumeOutline}`
  } else if (bookOutline) {
    outlineSection = `\n\n【书籍大纲】\n${bookOutline}`
  }

  let skillsSection = ''
  if (params.skills && params.skills.length > 0) {
    const skillTexts = params.skills.map(s => `- ${s.name}：${s.content.substring(0, 200)}`).join('\n')
    skillsSection = `\n\n【写作技能参考】\n${skillTexts}`
  }

  const advancedConfig = aiConfig?.continuationAdvanced
  const skillPrompt = advancedConfig?.systemPrompt || getFeatureSkillContent('continuation')

  let systemPrompt: string
  let userMessage: string

  if (isComment) {
    const defaultCommentPrompt = `你是一位网文写作助手。作者在章节末尾留下了一条注释（// 开头），可能是疑问或 TODO。
根据上下文和大纲，直接输出能解答困惑的正文。不要解释、不要评论、不要重复注释。

输出规则：
- 默认只写 1-2 句话
- 仅当大纲中明确描述了该片段的详细内容时，才可以写 1 个自然段
- 保持与前文一致的文风和人称`
    systemPrompt = `${skillPrompt || defaultCommentPrompt}
${aiConfig?.customPrompt ? '\n补充要求：' + aiConfig.customPrompt : ''}`
    userMessage = `【作者注释】${commentText}\n\n【章节末尾内容】\n${tailContent}${outlineSection}${skillsSection}`
  } else {
    const defaultNormalPrompt = `你是一位网文写作助手。作者正在写到章节末尾，需要你提供续写建议。不要解释、不要评论。

输出规则：
- 默认只写 1-2 句话，自然衔接前文
- 仅当大纲中明确描述了后续详细剧情时，才可以写 1 个自然段
- 保持与前文一致的文风和人称`
    systemPrompt = `${skillPrompt || defaultNormalPrompt}
${aiConfig?.customPrompt ? '\n补充要求：' + aiConfig.customPrompt : ''}`
    userMessage = `【章节末尾内容】\n${tailContent}${outlineSection}${skillsSection}`
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage }
  ]

  const temperature = advancedConfig?.temperature ?? 0.7

  if (params.mainWindow) {
    const result = await streamWithThinking(params.mainWindow, client, config, {
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature,
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
    }, params.signal)
    return result?.trim() || ''
  }

  const response = await client.chat.completions.create({
    model: config.model || 'gpt-4o-mini',
    messages,
    temperature,
    ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
  })

  const choice = response.choices?.[0]
  const raw = choice?.message?.content
  return raw?.trim() || ''
}
