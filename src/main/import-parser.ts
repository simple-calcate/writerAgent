/**
 * 解析 .txt 文件内容，识别章节结构
 * 章节标记：第\d+章 标题
 * 分隔线 --- 是场景转换标记，保留在正文中
 */

const CHAPTER_RE = /^第\d+章\s+(.+)/

export function parseTxtContent(content: string): { title: string; content: string }[] {
  const lines = content.split(/\r?\n/)
  const chapters: { title: string; content: string }[] = []
  let currentTitle: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const match = line.match(CHAPTER_RE)
    if (match) {
      // 保存上一章
      if (currentTitle !== null) {
        chapters.push({ title: currentTitle, content: trimLeadingEmpty(currentLines) })
      }
      currentTitle = line.trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  // 最后一章
  if (currentTitle !== null) {
    chapters.push({ title: currentTitle, content: trimLeadingEmpty(currentLines) })
  }

  // 没有识别到章节，按字数自动分段
  if (chapters.length === 0 && content.trim().length > 0) {
    return autoSplit(content)
  }

  return chapters
}

function trimLeadingEmpty(lines: string[]): string {
  // 去掉开头多余空行，保留正文和分隔线
  let start = 0
  while (start < lines.length && lines[start].trim() === '') start++
  return lines.slice(start).join('\n').trim()
}

function autoSplit(content: string): { title: string; content: string }[] {
  const CHARS_PER_CHAPTER = 3000
  const result: { title: string; content: string }[] = []
  const paragraphs = content.split(/\r?\n/)
  let buffer: string[] = []
  let charCount = 0
  let index = 1

  for (const para of paragraphs) {
    buffer.push(para)
    charCount += para.length

    if (charCount >= CHARS_PER_CHAPTER) {
      result.push({ title: `第${index}节`, content: buffer.join('\n').trim() })
      buffer = []
      charCount = 0
      index++
    }
  }

  if (buffer.length > 0 && buffer.some(l => l.trim())) {
    result.push({ title: `第${index}节`, content: buffer.join('\n').trim() })
  }

  return result
}
