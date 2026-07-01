/**
 * 内容搜索工具
 *
 * 支持三种范围搜索：
 * - 章节级：单章节内搜索
 * - 卷级：指定卷（或当前卷）所有章节搜索
 * - 全书级：当前项目所有章节搜索，结果按卷 → 章节 → 匹配位置分层
 *
 * 支持多关键词 + 两种匹配模式：
 * - OR 并集：行包含任一关键词即匹配（适合搜角色别名/相关词组）
 * - AND 交集：行必须同时包含所有关键词（适合查共现关系）
 *
 * 核心纯函数，便于单元测试；handler 负责取数据 + 格式化输出。
 */

import type { Chapter, Volume } from '../../../shared/types'

// ─── 基础类型 ───

/** 单个合并后的上下文区间 */
export interface SearchRange {
  /** 起始行号（0-based，含） */
  start: number
  /** 结束行号（0-based，含） */
  end: number
  /** 该区间内所有匹配行（0-based）及其命中的关键词列表 */
  matchLines: MatchLine[]
}

/** 一条匹配行 + 命中的关键词列表 */
export interface MatchLine {
  /** 行号（0-based） */
  line: number
  /** 该行命中的原始关键词（保留大小写原样，用于输出） */
  matchedKeywords: string[]
}

/** 单章节搜索结果 */
export interface SearchResult {
  /** 总匹配行数（不受 maxMatches 限制） */
  totalMatches: number
  /** 合并后的上下文区间（已截断到 maxMatches） */
  ranges: SearchRange[]
  /** 是否因 maxMatches 截断 */
  truncated: boolean
}

/** 匹配模式 */
export type MatchMode = 'or' | 'and'

/** 搜索选项 */
export interface SearchOptions {
  /** 每个匹配位置返回的上下文行数（默认 5，范围 0-20） */
  contextLines?: number
  /** 每章最大返回区间数（默认 5，范围 1-20） */
  maxMatches?: number
  /** 多关键词匹配模式，默认 'or' */
  matchMode?: MatchMode
}

/** 多章节搜索时每章的最大返回区间数（默认 3，避免全书结果过长） */
const DEFAULT_MAX_MATCHES_PER_CHAPTER = 3

// ─── 常量 ───

const DEFAULT_CONTEXT_LINES = 5
const DEFAULT_MAX_MATCHES = 5
const MAX_CONTEXT_LINES = 20
const MAX_MAX_MATCHES = 20

// ─── 核心纯函数 ───

/**
 * 在单章节文本中搜索关键词，返回带上下文的匹配区间
 *
 * - 大小写不敏感
 * - 支持多关键词，matchMode='or' 时任一命中即匹配，'and' 时全部命中才匹配
 * - 相邻/重叠的上下文区间自动合并，避免重复输出
 * - matchLines 记录每个区间内的真实匹配行 + 命中的关键词，用于高亮标记
 *
 * 向后兼容：query 接受 string 或 string[]，单关键词等价于数组 [keyword]
 */
export function searchInChapter(
  content: string,
  query: string | string[],
  options: SearchOptions = {}
): SearchResult {
  // 规范化关键词数组：去重、去空、去空白
  const keywords = normalizeQueries(query)

  if (!content || keywords.length === 0) {
    return { totalMatches: 0, ranges: [], truncated: false }
  }

  const contextLines = resolveOption(options.contextLines, DEFAULT_CONTEXT_LINES, 0, MAX_CONTEXT_LINES)
  const maxMatches = resolveOption(options.maxMatches, DEFAULT_MAX_MATCHES, 1, MAX_MAX_MATCHES)
  const matchMode: MatchMode = options.matchMode === 'and' ? 'and' : 'or'

  const lines = content.split('\n')

  // 1. 找到所有匹配行（0-based）+ 记录命中关键词
  const allMatchLines: MatchLine[] = []
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase()
    const matched = matchLine(lowerLine, keywords, matchMode)
    if (matched.length > 0) {
      allMatchLines.push({ line: i, matchedKeywords: matched })
    }
  }

  if (allMatchLines.length === 0) {
    return { totalMatches: 0, ranges: [], truncated: false }
  }

  // 2. 合并重叠/相邻的上下文区间
  const ranges: SearchRange[] = []
  for (const matchLine of allMatchLines) {
    const start = Math.max(0, matchLine.line - contextLines)
    const end = Math.min(lines.length - 1, matchLine.line + contextLines)

    const last = ranges[ranges.length - 1]
    if (last && start <= last.end + 1) {
      last.end = Math.max(last.end, end)
      last.matchLines.push(matchLine)
    } else {
      ranges.push({ start, end, matchLines: [matchLine] })
    }

    if (ranges.length >= maxMatches) break
  }

  const shownMatches = ranges.reduce((sum, r) => sum + r.matchLines.length, 0)
  return {
    totalMatches: allMatchLines.length,
    ranges,
    truncated: allMatchLines.length > shownMatches
  }
}

/**
 * 判断一行文本是否匹配，返回命中的关键词列表
 *
 * - OR：任一关键词命中即返回命中的关键词
 * - AND：所有关键词都命中才返回命中的关键词；否则返回空数组
 *
 * @param lowerLine 已小写化的行文本
 * @param keywords 关键词数组（保留原大小写，仅用于返回）
 * @param matchMode 匹配模式
 * @returns 命中的关键词列表（原大小写）；未命中返回空数组
 */
function matchLine(
  lowerLine: string,
  keywords: string[],
  matchMode: MatchMode
): string[] {
  const matched: string[] = []
  for (const kw of keywords) {
    if (lowerLine.includes(kw.toLowerCase())) {
      matched.push(kw)
    }
  }
  if (matchMode === 'and') {
    return matched.length === keywords.length ? matched : []
  }
  // or
  return matched
}

/**
 * 规范化关键词：
 * - 接受 string 或 string[]
 * - 拆分多关键词（按需保留原样，不拆分；调用方传什么就是什么）
 * - 过滤空串和纯空白
 * - 去重（保留首次出现的顺序）
 */
function normalizeQueries(query: string | string[]): string[] {
  const arr = Array.isArray(query) ? query : [query]
  const seen = new Set<string>()
  const result: string[] = []
  for (const kw of arr) {
    const trimmed = typeof kw === 'string' ? kw.trim() : ''
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

/** 卷级搜索结果中的单章节条目 */
export interface ChapterSearchEntry {
  chapterId: string
  chapterTitle: string
  orderIndex: number
  result: SearchResult
}

/** 卷级搜索结果 */
export interface VolumeSearchResult {
  /** 卷 ID，null 表示未分卷 */
  volumeId: string | null
  /** 卷名称，null 表示未分卷 */
  volumeName: string | null
  /** 卷排序索引，未分卷用 Number.MAX_SAFE_INTEGER 排末尾 */
  volumeOrderIndex: number
  /** 命中的章节（已过滤掉无匹配的章节，按 orderIndex 升序） */
  chapters: ChapterSearchEntry[]
  /** 该卷总匹配数 */
  totalMatches: number
}

/** 全书搜索结果 */
export interface BookSearchResult {
  /** 按卷分组的命中结果（按 volumeOrderIndex 升序，未分卷排末尾） */
  volumes: VolumeSearchResult[]
  /** 全书总匹配数 */
  totalMatches: number
  /** 命中章节数 */
  totalChapters: number
}

/**
 * 在多章节中搜索，返回每章命中条目（已过滤无匹配的章节）
 *
 * 用于卷级和书级搜索的公共逻辑。
 */
export function searchInChapters(
  chapters: Chapter[],
  query: string | string[],
  options: SearchOptions = {}
): ChapterSearchEntry[] {
  const keywords = normalizeQueries(query)
  if (keywords.length === 0) return []

  const entries: ChapterSearchEntry[] = []
  for (const ch of chapters) {
    if (!ch.content) continue
    const result = searchInChapter(ch.content, keywords, options)
    if (result.totalMatches > 0) {
      entries.push({
        chapterId: ch.id,
        chapterTitle: ch.title,
        orderIndex: ch.orderIndex,
        result
      })
    }
  }
  entries.sort((a, b) => a.orderIndex - b.orderIndex)
  return entries
}

/**
 * 在全书搜索，结果按卷分组
 *
 * - 卷按 orderIndex 升序，未分卷（volumeId=null）排末尾
 * - 每卷内章节按 orderIndex 升序
 * - 无匹配的章节和卷被过滤掉
 */
export function searchInBook(
  chapters: Chapter[],
  volumes: Volume[],
  query: string | string[],
  options: SearchOptions = {}
): BookSearchResult {
  const keywords = normalizeQueries(query)
  if (keywords.length === 0) {
    return { volumes: [], totalMatches: 0, totalChapters: 0 }
  }

  // 多章节搜索时，若用户没显式指定 maxMatches，用更小的默认值避免全书结果过长
  const effectiveOptions: SearchOptions = {
    ...options,
    maxMatches: options.maxMatches ?? DEFAULT_MAX_MATCHES_PER_CHAPTER
  }

  const entries = searchInChapters(chapters, keywords, effectiveOptions)
  if (entries.length === 0) {
    return { volumes: [], totalMatches: 0, totalChapters: 0 }
  }

  // 按 volumeId 分组
  const groupByVolume = new Map<string | null, ChapterSearchEntry[]>()
  for (const entry of entries) {
    const key = entry.chapterId ? findVolumeId(chapters, entry.chapterId) : null
    const arr = groupByVolume.get(key) ?? []
    arr.push(entry)
    groupByVolume.set(key, arr)
  }

  // 构造 VolumeSearchResult
  const volumeResults: VolumeSearchResult[] = []
  for (const [volId, chapterEntries] of groupByVolume) {
    let volumeName: string | null = null
    let volumeOrderIndex = Number.MAX_SAFE_INTEGER
    if (volId) {
      const vol = volumes.find(v => v.id === volId)
      if (vol) {
        volumeName = vol.name
        volumeOrderIndex = vol.orderIndex
      }
    }
    const totalMatches = chapterEntries.reduce((sum, e) => sum + e.result.totalMatches, 0)
    volumeResults.push({
      volumeId: volId,
      volumeName,
      volumeOrderIndex,
      chapters: chapterEntries,
      totalMatches
    })
  }

  volumeResults.sort((a, b) => a.volumeOrderIndex - b.volumeOrderIndex)

  const totalMatches = volumeResults.reduce((sum, v) => sum + v.totalMatches, 0)
  const totalChapters = volumeResults.reduce((sum, v) => sum + v.chapters.length, 0)

  return { volumes: volumeResults, totalMatches, totalChapters }
}

/** 根据 chapterId 查章节所属的 volumeId */
function findVolumeId(chapters: Chapter[], chapterId: string): string | null {
  const ch = chapters.find(c => c.id === chapterId)
  return ch?.volumeId ?? null
}

// ─── 工具函数 ───

/** 将 value 限制在 [min, max] 范围内 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 解析可选数值参数：
 * - null/undefined/NaN → 用 defaultValue
 * - 其他 → clamp 到 [min, max]
 */
function resolveOption(
  value: number | undefined,
  defaultValue: number,
  min: number,
  max: number
): number {
  if (value == null || Number.isNaN(value)) return defaultValue
  return clamp(value, min, max)
}

// ─── 格式化函数 ───

/** 将关键词数组格式化为展示用字符串，如 `「林婉儿」「林姑娘」` */
function formatKeywordsLabel(keywords: string[]): string {
  return keywords.map(kw => `「${kw}」`).join(' / ')
}

/** 将匹配行命中的关键词列表格式化为后缀，如 `（命中：林婉儿, 林姑娘）` */
function formatMatchedKeywordsLabel(matchedKeywords: string[]): string {
  if (matchedKeywords.length === 0) return ''
  return `（命中：${matchedKeywords.join(', ')}）`
}

/**
 * 将单章节搜索结果格式化为人类可读的字符串
 */
export function formatChapterResult(
  title: string,
  query: string | string[],
  content: string,
  result: SearchResult,
  matchMode: MatchMode = 'or'
): string {
  const keywords = normalizeQueries(query)
  const label = formatKeywordsLabel(keywords)
  const modeLabel = keywords.length > 1 ? ` [${matchMode.toUpperCase()}]` : ''

  if (result.totalMatches === 0) {
    return `在章节「${title}」中未找到${label}${modeLabel}`
  }

  const lines = content.split('\n')
  const parts: string[] = []

  const shownCount = result.ranges.reduce((sum, r) => sum + r.matchLines.length, 0)
  const suffix = result.truncated ? `（显示前 ${shownCount} 处）` : ''
  parts.push(`在章节「${title}」中找到 ${result.totalMatches} 处匹配${label}${modeLabel}${suffix}：`)

  for (const range of result.ranges) {
    parts.push(formatRange(range, lines))
  }

  return parts.join('\n')
}

/**
 * 将卷级搜索结果格式化为字符串
 *
 * 层级：卷 > 章节 > 匹配位置
 */
export function formatVolumeResult(
  volumeName: string | null,
  query: string | string[],
  chapters: ChapterSearchEntry[],
  contentsById: Map<string, string>,
  matchMode: MatchMode = 'or'
): string {
  const keywords = normalizeQueries(query)
  const label = formatKeywordsLabel(keywords)
  const modeLabel = keywords.length > 1 ? ` [${matchMode.toUpperCase()}]` : ''
  const totalMatches = chapters.reduce((sum, e) => sum + e.result.totalMatches, 0)
  const volumeLabel = volumeName ?? '未分卷'

  const parts: string[] = []
  parts.push(`在卷「${volumeLabel}」中搜索${label}${modeLabel}，共在 ${chapters.length} 个章节中找到 ${totalMatches} 处匹配：`)

  for (const entry of chapters) {
    const content = contentsById.get(entry.chapterId) ?? ''
    parts.push('')
    parts.push(`## 章节「${entry.chapterTitle}」（${entry.result.totalMatches} 处匹配）`)
    for (const range of entry.result.ranges) {
      parts.push(formatRange(range, content.split('\n')))
    }
  }

  return parts.join('\n')
}

/**
 * 将全书搜索结果格式化为字符串
 *
 * 层级：卷 > 章节 > 匹配位置
 * 未分卷的章节归入"未分卷"分组，排在最后。
 */
export function formatBookResult(
  query: string | string[],
  bookResult: BookSearchResult,
  contentsById: Map<string, string>,
  matchMode: MatchMode = 'or'
): string {
  const keywords = normalizeQueries(query)
  const label = formatKeywordsLabel(keywords)
  const modeLabel = keywords.length > 1 ? ` [${matchMode.toUpperCase()}]` : ''

  if (bookResult.totalMatches === 0) {
    return `全书未找到${label}${modeLabel}`
  }

  const parts: string[] = []
  parts.push(`在全书搜索${label}${modeLabel}，共在 ${bookResult.volumes.length} 个卷、${bookResult.totalChapters} 个章节中找到 ${bookResult.totalMatches} 处匹配：`)

  for (const vol of bookResult.volumes) {
    const volumeLabel = vol.volumeName ?? '未分卷'
    parts.push('')
    parts.push(`# 卷「${volumeLabel}」（${vol.chapters.length} 个章节，${vol.totalMatches} 处匹配）`)

    for (const entry of vol.chapters) {
      const content = contentsById.get(entry.chapterId) ?? ''
      parts.push('')
      parts.push(`## 章节「${entry.chapterTitle}」（${entry.result.totalMatches} 处匹配）`)
      for (const range of entry.result.ranges) {
        parts.push(formatRange(range, content.split('\n')))
      }
    }
  }

  return parts.join('\n')
}

/** 格式化单个上下文区间 */
function formatRange(range: SearchRange, lines: string[]): string {
  const lineLabel = range.start === range.end
    ? `第 ${range.start + 1} 行`
    : `第 ${range.start + 1}-${range.end + 1} 行`

  // 汇总该区间所有匹配行号
  const matchLineNums = range.matchLines.map(m => m.line + 1).join(', ')

  // 每个匹配行单独标记命中的关键词
  const matchSet = new Map<number, string[]>()
  for (const m of range.matchLines) {
    matchSet.set(m.line, m.matchedKeywords)
  }

  const snippet = lines
    .slice(range.start, range.end + 1)
    .map((line, idx) => {
      const lineNum = range.start + idx
      const isMatch = matchSet.has(lineNum)
      const prefix = isMatch ? '▶' : ' '
      const kwLabel = formatMatchedKeywordsLabel(matchSet.get(lineNum) ?? [])
      return `${prefix} ${lineNum + 1}| ${line}${kwLabel}`
    })
    .join('\n')

  return `【${lineLabel}，匹配于第 ${matchLineNums} 行】\n${snippet}`
}
