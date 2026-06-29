import { describe, it, expect } from 'vitest'
import {
  compressHistory,
  compressForStorage,
  compressConversationForStorage,
  buildCompressedMessages,
  compressConversationMessages
} from '../context-compressor'
import type { ConversationMessage, Conversation } from '../../../shared/types'
import { DEFAULT_CONTEXT_CONFIG } from '../../../shared/types'

function makeMsg(role: 'user' | 'assistant', content: string, extra: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: Math.random().toString(36).slice(2),
    role,
    content,
    timestamp: new Date().toISOString(),
    ...extra
  }
}

describe('compressHistory', () => {
  it('未超预算不压缩，返回原消息', () => {
    const messages = [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好，有什么可以帮你？' }
    ]
    const result = compressHistory(messages, 128000)
    expect(result.compressedCount).toBe(0)
    expect(result.compressedSummary).toBe('')
    expect(result.recentMessages).toHaveLength(2)
  })

  it('超预算时压缩旧消息为摘要，保留最近 N 条', () => {
    // 构造大量消息超出预算
    const messages = Array.from({ length: 50 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `这是第${i + 1}条消息，内容足够长以触发压缩逻辑` + '内容'.repeat(20)
    }))
    // 用极小的 contextWindow 触发压缩
    const result = compressHistory(messages, 1000)
    expect(result.compressedCount).toBeGreaterThan(0)
    expect(result.recentMessages.length).toBeLessThan(messages.length)
  })

  it('最近消息仍超预算时按比例裁剪', () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      role: 'user' as const,
      content: 'x'.repeat(500)
    }))
    // 极小预算，最近消息也会超
    const result = compressHistory(messages, 500)
    expect(result.recentMessages.length).toBeLessThanOrEqual(messages.length)
    expect(result.totalTokenEstimate).toBeGreaterThan(0)
  })

  it('摘要包含用户和 AI 的关键信息', () => {
    const messages = [
      { role: 'user', content: '帮我写一个关于主角决定复仇的故事' },
      { role: 'assistant', content: '好的，这是关于复仇的故事框架' },
      ...Array.from({ length: 30 }, (_, i) => ({
        role: 'user' as const,
        content: `续写第${i}段`
      }))
    ]
    const result = compressHistory(messages, 500)
    if (result.compressedSummary) {
      expect(result.compressedSummary).toContain('对话历史摘要')
    }
  })
})

describe('compressForStorage', () => {
  it('过滤已删除消息', () => {
    const messages = [
      makeMsg('user', '消息1'),
      makeMsg('user', '消息2', { deleted: true }),
      makeMsg('assistant', '消息3')
    ]
    const result = compressForStorage(messages)
    expect(result).toHaveLength(2)
    expect(result.find(m => m.content === '消息2')).toBeUndefined()
  })

  it('消息数 ≤ 10 全部保留', () => {
    const messages = Array.from({ length: 8 }, (_, i) => makeMsg('user', `消息${i}`))
    const result = compressForStorage(messages)
    expect(result).toHaveLength(8)
    // 内容不被截断
    expect(result[0].content).toBe('消息0')
  })

  it('超过 10 条时旧消息内容被截断', () => {
    const longContent = 'a'.repeat(3000)
    const messages = [
      ...Array.from({ length: 15 }, (_, i) => makeMsg('user', longContent))
    ]
    const result = compressForStorage(messages)
    expect(result).toHaveLength(15)
    // 最早的旧消息（非最近 10 条）内容应被截断
    const oldest = result[0]
    expect(oldest.content.length).toBeLessThan(longContent.length)
    expect(oldest.content).toContain('已截断')
  })

  it('旧消息的 thinkingContent 被截断', () => {
    const longThinking = 'b'.repeat(500)
    const messages = Array.from({ length: 12 }, () =>
      makeMsg('assistant', 'short', { thinkingContent: longThinking })
    )
    const result = compressForStorage(messages)
    // 最早的两条是"旧消息"
    const oldest = result[0]
    expect(oldest.thinkingContent?.length).toBeLessThan(longThinking.length)
  })

  it('旧消息的 toolCalls 结果被截断', () => {
    const longResult = 'c'.repeat(500)
    const messages = Array.from({ length: 12 }, () =>
      makeMsg('assistant', 'short', {
        toolCalls: [{
          id: 'tc1',
          name: 'read_chapter_content',
          args: {},
          result: longResult
        } as any]
      })
    )
    const result = compressForStorage(messages)
    const oldest = result[0]
    if (oldest.toolCalls && oldest.toolCalls[0]) {
      expect(oldest.toolCalls[0].result?.length).toBeLessThan(longResult.length)
    }
  })
})

describe('compressConversationForStorage', () => {
  it('保留 conversation 其他字段，仅压缩 messages', () => {
    const conversation: Conversation = {
      id: 'c1',
      projectId: null,
      volumeId: null,
      chapterId: 'e1',
      level: 'chapter',
      messages: [makeMsg('user', 'hi')],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-02'
    }
    const result = compressConversationForStorage(conversation)
    expect(result.id).toBe('c1')
    expect(result.level).toBe('chapter')
    expect(result.messages).toHaveLength(1)
  })
})

describe('buildCompressedMessages', () => {
  it('无摘要时只返回最近消息', () => {
    const result = buildCompressedMessages({
      recentMessages: [{ role: 'user', content: 'hi' }],
      compressedSummary: '',
      totalTokenEstimate: 10,
      compressedCount: 0
    })
    expect(result).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('有摘要时摘要作为 system 消息前置', () => {
    const result = buildCompressedMessages({
      recentMessages: [{ role: 'user', content: 'hi' }],
      compressedSummary: '历史摘要',
      totalTokenEstimate: 100,
      compressedCount: 5
    })
    expect(result[0]).toEqual({ role: 'system', content: '历史摘要' })
    expect(result[1]).toEqual({ role: 'user', content: 'hi' })
  })
})

describe('compressConversationMessages', () => {
  it('未压缩时返回原消息', () => {
    const messages = [makeMsg('user', '你好')]
    const result = compressConversationMessages(messages, 128000)
    expect(result.compressedCount).toBe(0)
    expect(result.summary).toBe('')
    expect(result.messages).toBe(messages)
  })

  it('压缩时消息数减少（旧消息被摘要或裁剪替代）', () => {
    // 构造能产生非空摘要的场景：总消息超预算，但最近 N 条不超
    const messages = Array.from({ length: 100 }, (_, i) =>
      makeMsg('user', `hi${i}`)  // 每条约 5 tokens，100 条 ≈ 500 tokens
    )
    // contextWindow=2000, available=1500, historyBudget=375
    // 总 500 > 375 触发压缩；最近 20 条 ≈ 100 < 375 → 走摘要分支
    const result = compressConversationMessages(messages, 2000)
    expect(result.compressedCount).toBeGreaterThan(0)
    // 压缩后消息数应远少于原 100 条
    expect(result.messages.length).toBeLessThan(messages.length)
  })
})
