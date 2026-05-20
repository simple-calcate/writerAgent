import type { LLMConfigSingle, BookAIConfig } from '../../shared/types'
import { createClient } from './client'

export async function refineSummary(
  config: LLMConfigSingle,
  content: string,
  aiConfig?: Partial<BookAIConfig>
): Promise<string> {
  const client = createClient(config)

  const response = await client.chat.completions.create({
    model: config.model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `你是一位网文写作分析助手。请按场景梳理这一章的剧情脉络，输出一段连贯的总结。

要求：
- 按场景顺序梳理：每个场景的核心事件、人物行动、情感变化
- 保留关键转折点和剧情推进的关键信息
- 如果有伏笔或悬念，明确指出
- 写成连贯段落，不要分条目
- 语言精炼，信息密度高，避免废话
${aiConfig?.summaryStandard ? '\n摘要标准：' + aiConfig.summaryStandard : ''}
${aiConfig?.customPrompt ? '\n补充要求：' + aiConfig.customPrompt : ''}`
      },
      { role: 'user', content }
    ],
    temperature: 0.3,
    ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
  })

  return response.choices[0]?.message?.content?.trim() || '无法生成总结'
}
