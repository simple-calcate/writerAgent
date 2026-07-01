import type { DialogueLevel } from '../../../../shared/types'
import type { QuestionGroup } from '../dialogue'

export const LEVEL_META: Record<DialogueLevel, { label: string; icon: string }> = {
  book: { label: '书籍对话', icon: '📚' },
  volume: { label: '卷对话', icon: '📖' },
  chapter: { label: '章节对话', icon: '📝' }
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── Token Estimation ───

export function estimateTokens(text: string): number {
  if (!text) return 0
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const nonCjk = text.length - cjk
  return Math.ceil(cjk * 1.5 + nonCjk / 4 + 3)
}

export function estimateMessageTokens(msg: { content: string; toolCalls?: Array<{ result?: string }> }): number {
  let tokens = estimateTokens(msg.content) + 4
  if (msg.toolCalls) {
    for (const tc of msg.toolCalls) {
      if (tc.result) tokens += estimateTokens(tc.result) + 4
    }
  }
  return tokens
}

// ─── Quick Reply Extraction ───

const NUM_RE = /^(\d+)[\.\)、]\s+(.+)/
const LET_RE = /^([A-Za-z])[\.、]\s+(.+)/
const QUESTION_TAG_RE = /<question\s+title="([^"]*)"\s*>([\s\S]*?)<\/question>/g
const OPTION_TAG_RE = /<option>([^<]+)<\/option>/g

function stripMarkdown(line: string): string {
  return line
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .trim()
}

/**
 * 解析 AI 主动用 <question>/<option> 标签标记的提问。
 * 这是首选方式，能精确识别"需要用户做选择"的提问，避免误判。
 */
function parseQuestionTags(text: string): QuestionGroup[] {
  const groups: QuestionGroup[] = []
  QUESTION_TAG_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = QUESTION_TAG_RE.exec(text)) !== null) {
    const title = match[1].trim()
    const body = match[2]
    const options: { label: string; value: string }[] = []
    OPTION_TAG_RE.lastIndex = 0
    let optMatch: RegExpExecArray | null
    while ((optMatch = OPTION_TAG_RE.exec(body)) !== null) {
      const val = optMatch[1].trim()
      if (val) options.push({ label: val, value: val })
    }
    if (options.length >= 2) {
      groups.push({ question: title, options })
    }
  }
  return groups
}

/**
 * 把 <question>/<option> 标签转成纯文本（保留问题与选项供正文展示）。
 * 消息渲染时调用，避免用户看到原始标签。
 */
export function stripQuestionTags(text: string): string {
  if (!text || !text.includes('<question')) return text
  QUESTION_TAG_RE.lastIndex = 0
  return text.replace(QUESTION_TAG_RE, (_m, title: string, body: string) => {
    const options: string[] = []
    OPTION_TAG_RE.lastIndex = 0
    let optMatch: RegExpExecArray | null
    while ((optMatch = OPTION_TAG_RE.exec(body)) !== null) {
      options.push(`- ${optMatch[1].trim()}`)
    }
    return `**${title.trim()}**\n${options.join('\n')}`
  })
}

/**
 * 严格启发式回退：只有当段落以问号（?/？）结尾，且紧跟 2+ 个连续编号/字母列表项时，
 * 才识别为提问。纯步骤列表、枚举说明不会被误判。
 */
function extractByStrictHeuristic(text: string): QuestionGroup[] {
  const lines = text.split('\n')
  const groups: QuestionGroup[] = []

  // 按空行分段
  const segments: string[][] = []
  let current: string[] = []
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length > 0) {
        segments.push(current)
        current = []
      }
    } else {
      current.push(line.trim())
    }
  }
  if (current.length > 0) segments.push(current)

  for (const seg of segments) {
    // 找到第一个编号/字母列表项的位置
    let firstListIdx = -1
    for (let i = 0; i < seg.length; i++) {
      const clean = stripMarkdown(seg[i])
      if (NUM_RE.test(clean) || LET_RE.test(clean)) {
        firstListIdx = i
        break
      }
    }
    if (firstListIdx <= 0) continue // 没有列表，或列表在第 0 行（没有前置问题文本）

    // 检查列表前的文本是否以问号结尾
    const preceding = seg.slice(0, firstListIdx).map(stripMarkdown).join(' ')
    if (!/[?？]\s*$/.test(preceding)) continue // 不以问号结尾，不是提问

    // 收集连续的列表项
    const options: { label: string; value: string }[] = []
    for (let i = firstListIdx; i < seg.length; i++) {
      const clean = stripMarkdown(seg[i])
      const numMatch = clean.match(NUM_RE)
      const letMatch = clean.match(LET_RE)
      if (numMatch) {
        options.push({ label: `${numMatch[1]}. ${numMatch[2].trim()}`, value: numMatch[2].trim() })
      } else if (letMatch) {
        options.push({ label: `${letMatch[1].toUpperCase()}. ${letMatch[2].trim()}`, value: letMatch[2].trim() })
      } else {
        break // 列表中断
      }
    }

    if (options.length >= 2) {
      groups.push({ question: preceding, options })
    }
  }

  return groups
}

export function extractQuestionGroups(text: string): QuestionGroup[] {
  if (!text) return []

  // 1. 优先解析 <question> 标签（AI 主动标记的提问）
  const tagGroups = parseQuestionTags(text)
  if (tagGroups.length > 0) return tagGroups

  // 2. 严格启发式回退：问号 + 编号列表
  return extractByStrictHeuristic(text)
}
