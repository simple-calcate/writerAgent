import { describe, it, expect } from 'vitest'
import { chunkText, prioritizeChunks, type ChunkingOptions } from '../chunking'
import { scoreChunk, scoreToImportance, scoreMessages, filterByImportance, type ChunkMetadata } from '../importance-scorer'

describe('chunkText', () => {
  it('空文本返回空数组', () => {
    expect(chunkText('')).toEqual([])
  })

  it('纯空白返回空数组', () => {
    expect(chunkText('   \n\n  ')).toEqual([])
  })

  it('短文本（≤ maxChunkTokens）返回单个 chunk', () => {
    const result = chunkText('短文本', { maxChunkTokens: 100 })
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('短文本')
  })

  it('每个 chunk 有 startIndex/endIndex/tokenEstimate', () => {
    const result = chunkText('一段内容', { maxChunkTokens: 100 })
    expect(result[0].startIndex).toBe(0)
    expect(result[0].endIndex).toBeGreaterThan(0)
    expect(result[0].tokenEstimate).toBeGreaterThan(0)
  })

  it('长文本按段落分块', () => {
    const paragraphs = Array.from({ length: 30 }, (_, i) => `这是第${i}段，内容足够长以触发分块逻辑`)
    const text = paragraphs.join('\n\n')
    const result = chunkText(text, { maxChunkTokens: 50 })
    expect(result.length).toBeGreaterThan(1)
  })

  it('preserveParagraphs: true 时不拆分段落内部', () => {
    const text = '段落一内容\n\n段落二内容\n\n段落三内容'
    const result = chunkText(text, { maxChunkTokens: 1000, preserveParagraphs: true })
    // 三个短段落应在一个 chunk 内
    expect(result).toHaveLength(1)
  })

  it('detectChunkType 识别对话密集文本为 dialogue', () => {
    const dialogue = '"你好啊"他说。"你也好"她答。"今天天气真不错"他继续说。"是啊确实很好"她微笑回应。'
    const result = chunkText(dialogue, { maxChunkTokens: 1000 })
    expect(result[0].type).toBe('dialogue')
  })

  it('chunk 的 importance 等级从 score 映射', () => {
    const result = chunkText('短文本', { maxChunkTokens: 1000 })
    const validLevels = ['critical', 'high', 'medium', 'low']
    expect(validLevels).toContain(result[0].importance)
  })
})

describe('prioritizeChunks', () => {
  it('按 maxTokens 限制筛选 chunks', () => {
    // 构造多个 chunk
    const text = Array.from({ length: 20 }, (_, i) => `第${i}段内容`).join('\n\n')
    const chunks = chunkText(text, { maxChunkTokens: 20 })
    const selected = prioritizeChunks(chunks, 30)
    // 选中的 chunks 总 token 不超过 30
    const total = selected.reduce((s, c) => s + c.tokenEstimate, 0)
    expect(total).toBeLessThanOrEqual(30)
  })

  it('选中的 chunks 按原始顺序（startIndex）排列', () => {
    const text = Array.from({ length: 10 }, (_, i) => `第${i}段内容`).join('\n\n')
    const chunks = chunkText(text, { maxChunkTokens: 30 })
    const selected = prioritizeChunks(chunks, 1000)
    for (let i = 1; i < selected.length; i++) {
      expect(selected[i].startIndex).toBeGreaterThanOrEqual(selected[i - 1].startIndex)
    }
  })

  it('maxTokens 足够大时返回所有 chunks', () => {
    const text = '短文本'
    const chunks = chunkText(text, { maxChunkTokens: 1000 })
    const selected = prioritizeChunks(chunks, 100000)
    expect(selected.length).toBe(chunks.length)
  })
})

describe('scoreChunk', () => {
  it('空文本返回 0', () => {
    expect(scoreChunk('')).toBe(0)
  })

  it('纯空白返回 0', () => {
    expect(scoreChunk('   ')).toBe(0)
  })

  it('返回 0-1 之间的分数', () => {
    const score = scoreChunk('这是一段普通文本内容')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('包含 critical 关键词（决定/选择/转折）分数较高', () => {
    const criticalText = '这是关键的转折点，主角做出了重要决定'
    const normalText = '今天天气不错，出去走走'
    expect(scoreChunk(criticalText)).toBeGreaterThan(scoreChunk(normalText))
  })

  it('metadata.role 影响分数（system > user > assistant > tool）', () => {
    const text = '同样内容'
    const systemScore = scoreChunk(text, { role: 'system' } as ChunkMetadata)
    const toolScore = scoreChunk(text, { role: 'tool' } as ChunkMetadata)
    expect(systemScore).toBeGreaterThan(toolScore)
  })

  it('metadata.isRecent 提升分数', () => {
    const text = '同样内容'
    const recentScore = scoreChunk(text, { isRecent: true } as ChunkMetadata)
    const oldScore = scoreChunk(text, { isRecent: false, position: 0 } as ChunkMetadata)
    expect(recentScore).toBeGreaterThan(oldScore)
  })

  it('长文本分数高于短文本', () => {
    const longText = 'a'.repeat(500)
    const shortText = 'ab'
    expect(scoreChunk(longText)).toBeGreaterThan(scoreChunk(shortText))
  })
})

describe('scoreToImportance', () => {
  it('score >= 0.8 → critical', () => {
    expect(scoreToImportance(0.8)).toBe('critical')
    expect(scoreToImportance(1.0)).toBe('critical')
  })

  it('score >= 0.6 → high', () => {
    expect(scoreToImportance(0.6)).toBe('high')
    expect(scoreToImportance(0.79)).toBe('high')
  })

  it('score >= 0.4 → medium', () => {
    expect(scoreToImportance(0.4)).toBe('medium')
    expect(scoreToImportance(0.59)).toBe('medium')
  })

  it('score < 0.4 → low', () => {
    expect(scoreToImportance(0.39)).toBe('low')
    expect(scoreToImportance(0)).toBe('low')
  })
})

describe('scoreMessages', () => {
  it('返回与输入等长的 ScoredChunk 数组', () => {
    const messages = [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好啊' }
    ]
    const result = scoreMessages(messages)
    expect(result).toHaveLength(2)
  })

  it('最后 recentCount 条标记为最近消息（分数更高）', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const,
      content: `消息${i}`
    }))
    const result = scoreMessages(messages, 3)
    // 最后 3 条的 score 应高于前面的（因为 isRecent 加成）
    const lastScore = result[9].score
    const firstScore = result[0].score
    expect(lastScore).toBeGreaterThanOrEqual(firstScore)
  })

  it('每个 ScoredChunk 有 reason 字符串', () => {
    const result = scoreMessages([{ role: 'user', content: '测试' }])
    expect(typeof result[0].reason).toBe('string')
    expect(result[0].reason.length).toBeGreaterThan(0)
  })
})

describe('filterByImportance', () => {
  it('默认 minImportance=medium 过滤掉 low', () => {
    const chunks = [
      { content: 'a', importance: 'critical' as const, score: 0.9, reason: '', startIndex: 0, endIndex: 1 },
      { content: 'b', importance: 'low' as const, score: 0.1, reason: '', startIndex: 0, endIndex: 1 }
    ]
    const filtered = filterByImportance(chunks)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].importance).toBe('critical')
  })

  it('按分数降序排列', () => {
    const chunks = [
      { content: 'a', importance: 'medium' as const, score: 0.5, reason: '', startIndex: 0, endIndex: 1 },
      { content: 'b', importance: 'critical' as const, score: 0.9, reason: '', startIndex: 0, endIndex: 1 }
    ]
    const filtered = filterByImportance(chunks, 'medium')
    expect(filtered[0].score).toBeGreaterThanOrEqual(filtered[1].score)
  })

  it('minImportance=critical 只保留 critical', () => {
    const chunks = [
      { content: 'a', importance: 'critical' as const, score: 0.9, reason: '', startIndex: 0, endIndex: 1 },
      { content: 'b', importance: 'high' as const, score: 0.7, reason: '', startIndex: 0, endIndex: 1 }
    ]
    const filtered = filterByImportance(chunks, 'critical')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].importance).toBe('critical')
  })
})
