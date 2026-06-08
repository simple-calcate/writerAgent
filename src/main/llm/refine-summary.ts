import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, BookAIConfig } from '../../shared/types'
import { createClient } from './client'
import { streamWithThinking } from './streaming'
import { getFeatureSkillContent } from './feature-skills'

export async function refineSummary(
  config: LLMConfigSingle,
  content: string,
  aiConfig?: Partial<BookAIConfig>,
  mainWindow?: BrowserWindow,
  signal?: AbortSignal
): Promise<string> {
  const client = createClient(config)

  const advancedConfig = aiConfig?.refineSummaryAdvanced
  const skillPrompt = advancedConfig?.systemPrompt || getFeatureSkillContent('refineSummary')
  const basePrompt = skillPrompt || `你是一位网文写作分析助手。请按场景梳理这一章的剧情脉络，输出一段连贯的总结。

要求：
- 按场景顺序梳理：每个场景的核心事件、人物行动、情感变化
- 保留关键转折点和剧情推进的关键信息
- 如果有伏笔或悬念，明确指出
- 写成连贯段落，不要分条目
- 语言精炼，信息密度高，避免废话`

  const messages = [
    {
      role: 'system' as const,
      content: `${basePrompt}
${aiConfig?.summaryStandard ? '\n摘要标准：' + aiConfig.summaryStandard : ''}
${aiConfig?.customPrompt ? '\n补充要求：' + aiConfig.customPrompt : ''}`
    },
    { role: 'user' as const, content }
  ]

  const temperature = advancedConfig?.temperature ?? 0.3

  if (mainWindow) {
    return streamWithThinking(mainWindow, client, config, {
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature,
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
    }, signal) || '无法生成总结'
  }

  const response = await client.chat.completions.create({
    model: config.model || 'gpt-4o-mini',
    messages,
    temperature,
    ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
  })

  return response.choices[0]?.message?.content?.trim() || '无法生成总结'
}
