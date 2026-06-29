import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  estimateMessagesTokens,
  createBudget,
  allocateSectionBudgets,
  truncateToTokenBudget,
  guessContextWindow,
  MODEL_CONTEXT_WINDOWS
} from '../token-counter'
import { DEFAULT_CONTEXT_CONFIG } from '../../../shared/types'

describe('estimateTokens', () => {
  it('空字符串返回 0', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('纯中文按 1.5 token/字 估算', () => {
    // 10 个中文字 → 10 * 1.5 = 15，非中文部分（中文替换为 1 空格）= 1 字符 / 4 = 0.25，+ 3 = 18.25 → ceil = 19
    const text = '一二三四五六七八九十'
    expect(estimateTokens(text)).toBe(19)
  })

  it('纯英文按 1 token/4 字符 估算', () => {
    // "hello world" 11 字符 → 11/4 + 3 = 5.75 → ceil = 6
    const text = 'hello world'
    expect(estimateTokens(text)).toBe(6)
  })

  it('中英混合文本分别估算后相加', () => {
    const text = '你好 world'
    // 中文 "你好" → 2 * 1.5 = 3
    // 非中文 "  world" → 7 字符 / 4 = 1.75
    // 总：3 + 1.75 + 3 = 7.75 → ceil = 8
    expect(estimateTokens(text)).toBe(8)
  })
})

describe('estimateMessagesTokens', () => {
  it('每条消息有 +4 开销', () => {
    const messages = [
      { role: 'user', content: '' },
      { role: 'assistant', content: '' }
    ]
    // 两条空消息：每条 estimateTokens('')=0 + 4 开销 = 8
    expect(estimateMessagesTokens(messages)).toBe(8)
  })

  it('累加多条消息内容 token', () => {
    const messages = [
      { role: 'user', content: '你好' },        // 2*1.5=3 + 1空格/4=0.25 +3=6.25→7, +4 = 11
      { role: 'assistant', content: '你好世界' }  // 4*1.5=6 + 1空格/4=0.25 +3=9.25→10, +4 = 14
    ]
    expect(estimateMessagesTokens(messages)).toBe(25)
  })
})

describe('createBudget', () => {
  it('使用默认上下文窗口 128000', () => {
    const budget = createBudget()
    expect(budget.total).toBe(128000)
  })

  it('reserve = total * outputReserveRatio (默认 0.25)', () => {
    const budget = createBudget(100000)
    expect(budget.reserve).toBe(25000)
    expect(budget.available).toBe(75000)
  })

  it('自定义 contextConfig 影响 reserve', () => {
    const budget = createBudget(100000, {
      ...DEFAULT_CONTEXT_CONFIG,
      outputReserveRatio: 0.4
    })
    expect(budget.reserve).toBe(40000)
    expect(budget.available).toBe(60000)
  })
})

describe('allocateSectionBudgets', () => {
  it('所有区块预算之和不超过 available', () => {
    const budget = createBudget(100000)
    const sections = allocateSectionBudgets(budget)
    const total = Object.values(sections).reduce((s, sec) => s + sec.maxTokens, 0)
    // 由于 ceil 操作可能有少量超出，允许 ±10 容差
    expect(total).toBeLessThanOrEqual(budget.available + 10)
  })

  it('chapter 优先级为 critical', () => {
    const sections = allocateSectionBudgets(createBudget(100000))
    expect(sections.chapter.priority).toBe('critical')
  })

  it('区块名包含中文名称', () => {
    const sections = allocateSectionBudgets(createBudget(100000))
    expect(sections.chapter.name).toBe('章节内容')
    expect(sections.outlines.name).toBe('大纲')
    expect(sections.history.name).toBe('对话历史')
  })
})

describe('truncateToTokenBudget', () => {
  it('短文本不截断', () => {
    const text = '这是一段短文本'
    const result = truncateToTokenBudget(text, 1000)
    expect(result).toBe(text)
  })

  it('长文本按段落截断并保留头尾', () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) => `第${i + 1}段内容`)
    const text = paragraphs.join('\n\n')
    const result = truncateToTokenBudget(text, 50)
    // 应包含省略/截断标记（段落截断或 head+tail 兜底）
    expect(result).toMatch(/已省略|已截断/)
    // 长度应小于原文
    expect(result.length).toBeLessThan(text.length)
  })

  it('单段长文本走 head+tail 策略', () => {
    const text = 'a'.repeat(2000)
    const result = truncateToTokenBudget(text, 50)
    expect(result).toContain('内容已截断')
    expect(result.length).toBeLessThan(text.length)
  })
})

describe('guessContextWindow', () => {
  it('已知模型返回对应窗口大小', () => {
    expect(guessContextWindow('gpt-4o')).toBe(MODEL_CONTEXT_WINDOWS['gpt-4o'])
    expect(guessContextWindow('deepseek-chat')).toBe(64000)
  })

  it('模型名大小写不敏感', () => {
    expect(guessContextWindow('GPT-4O')).toBe(128000)
  })

  it('未知模型返回默认 128000', () => {
    expect(guessContextWindow('unknown-model-xyz')).toBe(128000)
  })

  it('模型名包含模式片段即可匹配', () => {
    expect(guessContextWindow('gpt-4o-2024-08-06')).toBe(128000)
  })
})
