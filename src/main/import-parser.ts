/**
 * 解析 .txt 文件内容，识别章节结构
 * 章节标记：第\d+章 标题
 * 分隔线 --- 是场景转换标记，保留在正文中
 *
 * 段落格式：空行分隔的文本块 → \n\n 连接（匹配 contentEditable 编辑器格式）
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
        chapters.push({ title: currentTitle, content: normalizeContent(currentLines) })
      }
      currentTitle = line.trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  // 最后一章
  if (currentTitle !== null) {
    chapters.push({ title: currentTitle, content: normalizeContent(currentLines) })
  }

  // 没有识别到章节，按字数自动分段
  if (chapters.length === 0 && content.trim().length > 0) {
    return autoSplit(content)
  }

  return chapters
}

/**
 * 将原始行数组转换为标准化内容格式：
 * - 空行分隔的文本块作为段落，用 \n\n 连接
 * - 去掉段落内部的多余空行
 * - 保留分隔线 ---
 */
function normalizeContent(lines: string[]): string {
  const paragraphs: string[] = []
  let currentPara: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // 分隔线作为独立段落
    if (/^-{3,}$/.test(trimmed)) {
      if (currentPara.length > 0) {
        paragraphs.push(currentPara.join('\n'))
        currentPara = []
      }
      paragraphs.push(trimmed)
      continue
    }

    if (trimmed === '') {
      // 空行 = 段落分隔
      if (currentPara.length > 0) {
        paragraphs.push(currentPara.join('\n'))
        currentPara = []
      }
    } else {
      currentPara.push(trimmed)
    }
  }

  // 最后一段
  if (currentPara.length > 0) {
    paragraphs.push(currentPara.join('\n'))
  }

  return paragraphs.join('\n\n')
}

function autoSplit(content: string): { title: string; content: string }[] {
  const CHARS_PER_CHAPTER = 3000
  const result: { title: string; content: string }[] = []

  // 先标准化整个内容
  const normalized = normalizeContent(content.split(/\r?\n/))
  const paragraphs = normalized.split(/\n\n+/)
  let buffer: string[] = []
  let charCount = 0
  let index = 1

  for (const para of paragraphs) {
    buffer.push(para)
    charCount += para.replace(/\s/g, '').length

    if (charCount >= CHARS_PER_CHAPTER) {
      result.push({ title: `第${index}节`, content: buffer.join('\n\n') })
      buffer = []
      charCount = 0
      index++
    }
  }

  if (buffer.length > 0 && buffer.some(p => p.trim())) {
    result.push({ title: `第${index}节`, content: buffer.join('\n\n') })
  }

  return result
}
