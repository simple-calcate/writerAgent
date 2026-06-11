import OpenAI from 'openai'
import type { LLMConfigSingle, APIProvider } from '../../shared/types'

// Re-export from split modules
export { polishText, autoPolish } from './client-polish'
export { summarizeChapter, diagnoseLocalModel } from './client-summary'

export function createClient(config: LLMConfigSingle): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey || 'ollama',
    baseURL: config.baseUrl || 'https://api.openai.com/v1'
  })
}

// 是否为本地模型（不支持某些参数）
export function isLocalProvider(config: LLMConfigSingle): boolean {
  return detectProvider(config) === 'ollama'
}

// 思考深度预设 → token 预算映射
const THINKING_BUDGET_PRESETS: Record<string, number> = {
  low: 2048,
  medium: 8192,
  high: 32768
}

// 检测 API 提供商（URL 优先，模型名兜底）
export function detectProvider(config: LLMConfigSingle): APIProvider {
  const baseUrl = (config.baseUrl || '').toLowerCase()
  const model = (config.model || '').toLowerCase()

  if (baseUrl.includes('deepseek')) return 'deepseek'
  if (baseUrl.includes('anthropic') || baseUrl.includes('claude')) return 'claude'
  if (baseUrl.includes('moonshot') || baseUrl.includes('kimi')) return 'moonshot'
  if (baseUrl.includes('qwen') || baseUrl.includes('dashscope') || baseUrl.includes('tongyi')) return 'qwen'
  if (baseUrl.includes('localhost:11434') || baseUrl.includes('127.0.0.1:11434')) return 'ollama'
  if (baseUrl.includes('openrouter.ai')) return 'openrouter'
  if (baseUrl.includes('openai.com')) return 'openai'

  if (model.startsWith('deepseek')) return 'deepseek'
  if (model.startsWith('o1') || model.startsWith('o3')) return 'openai'
  if (model.startsWith('claude')) return 'claude'
  if (model.startsWith('qwen')) return 'qwen'

  return 'generic'
}

// 根据思考深度设置和 API 提供商构建请求参数
export function buildThinkingParams(config: LLMConfigSingle): Record<string, any> {
  const td = config.thinkingDepth
  if (!td || td.preset === 'off') return {}

  const provider = detectProvider(config)
  const budget = td.preset === 'custom'
    ? (td.budgetTokens || 8192)
    : (THINKING_BUDGET_PRESETS[td.preset] || 8192)

  switch (provider) {
    case 'deepseek':
    case 'qwen':
      return { enable_thinking: true, max_tokens: budget }
    case 'openai':
      return {
        reasoning_effort: td.preset === 'custom'
          ? (budget <= 2048 ? 'low' : budget <= 8192 ? 'medium' : 'high')
          : td.preset
      }
    case 'claude':
      return { thinking: { type: 'enabled', budget_tokens: budget } }
    default:
      return {}
  }
}

export function hasThinkingParams(config: LLMConfigSingle): boolean {
  const td = config.thinkingDepth
  return !!td && td.preset !== 'off' && Object.keys(buildThinkingParams(config)).length > 0
}
