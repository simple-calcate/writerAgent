import { estimateTokens } from './token-counter'
import { scoreChunk, type ChunkImportance, type ScoredChunk } from './importance-scorer'

export interface Chunk {
  content: string
  startIndex: number
  endIndex: number
  tokenEstimate: number
  importance: ChunkImportance
  score: number
  type: 'paragraph' | 'dialogue' | 'narrative' | 'mixed'
}

export interface ChunkingOptions {
  maxChunkTokens?: number     // 每块最大 token 数，默认 500
  overlapTokens?: number      // 块间重叠 token 数，默认 50
  minChunkTokens?: number     // 最小块 token 数，默认 50
  preserveParagraphs?: boolean // 是否保持段落完整性，默认 true
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  maxChunkTokens: 500,
  overlapTokens: 50,
  minChunkTokens: 50,
  preserveParagraphs: true
}

/**
 * 智能分块管道
 * 将长文本按语义边界分割成块，保留上下文连贯性
 */
export function chunkText(text: string, options?: ChunkingOptions): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  if (!text || text.trim().length === 0) return []

  const tokens = estimateTokens(text)
  if (tokens <= opts.maxChunkTokens) {
    return [createChunk(text, 0, text.length)]
  }

  if (opts.preserveParagraphs) {
    return chunkByParagraphs(text, opts)
  }
  return chunkBySentence(text, opts)
}

/**
 * 按段落分块（优先保持段落完整性）
 */
function chunkByParagraphs(text: string, opts: Required<ChunkingOptions>): Chunk[] {
  const paragraphs = splitIntoParagraphs(text)
  const chunks: Chunk[] = []
  let currentParts: string[] = []
  let currentTokens = 0
  let currentStart = 0
  let currentOffset = 0

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para.text)

    if (currentTokens + paraTokens > opts.maxChunkTokens && currentParts.length > 0) {
      // 保存当前块
      const content = currentParts.join('\n\n')
      if (estimateTokens(content) >= opts.minChunkTokens) {
        chunks.push(createChunk(content, currentStart, currentStart + content.length))
      }

      // 开始新块（带重叠）
      if (opts.overlapTokens > 0 && currentParts.length > 0) {
        const overlapContent = currentParts[currentParts.length - 1]
        const overlapTok = estimateTokens(overlapContent)
        if (overlapTok <= opts.overlapTokens) {
          currentParts = [overlapContent]
          currentTokens = overlapTok
          currentStart = currentOffset - overlapContent.length
        } else {
          currentParts = []
          currentTokens = 0
          currentStart = currentOffset
        }
      } else {
        currentParts = []
        currentTokens = 0
        currentStart = currentOffset
      }
    }

    currentParts.push(para.text)
    currentTokens += paraTokens
    currentOffset += para.text.length + 2 // +2 for \n\n
  }

  // 最后一块
  if (currentParts.length > 0) {
    const content = currentParts.join('\n\n')
    if (estimateTokens(content) >= opts.minChunkTokens) {
      chunks.push(createChunk(content, currentStart, currentStart + content.length))
    }
  }

  return chunks
}

/**
 * 按句子分块（细粒度）
 */
function chunkBySentence(text: string, opts: Required<ChunkingOptions>): Chunk[] {
  const sentences = splitIntoSentences(text)
  const chunks: Chunk[] = []
  let currentParts: string[] = []
  let currentTokens = 0
  let currentStart = 0

  for (const sent of sentences) {
    const sentTokens = estimateTokens(sent.text)

    if (currentTokens + sentTokens > opts.maxChunkTokens && currentParts.length > 0) {
      const content = currentParts.join('')
      if (estimateTokens(content) >= opts.minChunkTokens) {
        chunks.push(createChunk(content, currentStart, currentStart + content.length))
      }
      currentParts = []
      currentTokens = 0
      currentStart = sent.start
    }

    currentParts.push(sent.text)
    currentTokens += sentTokens
  }

  if (currentParts.length > 0) {
    const content = currentParts.join('')
    if (estimateTokens(content) >= opts.minChunkTokens) {
      chunks.push(createChunk(content, currentStart, currentStart + content.length))
    }
  }

  return chunks
}

interface TextSegment {
  text: string
  start: number
}

function splitIntoParagraphs(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  const parts = text.split(/\n\n+/)
  let offset = 0
  for (const part of parts) {
    if (part.trim()) {
      segments.push({ text: part, start: offset })
    }
    offset += part.length + 2
  }
  return segments
}

function splitIntoSentences(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  const sentenceRegex = /[^。！？.!?\n]+[。！？.!?\n]*/g
  let match
  while ((match = sentenceRegex.exec(text)) !== null) {
    if (match[0].trim()) {
      segments.push({ text: match[0], start: match.index })
    }
  }
  return segments
}

function createChunk(content: string, startIndex: number, endIndex: number): Chunk {
  const score = scoreChunk(content)
  const importance = score >= 0.8 ? 'critical' : score >= 0.6 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  return {
    content,
    startIndex,
    endIndex,
    tokenEstimate: estimateTokens(content),
    importance,
    score,
    type: detectChunkType(content)
  }
}

function detectChunkType(text: string): Chunk['type'] {
  const dialoguePattern = /["「」""'].+?["「」""']/g
  const dialogues = text.match(dialoguePattern)
  const dialogueRatio = dialogues ? dialogues.reduce((sum, d) => sum + d.length, 0) / text.length : 0

  if (dialogueRatio > 0.4) return 'dialogue'
  if (/他|她|我|你|主角|角色/.test(text) && /走|跑|说|看|想/.test(text)) return 'narrative'
  if (text.includes('\n\n') && text.split('\n\n').length > 2) return 'paragraph'
  return 'mixed'
}

/**
 * 对 chunks 按重要性排序和过滤
 */
export function prioritizeChunks(chunks: Chunk[], maxTokens: number): Chunk[] {
  const sorted = [...chunks].sort((a, b) => b.score - a.score)
  const selected: Chunk[] = []
  let totalTokens = 0

  for (const chunk of sorted) {
    if (totalTokens + chunk.tokenEstimate > maxTokens) break
    selected.push(chunk)
    totalTokens += chunk.tokenEstimate
  }

  // 按原始顺序排列
  return selected.sort((a, b) => a.startIndex - b.startIndex)
}
