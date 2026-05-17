import type { LLMConfigSingle, BookAIConfig } from '../../shared/types'
import { createClient } from './client'

export async function generateContinuation(
  config: LLMConfigSingle,
  params: {
    content: string
    cursorPosition: number
    chapterOutline?: string | null
    volumeOutline?: string | null
    bookOutline?: string | null
    aiConfig?: Partial<BookAIConfig>
  }
): Promise<string> {
  const client = createClient(config)
  const { content, cursorPosition, chapterOutline, volumeOutline, bookOutline, aiConfig } = params

  const beforeCursor = content.substring(Math.max(0, cursorPosition - 2000), cursorPosition)

  // 检测光标所在行是否为注释
  const lineStart = content.lastIndexOf('\n', cursorPosition - 1) + 1
  const lineEnd = content.indexOf('\n', cursorPosition)
  const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd).trimStart()
  const isComment = currentLine.startsWith('//')
  const commentText = isComment ? currentLine.replace(/^\/\/\s*/, '') : ''

  let outlineSection = ''
  if (chapterOutline) {
    outlineSection = `\n\n【本章大纲】\n${chapterOutline}`
  } else if (volumeOutline) {
    outlineSection = `\n\n【本卷大纲】\n${volumeOutline}`
  } else if (bookOutline) {
    outlineSection = `\n\n【书籍大纲】\n${bookOutline}`
  }

  let systemPrompt: string
  let userMessage: string

  if (isComment) {
    systemPrompt = `你是一位网文写作助手。作者留下了一条注释（// 开头），可能是疑问或 TODO。
根据上下文和大纲，直接输出能解答困惑的正文。不要解释、不要评论、不要重复注释。
${aiConfig?.customPrompt ? '\n补充要求：' + aiConfig.customPrompt : ''}

输出规则：
- 默认只写 1-2 句话
- 仅当大纲中明确描述了该片段的详细内容时，才可以写 1 个自然段
- 保持与前文一致的文风和人称`
    userMessage = `【作者注释】${commentText}\n\n【光标前文】\n${beforeCursor}${outlineSection}`
  } else {
    systemPrompt = `你是一位网文写作助手。根据上下文提供续写建议。不要解释、不要评论。
${aiConfig?.customPrompt ? '\n补充要求：' + aiConfig.customPrompt : ''}

输出规则：
- 默认只写 1-2 句话，自然衔接上下文
- 仅当大纲中明确描述了当前片段的详细剧情时，才可以写 1 个自然段
- 保持与前文一致的文风和人称`
    userMessage = `【光标前文】\n${beforeCursor}${outlineSection}`
  }

  const response = await client.chat.completions.create({
    model: config.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: 20480
  })

  const choice = response.choices?.[0]
  const raw = choice?.message?.content
  return raw?.trim() || ''
}
