// Token 估算与预算管理
// 使用字符比例估算，不引入 tiktoken 以控制 Electron 打包体积

import type { ContextConfig } from '../../shared/types'
import { DEFAULT_CONTEXT_CONFIG } from '../../shared/types'

// ─── 估算函数 ───

// 中文字符正则
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/
const CJK_RANGE_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g

/**
 * 估算文本的 token 数量
 * 中文: ~1.5 token/字  英文: ~0.25 token/word (约 4 字符/token)
 * 混合文本取加权值，误差 ±20% 可接受
 */
export function estimateTokens(text: string): number {
  if (!text) return 0

  // 提取中文片段
  const cjkMatches = text.match(CJK_RANGE_RE)
  const cjkChars = cjkMatches ? cjkMatches.reduce((sum, m) => sum + m.length, 0) : 0

  // 非中文部分按英文估算
  const nonCjkText = text.replace(CJK_RANGE_RE, ' ')
  const nonCjkChars = nonCjkText.length

  // 中文 1.5 token/字 + 英文 1 token/4 字符 + 基础开销
  return Math.ceil(cjkChars * 1.5 + nonCjkChars / 4 + 3)
}

/**
 * 估算多条消息的总 token 数
 */
export function estimateMessagesTokens(messages: Array<{ role: string; content: string }>): number {
  let total = 0
  for (const msg of messages) {
    // 每条消息有固定开销 (~4 tokens for role/formatting)
    total += estimateTokens(msg.content) + 4
  }
  return total
}

// ─── 预算管理 ───

export interface TokenBudget {
  total: number         // 模型上下文窗口大小
  reserve: number       // 预留给模型输出
  available: number     // 可用于输入的 token 数 (total - reserve)
}

export interface SectionBudget {
  name: string
  maxTokens: number
  priority: 'critical' | 'high' | 'medium' | 'low'
}

// 默认上下文窗口大小（当用户未配置时）
const DEFAULT_CONTEXT_WINDOW = 128000

/**
 * 创建 token 预算
 */
export function createBudget(contextWindow?: number, contextConfig?: ContextConfig): TokenBudget {
  const total = contextWindow || DEFAULT_CONTEXT_WINDOW
  const config = contextConfig || DEFAULT_CONTEXT_CONFIG
  const reserve = Math.ceil(total * config.outputReserveRatio)
  return {
    total,
    reserve,
    available: total - reserve
  }
}

/**
 * 根据预算分配各区块的 token 上限
 */
export function allocateSectionBudgets(budget: TokenBudget, contextConfig?: ContextConfig): Record<string, SectionBudget> {
  const available = budget.available
  const config = contextConfig || DEFAULT_CONTEXT_CONFIG

  // 计算可分配的预算比例总和
  const configurableRatio = config.chapterBudgetRatio + config.outlineBudgetRatio + config.historyBudgetRatio
  const fixedRatio = 0.10 + 0.10 + 0.05 + 0.05  // skills + reasoning + tools + other
  const totalRatio = configurableRatio + fixedRatio

  // 如果比例总和超过 1，按比例缩放
  const scale = totalRatio > 1 ? 1 / totalRatio : 1

  return {
    chapter: {
      name: '章节内容',
      maxTokens: Math.ceil(available * config.chapterBudgetRatio * scale),
      priority: 'critical'
    },
    outlines: {
      name: '大纲',
      maxTokens: Math.ceil(available * config.outlineBudgetRatio * scale),
      priority: 'high'
    },
    skills: {
      name: '写作技能',
      maxTokens: Math.ceil(available * 0.10 * scale),
      priority: 'medium'
    },
    reasoning: {
      name: '推理链',
      maxTokens: Math.ceil(available * 0.10 * scale),
      priority: 'medium'
    },
    history: {
      name: '对话历史',
      maxTokens: Math.ceil(available * config.historyBudgetRatio * scale),
      priority: 'high'
    },
    tools: {
      name: '工具说明',
      maxTokens: Math.ceil(available * 0.05 * scale),
      priority: 'low'
    },
    other: {
      name: '其他',
      maxTokens: Math.ceil(available * 0.05 * scale),
      priority: 'low'
    }
  }
}

// ─── 智能截断 ───

/**
 * 按 token 预算截断文本
 * 优先保留开头和结尾，中间用省略标记替代
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const estimated = estimateTokens(text)
  if (estimated <= maxTokens) return text

  // 按段落分割
  const paragraphs = text.split(/\n\n+/)

  if (paragraphs.length <= 2) {
    // 段落太少，用 head+tail 策略
    return headTailTruncate(text, maxTokens)
  }

  // 估算每段平均 token 数
  const totalChars = text.length
  const targetChars = Math.floor((maxTokens / estimated) * totalChars)

  // 保留前 40% + 后 30% 段落
  const headCount = Math.max(1, Math.ceil(paragraphs.length * 0.4))
  const tailCount = Math.max(1, Math.ceil(paragraphs.length * 0.3))

  const headParagraphs = paragraphs.slice(0, headCount)
  const tailParagraphs = paragraphs.slice(-tailCount)
  const omittedCount = paragraphs.length - headCount - tailCount

  const result = [
    ...headParagraphs,
    omittedCount > 0 ? `[...中间 ${omittedCount} 段已省略...]` : '',
    ...tailParagraphs
  ].filter(Boolean).join('\n\n')

  // 如果截断后仍超限，用 head+tail 兜底
  if (estimateTokens(result) > maxTokens) {
    return headTailTruncate(text, maxTokens)
  }

  return result
}

/**
 * Head+Tail 截断策略
 * 保留前 60% + 后 40% 的字符
 */
function headTailTruncate(text: string, maxTokens: number): string {
  const estimated = estimateTokens(text)
  if (estimated <= maxTokens) return text

  const ratio = maxTokens / estimated
  const targetChars = Math.floor(text.length * ratio)
  const headChars = Math.floor(targetChars * 0.6)
  const tailChars = targetChars - headChars

  return (
    text.substring(0, headChars) +
    '\n\n[...内容已截断...]\n\n' +
    text.substring(text.length - tailChars)
  )
}

// ─── 上下文窗口配置 ───

// 常见模型的默认上下文窗口大小
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'deepseek-chat': 64000,
  'deepseek-reasoner': 64000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'claude-3-5-sonnet': 200000,
  'claude-3-opus': 200000,
  'claude-3-haiku': 200000,
  'qwen-turbo': 131072,
  'qwen-plus': 131072,
  'qwen-max': 32768,
  'moonshot-v1': 128000
}

/**
 * 根据模型名推测上下文窗口大小
 */
export function guessContextWindow(model: string): number {
  const modelLower = model.toLowerCase()

  for (const [pattern, size] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (modelLower.includes(pattern.toLowerCase())) {
      return size
    }
  }

  return DEFAULT_CONTEXT_WINDOW
}
