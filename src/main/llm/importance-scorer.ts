import type { ConversationMessage } from '../../shared/types'

export type ChunkImportance = 'critical' | 'high' | 'medium' | 'low'

export interface ScoredChunk {
  content: string
  importance: ChunkImportance
  score: number          // 0-1
  reason: string
  startIndex: number
  endIndex: number
}

interface ScoringRule {
  name: string
  weight: number
  score: (text: string, metadata?: ChunkMetadata) => number
}

interface ChunkMetadata {
  role?: string
  isToolCall?: boolean
  isRecent?: boolean
  hasDecision?: boolean
  position?: number      // 0-1, 在对话中的位置
}

const IMPORTANCE_KEYWORDS: Record<string, string[]> = {
  critical: ['决定', '选择', '转折', '关键', '重要', '必须', '核心', '主线', '结局', '开头'],
  high: ['冲突', '矛盾', '发现', '揭示', '秘密', '计划', '策略', '目标', '承诺', '约定'],
  medium: ['描述', '场景', '环境', '背景', '过渡', '准备', '思考', '回忆'],
  low: ['闲聊', '寒暄', '日常', '琐碎', '重复', '冗余']
}

const ROLE_WEIGHTS: Record<string, number> = {
  user: 0.7,
  assistant: 0.6,
  system: 0.9,
  tool: 0.3
}

const scoringRules: ScoringRule[] = [
  {
    name: 'keyword_density',
    weight: 0.3,
    score: (text) => {
      let maxScore = 0
      for (const [level, keywords] of Object.entries(IMPORTANCE_KEYWORDS)) {
        const count = keywords.reduce((sum, kw) => sum + (text.includes(kw) ? 1 : 0), 0)
        const density = count / Math.max(1, text.length / 100)
        const levelScore = level === 'critical' ? 1.0 : level === 'high' ? 0.8 : level === 'medium' ? 0.5 : 0.2
        maxScore = Math.max(maxScore, Math.min(1, density * levelScore))
      }
      return maxScore
    }
  },
  {
    name: 'length_relevance',
    weight: 0.15,
    score: (text) => {
      const len = text.length
      if (len < 10) return 0.1
      if (len < 50) return 0.3
      if (len < 200) return 0.6
      if (len < 1000) return 0.8
      return 1.0
    }
  },
  {
    name: 'role_weight',
    weight: 0.2,
    score: (_text, meta) => {
      if (!meta?.role) return 0.5
      return ROLE_WEIGHTS[meta.role] || 0.5
    }
  },
  {
    name: 'recency',
    weight: 0.25,
    score: (_text, meta) => {
      if (meta?.isRecent) return 1.0
      const pos = meta?.position ?? 0.5
      return 0.3 + pos * 0.7
    }
  },
  {
    name: 'decision_marker',
    weight: 0.1,
    score: (text, meta) => {
      if (meta?.hasDecision) return 1.0
      const decisionPatterns = [
        /决定/, /选择/, /将会/, /计划/, /打算/,
        /因此/, /所以/, /于是/, /最终/,
        /关键/, /转折/, /突破/
      ]
      const matches = decisionPatterns.filter(p => p.test(text)).length
      return Math.min(1, matches * 0.3)
    }
  }
]

/**
 * 对文本块进行重要性评分
 */
export function scoreChunk(text: string, metadata?: ChunkMetadata): number {
  if (!text || text.trim().length === 0) return 0

  let totalScore = 0
  let totalWeight = 0

  for (const rule of scoringRules) {
    const score = rule.score(text, metadata)
    totalScore += score * rule.weight
    totalWeight += rule.weight
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0
}

/**
 * 将重要性分数映射到等级
 */
export function scoreToImportance(score: number): ChunkImportance {
  if (score >= 0.8) return 'critical'
  if (score >= 0.6) return 'high'
  if (score >= 0.4) return 'medium'
  return 'low'
}

/**
 * 对对话消息数组进行评分
 */
export function scoreMessages(
  messages: Array<{ role: string; content: string }>,
  recentCount: number = 5
): ScoredChunk[] {
  const total = messages.length
  return messages.map((msg, i) => {
    const isRecent = i >= total - recentCount
    const position = i / Math.max(1, total - 1)
    const hasDecision = /决定|选择|将会|计划|转折/.test(msg.content)

    const metadata: ChunkMetadata = {
      role: msg.role,
      isRecent,
      hasDecision,
      position
    }

    const score = scoreChunk(msg.content, metadata)

    return {
      content: msg.content,
      importance: scoreToImportance(score),
      score,
      reason: buildScoreReason(msg.content, metadata, score),
      startIndex: i,
      endIndex: i
    }
  })
}

function buildScoreReason(text: string, meta: ChunkMetadata, score: number): string {
  const reasons: string[] = []
  if (meta.isRecent) reasons.push('最近消息')
  if (meta.hasDecision) reasons.push('包含决策')
  if (meta.role === 'system') reasons.push('系统消息')
  if (text.length > 500) reasons.push('内容丰富')
  if (score >= 0.8) reasons.push('高重要性')
  return reasons.join('，') || '普通内容'
}

/**
 * 按重要性过滤和排序 chunks
 */
export function filterByImportance(
  chunks: ScoredChunk[],
  minImportance: ChunkImportance = 'medium'
): ScoredChunk[] {
  const threshold: Record<ChunkImportance, number> = {
    critical: 0.8,
    high: 0.6,
    medium: 0.4,
    low: 0
  }
  const minScore = threshold[minImportance]
  return chunks.filter(c => c.score >= minScore).sort((a, b) => b.score - a.score)
}
