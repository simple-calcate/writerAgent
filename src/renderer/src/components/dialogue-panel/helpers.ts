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

export function extractQuestionGroups(text: string): QuestionGroup[] {
  if (!text) return []

  const lines = text.split('\n')
  const groups: QuestionGroup[] = []

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
    const options: { label: string; value: string }[] = []
    let question = ''

    for (let i = 0; i < seg.length; i++) {
      const clean = stripMarkdown(seg[i])
      const numMatch = clean.match(NUM_RE)
      const letMatch = clean.match(LET_RE)

      if (numMatch) {
        const num = parseInt(numMatch[1])
        if (options.length > 0) {
          const lastNum = parseInt(options[options.length - 1].label)
          if (num <= lastNum) {
            if (options.length >= 2) {
              groups.push({ question, options: [...options] })
            }
            options.length = 0
            question = ''
          }
        }
        if (options.length === 0 && i > 0 && question === '') {
          const preceding = seg.slice(0, i).filter(l => {
            const c = stripMarkdown(l)
            return !c.match(NUM_RE) && !c.match(LET_RE)
          })
          if (preceding.length > 0) question = preceding.map(stripMarkdown).join(' ')
        }
        options.push({ label: `${numMatch[1]}. ${numMatch[2].trim()}`, value: numMatch[2].trim() })
      } else if (letMatch) {
        const curChar = letMatch[1].toUpperCase()
        if (options.length > 0) {
          const lastChar = options[options.length - 1].label[0]
          if (/[A-Z]/.test(lastChar) && curChar <= lastChar) {
            if (options.length >= 2) {
              groups.push({ question, options: [...options] })
            }
            options.length = 0
            question = ''
          }
        }
        if (options.length === 0 && i > 0 && question === '') {
          const preceding = seg.slice(0, i).filter(l => {
            const c = stripMarkdown(l)
            return !c.match(NUM_RE) && !c.match(LET_RE)
          })
          if (preceding.length > 0) question = preceding.map(stripMarkdown).join(' ')
        }
        options.push({ label: `${curChar}. ${letMatch[2].trim()}`, value: letMatch[2].trim() })
      }
    }

    if (options.length >= 2) {
      groups.push({ question, options })
    }
  }

  return groups
}
