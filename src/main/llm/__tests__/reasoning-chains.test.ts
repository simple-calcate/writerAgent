import { describe, it, expect, vi } from 'vitest'

// mock db 模块，避免触发 electron/文件系统副作用
vi.mock('../../store/db', () => ({
  getReasoningChains: () => []
}))

import {
  BUILTIN_REASONING_CHAINS,
  extractUserMessage,
  buildStepPrompt,
  detectAutoTrigger,
  findReasoningChain
} from '../reasoning-chains'

describe('BUILTIN_REASONING_CHAINS', () => {
  it('包含 chapter-writing 和 outline-planning 两条内置链', () => {
    const ids = BUILTIN_REASONING_CHAINS.map(c => c.id)
    expect(ids).toContain('chapter-writing')
    expect(ids).toContain('outline-planning')
  })

  it('每条链至少有 1 个步骤', () => {
    for (const chain of BUILTIN_REASONING_CHAINS) {
      expect(chain.steps.length).toBeGreaterThan(0)
    }
  })

  it('每个步骤有 id/name/prompt/outputKey', () => {
    for (const chain of BUILTIN_REASONING_CHAINS) {
      for (const step of chain.steps) {
        expect(step.id).toBeTruthy()
        expect(step.name).toBeTruthy()
        expect(step.prompt).toBeTruthy()
        expect(step.outputKey).toBeTruthy()
      }
    }
  })
})

describe('extractUserMessage', () => {
  it('无触发标记时原样返回', () => {
    expect(extractUserMessage('帮我写一段')).toBe('帮我写一段')
  })

  it('去除单个 [reasoning:xxx] 标记', () => {
    expect(extractUserMessage('[reasoning:chapter-writing] 帮我写一段')).toBe('帮我写一段')
  })

  it('去除多个连续触发标记', () => {
    expect(extractUserMessage('[reasoning:a] [reasoning:b] 实际内容')).toBe('实际内容')
  })

  it('去除标记后 trim 两端空白', () => {
    expect(extractUserMessage('[reasoning:x]   带空白的内容   ')).toBe('带空白的内容')
  })

  it('空字符串返回空字符串', () => {
    expect(extractUserMessage('')).toBe('')
  })

  it('只有标记无内容返回空字符串', () => {
    expect(extractUserMessage('[reasoning:x]')).toBe('')
  })
})

describe('buildStepPrompt', () => {
  it('包含任务名称', () => {
    const prompt = buildStepPrompt({ name: '人物分析', prompt: '分析人物' }, {}, '上下文')
    expect(prompt).toContain('人物分析')
  })

  it('包含任务说明', () => {
    const prompt = buildStepPrompt({ name: 'test', prompt: '这是任务说明' }, {}, '上下文')
    expect(prompt).toContain('这是任务说明')
  })

  it('包含当前上下文', () => {
    const prompt = buildStepPrompt({ name: 'test', prompt: 'p' }, {}, '这是上下文内容')
    expect(prompt).toContain('这是上下文内容')
  })

  it('有前序结果时包含前序分析结果', () => {
    const prompt = buildStepPrompt(
      { name: 'test', prompt: 'p' },
      { psychology: '心理分析结果' },
      '上下文'
    )
    expect(prompt).toContain('前序分析结果')
    expect(prompt).toContain('心理分析结果')
  })

  it('无前序结果时不包含"前序分析结果"标题', () => {
    const prompt = buildStepPrompt({ name: 'test', prompt: 'p' }, {}, '上下文')
    expect(prompt).not.toContain('前序分析结果')
  })
})

describe('detectAutoTrigger', () => {
  it('无标记返回 null', () => {
    expect(detectAutoTrigger('普通消息')).toBeNull()
  })

  it('[reasoning:chapter-writing] 标记触发对应内置链', () => {
    const result = detectAutoTrigger('[reasoning:chapter-writing] 写一章')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('chapter-writing')
  })

  it('未知 chain id 返回 null', () => {
    expect(detectAutoTrigger('[reasoning:nonexistent] 内容')).toBeNull()
  })

  it('标记不在行首时不触发', () => {
    // detectAutoTrigger 用 ^[reasoning: 锚定行首
    expect(detectAutoTrigger('文字 [reasoning:chapter-writing] 内容')).toBeNull()
  })
})

describe('findReasoningChain', () => {
  it('按 ID 精确查找内置链', () => {
    const chain = findReasoningChain('chapter-writing')
    expect(chain).toBeDefined()
    expect(chain?.id).toBe('chapter-writing')
  })

  it('按名称精确查找内置链', () => {
    const chain = findReasoningChain('章节创作推理')
    expect(chain).toBeDefined()
    expect(chain?.id).toBe('chapter-writing')
  })

  it('按名称模糊查找（包含即可）', () => {
    const chain = findReasoningChain('大纲')
    expect(chain).toBeDefined()
    expect(chain?.id).toBe('outline-planning')
  })

  it('找不到时返回 undefined', () => {
    expect(findReasoningChain('不存在的名称xyz')).toBeUndefined()
  })
})
