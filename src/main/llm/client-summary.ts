import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, BookAIConfig, APIProvider, AIFeatureAdvancedConfig } from '../../shared/types'
import { streamWithThinking } from './streaming'
import { getFeatureSkillContent } from './feature-skills'
import { createClient, detectProvider } from './client'
import { TIMEOUT } from './constants'

/** 将底层 LLM/网络错误包装为用户可读的中文提示 */
function friendlyLLMError(action: string, err: unknown): Error {
  const e = err as { name?: string; status?: number; message?: string }
  if (e?.name === 'AbortError') return new Error(`${action}已取消`)
  if (e?.status === 401 || e?.status === 403) return new Error(`${action}失败：API Key 无效或权限不足（${e.status}）`)
  if (e?.status === 429) return new Error(`${action}失败：请求过于频繁，请稍后重试（429 限流）`)
  if (e?.status && e.status >= 500) return new Error(`${action}失败：模型服务暂时不可用（${e.status}）`)
  return new Error(`${action}失败：${e?.message || String(err)}`)
}

// 本地模型诊断
export async function diagnoseLocalModel(config: LLMConfigSingle): Promise<string[]> {
  const results: string[] = []
  const baseUrl = config.baseUrl || ''
  const provider = detectProvider(config)

  if (provider !== 'ollama') return ['非本地模型，跳过诊断']

  // Stage 1: Check URL format
  if (!baseUrl.includes('/v1')) {
    results.push('❌ Base URL 缺少 /v1 后缀，应为 http://localhost:11434/v1')
  } else {
    results.push('✅ URL 格式正确')
  }

  // Stage 2: Test connection
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT.LOCAL_CONNECT)
    const res = await fetch(baseUrl.replace('/v1', '/api/tags'), { signal: controller.signal })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json() as any
      const models = data.models || []
      results.push(`✅ Ollama 服务连接成功，已安装 ${models.length} 个模型`)

      // Stage 3: Check if target model exists
      const targetModel = config.model || ''
      const found = models.find((m: any) =>
        m.name === targetModel || m.name.startsWith(targetModel + ':')
      )
      if (found) {
        results.push(`✅ 模型「${targetModel}」已找到`)
      } else {
        results.push(`❌ 模型「${targetModel}」未安装。可用模型：${models.map((m: any) => m.name).join(', ') || '无'}`)
      }
    } else {
      results.push(`❌ Ollama 服务返回 ${res.status}`)
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      results.push('❌ 连接超时（5秒），Ollama 服务可能未启动')
    } else {
      results.push(`❌ 无法连接 Ollama：${err.message}`)
    }
    results.push('💡 请确保 Ollama 已启动：运行 `ollama serve`')
    results.push('💡 如果是 Electron 应用，可能需要设置 OLLAMA_ORIGINS=* 环境变量')
  }

  // Stage 4: Test chat completions
  try {
    const client = createClient(config)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT.LOCAL_CHAT)
    const res = await client.chat.completions.create({
      model: config.model || 'llama3',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5
    }, { signal: controller.signal })
    clearTimeout(timeout)

    if (res.choices?.[0]?.message?.content) {
      results.push('✅ Chat API 测试成功')
    } else {
      results.push('⚠️ Chat API 返回了空响应')
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      results.push('❌ Chat API 超时（10秒），模型可能正在加载中')
    } else {
      results.push(`❌ Chat API 测试失败：${err.message}`)
    }
  }

  return results
}

export async function summarizeChapter(
  config: LLMConfigSingle,
  content: string,
  aiConfig?: Partial<BookAIConfig>,
  mainWindow?: BrowserWindow,
  signal?: AbortSignal
): Promise<string> {
  const client = createClient(config)

  const advancedConfig = aiConfig?.summaryAdvanced
  const skillPrompt = advancedConfig?.systemPrompt || getFeatureSkillContent('summary')
  const basePrompt = skillPrompt || `你是网文写作分析助手。请对章节内容进行结构化总结，按以下格式输出（每个分类下用 - 开头的条目）：

1. 主要人物
- 人物名：状态/作用

2. 关键事件
- 事件描述

3. 伏笔
- 伏笔内容

4. 场景
- 场景描述

5. 情感
- 情感基调描述

要求：条目简洁，每个条目一行，不要展开论述。`

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

  try {
    if (mainWindow) {
      return await streamWithThinking(mainWindow, client, config, {
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
  } catch (err) {
    if ((err as any)?.name === 'AbortError') throw err
    throw friendlyLLMError('章节摘要', err)
  }
}
