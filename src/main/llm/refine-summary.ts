import type { LLMConfig, BookAIConfig } from '../../shared/types'
import { createClient } from './client'

export async function refineSummary(
  config: LLMConfig,
  content: string,
  aiConfig?: Partial<BookAIConfig>
): Promise<string> {
  const client = createClient(config)

  const response = await client.chat.completions.create({
    model: config.model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `你是一位网文写作分析助手。请用一段简洁连贯的文字概括这一章的核心内容。

要求：
- 用 2-5 句话概括本章发生了什么
- 突出核心情节转折和关键人物行动
- 不要分条目，写成一段流畅的文字
- 语言精炼，避免废话
${aiConfig?.summaryStandard ? '\n摘要标准：' + aiConfig.summaryStandard : ''}
${aiConfig?.customPrompt ? '\n补充要求：' + aiConfig.customPrompt : ''}`
      },
      { role: 'user', content }
    ],
    temperature: 0.3,
    max_tokens: 512
  })

  return response.choices[0]?.message?.content?.trim() || '无法生成总结'
}
