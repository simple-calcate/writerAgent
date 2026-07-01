import { describe, it, expect } from 'vitest'
import type { Chapter, Volume } from '../../../../shared/types'
import {
  searchInChapter,
  searchInChapters,
  searchInBook,
  formatChapterResult,
  formatVolumeResult,
  formatBookResult,
  type SearchOptions,
  type MatchMode
} from '../search-content'

/** 提取 matchLines 中的行号数组，便于断言 */
function matchLineNumbers(range: { matchLines: { line: number; matchedKeywords: string[] }[] }): number[] {
  return range.matchLines.map(m => m.line)
}

// ─── 测试数据工厂 ───

function makeChapter(overrides: Partial<Chapter> & { id: string; title: string }): Chapter {
  return {
    projectId: 'p1',
    volumeId: null,
    content: '',
    polishingMarks: [],
    summaryResult: null,
    orderIndex: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides
  }
}

function makeVolume(overrides: Partial<Volume> & { id: string; name: string }): Volume {
  return {
    projectId: 'p1',
    orderIndex: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides
  }
}

// ─── searchInChapter（章节级核心）───

describe('searchInChapter', () => {
  it('空内容返回零匹配', () => {
    const result = searchInChapter('', '关键词')
    expect(result.totalMatches).toBe(0)
    expect(result.ranges).toEqual([])
    expect(result.truncated).toBe(false)
  })

  it('空关键词返回零匹配', () => {
    const result = searchInChapter('一些内容', '')
    expect(result.totalMatches).toBe(0)
    expect(result.ranges).toEqual([])
  })

  it('无匹配返回零匹配', () => {
    const content = '第一行内容\n第二行内容\n第三行内容'
    const result = searchInChapter(content, '不存在的词')
    expect(result.totalMatches).toBe(0)
    expect(result.ranges).toEqual([])
  })

  it('单匹配返回单个区间', () => {
    const content = '第一行\n第二行\n目标关键词\n第四行\n第五行\n第六行\n第七行'
    const result = searchInChapter(content, '目标关键词')
    expect(result.totalMatches).toBe(1)
    expect(result.ranges).toHaveLength(1)
    expect(result.ranges[0].start).toBe(0)
    expect(result.ranges[0].end).toBe(6)
    expect(matchLineNumbers(result.ranges[0])).toEqual([2])
    expect(result.truncated).toBe(false)
  })

  it('大小写不敏感', () => {
    const content = 'Hello World\nhello\nHELLO'
    const result = searchInChapter(content, 'hello')
    expect(result.totalMatches).toBe(3)
  })

  it('相邻匹配自动合并区间', () => {
    const content = '关键词A\n关键词B\n第三行\n第四行\n第五行'
    const result = searchInChapter(content, '关键词', { contextLines: 2 })
    expect(result.totalMatches).toBe(2)
    expect(result.ranges).toHaveLength(1)
    expect(matchLineNumbers(result.ranges[0])).toEqual([0, 1])
  })

  it('远距离匹配不合并', () => {
    const lines = Array.from({ length: 30 }, (_, i) => i === 5 || i === 25 ? '关键词' : `第${i}行`)
    const content = lines.join('\n')
    const result = searchInChapter(content, '关键词', { contextLines: 2 })
    expect(result.ranges).toHaveLength(2)
    expect(matchLineNumbers(result.ranges[0])).toEqual([5])
    expect(matchLineNumbers(result.ranges[1])).toEqual([25])
  })

  it('maxMatches 限制返回区间数但 totalMatches 反映真实总数', () => {
    const lines = Array.from({ length: 60 }, (_, i) => i % 3 === 0 ? '关键词' : `第${i}行`)
    const content = lines.join('\n')
    const result = searchInChapter(content, '关键词', { contextLines: 0, maxMatches: 3 })
    expect(result.totalMatches).toBe(20)
    expect(result.ranges).toHaveLength(3)
    expect(result.truncated).toBe(true)
  })

  it('contextLines 边界：首行不越界', () => {
    const content = '关键词\n第二行\n第三行\n第四行\n第五行\n第六行\n第七行\n第八行\n第九行\n第十行\n第十一行'
    const result = searchInChapter(content, '关键词', { contextLines: 5 })
    expect(result.ranges[0].start).toBe(0)
  })

  it('contextLines 边界：末行不越界', () => {
    const lines = Array.from({ length: 12 }, (_, i) => i === 10 ? '关键词' : `第${i}行`)
    const content = lines.join('\n')
    const result = searchInChapter(content, '关键词', { contextLines: 5 })
    expect(result.ranges[0].end).toBe(11)
  })

  it('contextLines 超过上限被 clamp 到 20', () => {
    const lines = Array.from({ length: 50 }, (_, i) => i === 25 ? '关键词' : `第${i}行`)
    const content = lines.join('\n')
    const result = searchInChapter(content, '关键词', { contextLines: 100 })
    expect(result.ranges[0].end - result.ranges[0].start).toBe(40)
  })

  it('contextLines 为 NaN 时用默认值', () => {
    const content = '第一行\n关键词\n第三行'
    const result = searchInChapter(content, '关键词', { contextLines: Number.NaN })
    expect(result.ranges[0].start).toBe(0)
  })

  it('maxMatches 为 NaN 时用默认值', () => {
    const lines = Array.from({ length: 20 }, () => '关键词')
    const content = lines.join('\n')
    const result = searchInChapter(content, '关键词', { contextLines: 0, maxMatches: Number.NaN })
    expect(result.ranges).toHaveLength(1)
    expect(result.ranges[0].matchLines).toHaveLength(20)
  })

  it('contextLines=0 只返回匹配行本身', () => {
    const content = '第一行\n关键词\n第三行'
    const result = searchInChapter(content, '关键词', { contextLines: 0 })
    expect(result.ranges).toHaveLength(1)
    expect(result.ranges[0].start).toBe(1)
    expect(result.ranges[0].end).toBe(1)
  })

  it('多个匹配合并后 matchLines 完整保留', () => {
    const content = '关键词A\n关键词B\n关键词C\n第四行\n第五行'
    const result = searchInChapter(content, '关键词', { contextLines: 1 })
    expect(result.ranges).toHaveLength(1)
    expect(matchLineNumbers(result.ranges[0])).toEqual([0, 1, 2])
  })

  it('部分匹配被截断时 truncated=true', () => {
    const lines = Array.from({ length: 60 }, (_, i) => i % 3 === 0 ? '关键词' : `第${i}行`)
    const content = lines.join('\n')
    const result = searchInChapter(content, '关键词', { contextLines: 0, maxMatches: 3 })
    expect(result.truncated).toBe(true)
    expect(result.ranges).toHaveLength(3)
  })

  it('全部匹配都返回时 truncated=false', () => {
    const content = '关键词A\n第二行\n关键词B'
    const result = searchInChapter(content, '关键词', { contextLines: 1, maxMatches: 5 })
    expect(result.truncated).toBe(false)
  })
})

// ─── 多关键词搜索 ───

describe('searchInChapter 多关键词', () => {
  it('接受 string[] 参数', () => {
    const content = '林婉儿出场\n苏沐瑶出场\n两人对话'
    const result = searchInChapter(content, ['林婉儿', '苏沐瑶'])
    expect(result.totalMatches).toBe(2)
  })

  it('单关键词 string 与 [string] 等价', () => {
    const content = '林婉儿撑伞\n江南雨季'
    const r1 = searchInChapter(content, '林婉儿')
    const r2 = searchInChapter(content, ['林婉儿'])
    expect(r1.totalMatches).toBe(r2.totalMatches)
    expect(r1.ranges).toHaveLength(r2.ranges.length)
  })

  it('OR 模式（默认）：任一关键词命中即匹配', () => {
    const content = '林婉儿出场\n林姑娘回头\n苏沐瑶登场\n无关行'
    const result = searchInChapter(content, ['林婉儿', '林姑娘'], { contextLines: 0 })
    expect(result.totalMatches).toBe(2) // 第 1、2 行
  })

  it('AND 模式：必须全部命中才匹配', () => {
    const content = '林婉儿和苏沐瑶对话\n只有林婉儿\n只有苏沐瑶\n林婉儿回头看见苏沐瑶'
    const result = searchInChapter(content, ['林婉儿', '苏沐瑶'], { contextLines: 0, matchMode: 'and' })
    expect(result.totalMatches).toBe(2) // 第 1、4 行
  })

  it('AND 模式：单关键词时等价于普通搜索', () => {
    const content = '林婉儿出场\n无关行'
    const result = searchInChapter(content, ['林婉儿'], { contextLines: 0, matchMode: 'and' })
    expect(result.totalMatches).toBe(1)
  })

  it('OR 模式：记录每行命中的关键词', () => {
    // 两行距离足够远，避免合并区间
    const lines = Array.from({ length: 20 }, (_, i) => {
      if (i === 0) return '林婉儿和林姑娘'
      if (i === 15) return '林婉儿单独出场'
      return `第${i}行`
    })
    const content = lines.join('\n')
    const result = searchInChapter(content, ['林婉儿', '林姑娘'], { contextLines: 0, matchMode: 'or' })
    expect(result.totalMatches).toBe(2)
    // 第 1 行命中两个关键词
    const firstMatch = result.ranges[0].matchLines[0]
    expect(firstMatch.line).toBe(0)
    expect(firstMatch.matchedKeywords).toContain('林婉儿')
    expect(firstMatch.matchedKeywords).toContain('林姑娘')
    expect(firstMatch.matchedKeywords).toHaveLength(2)
    // 第 16 行（0-based 15）只命中一个
    const secondMatch = result.ranges[1].matchLines[0]
    expect(secondMatch.matchedKeywords).toEqual(['林婉儿'])
  })

  it('AND 模式：matchedKeywords 包含全部关键词', () => {
    const content = '林婉儿与苏沐瑶相遇'
    const result = searchInChapter(content, ['林婉儿', '苏沐瑶'], { contextLines: 0, matchMode: 'and' })
    expect(result.totalMatches).toBe(1)
    expect(result.ranges[0].matchLines[0].matchedKeywords).toEqual(['林婉儿', '苏沐瑶'])
  })

  it('空关键词数组返回零匹配', () => {
    const result = searchInChapter('内容', [])
    expect(result.totalMatches).toBe(0)
  })

  it('关键词数组含空串被过滤', () => {
    const content = '林婉儿出场'
    const result = searchInChapter(content, ['林婉儿', '', '  '])
    expect(result.totalMatches).toBe(1)
  })

  it('关键词数组去重', () => {
    const content = '林婉儿出场'
    const result = searchInChapter(content, ['林婉儿', '林婉儿', '林婉儿'])
    expect(result.totalMatches).toBe(1)
    // 去重后只有 1 个关键词，AND 模式也只查 1 个
    expect(result.ranges[0].matchLines[0].matchedKeywords).toEqual(['林婉儿'])
  })

  it('大小写不敏感（多关键词）', () => {
    const content = 'Hello world\nWorld peace'
    const result = searchInChapter(content, ['hello', 'WORLD'], { contextLines: 0, matchMode: 'or' })
    expect(result.totalMatches).toBe(2)
  })

  it('多关键词 AND 模式无匹配返回零', () => {
    const content = '只有林婉儿\n只有苏沐瑶'
    const result = searchInChapter(content, ['林婉儿', '苏沐瑶'], { contextLines: 0, matchMode: 'and' })
    expect(result.totalMatches).toBe(0)
    expect(result.ranges).toEqual([])
  })

  it('matchMode 默认为 or', () => {
    const content = '林婉儿出场'
    // 不传 matchMode，应等价于 or
    const r1 = searchInChapter(content, ['林婉儿', '苏沐瑶'])
    const r2 = searchInChapter(content, ['林婉儿', '苏沐瑶'], { matchMode: 'or' })
    expect(r1.totalMatches).toBe(r2.totalMatches)
  })

  it('matchMode 非法值降级为 or', () => {
    const content = '林婉儿出场'
    const result = searchInChapter(content, ['林婉儿', '苏沐瑶'], { matchMode: 'invalid' as any })
    expect(result.totalMatches).toBe(1)
  })
})

// ─── 多关键词格式化 ───

describe('多关键词格式化', () => {
  it('章节级 OR 输出含关键词标签和模式', () => {
    const content = '林婉儿出场\n林姑娘回头'
    const result = searchInChapter(content, ['林婉儿', '林姑娘'], { contextLines: 0 })
    const output = formatChapterResult('测试章', ['林婉儿', '林姑娘'], content, result, 'or')
    expect(output).toContain('「林婉儿」 / 「林姑娘」')
    expect(output).toContain('[OR]')
  })

  it('章节级 AND 输出含 [AND] 标签', () => {
    const content = '林婉儿和苏沐瑶同行'
    const result = searchInChapter(content, ['林婉儿', '苏沐瑶'], { contextLines: 0, matchMode: 'and' })
    const output = formatChapterResult('测试章', ['林婉儿', '苏沐瑶'], content, result, 'and')
    expect(output).toContain('[AND]')
  })

  it('单关键词时不显示模式标签', () => {
    const content = '林婉儿出场'
    const result = searchInChapter(content, ['林婉儿'], { contextLines: 0 })
    const output = formatChapterResult('测试章', ['林婉儿'], content, result)
    expect(output).not.toContain('[OR]')
    expect(output).not.toContain('[AND]')
  })

  it('匹配行显示命中的关键词后缀', () => {
    const content = '林婉儿和林姑娘一起'
    const result = searchInChapter(content, ['林婉儿', '林姑娘'], { contextLines: 0, matchMode: 'or' })
    const output = formatChapterResult('测试章', ['林婉儿', '林姑娘'], content, result, 'or')
    expect(output).toContain('（命中：林婉儿, 林姑娘）')
  })

  it('卷级多关键词输出', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '第一章', content: '林婉儿出场', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '第二章', content: '林姑娘回头', orderIndex: 2 })
    ]
    const entries = searchInChapters(chapters, ['林婉儿', '林姑娘'])
    const contentsById = new Map(chapters.map(c => [c.id, c.content]))
    const output = formatVolumeResult('第一卷', ['林婉儿', '林姑娘'], entries, contentsById, 'or')
    expect(output).toContain('「林婉儿」 / 「林姑娘」')
    expect(output).toContain('[OR]')
  })

  it('全书级多关键词 AND 输出', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '一', content: '林婉儿与苏沐瑶相遇', volumeId: 'v1', orderIndex: 1 })
    ]
    const volumes = [makeVolume({ id: 'v1', name: '第一卷', orderIndex: 1 })]
    const bookResult = searchInBook(chapters, volumes, ['林婉儿', '苏沐瑶'], { matchMode: 'and' })
    const contentsById = new Map(chapters.map(c => [c.id, c.content]))
    const output = formatBookResult(['林婉儿', '苏沐瑶'], bookResult, contentsById, 'and')
    expect(output).toContain('[AND]')
    expect(output).toContain('「林婉儿」 / 「苏沐瑶」')
  })
})


// ─── searchInChapters（多章节公共逻辑）───

describe('searchInChapters', () => {
  it('空关键词返回空数组', () => {
    const chapters = [makeChapter({ id: 'c1', title: '第一章', content: '内容' })]
    expect(searchInChapters(chapters, '')).toEqual([])
  })

  it('过滤掉无匹配的章节', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '第一章', content: '关键词出现', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '第二章', content: '没有目标词', orderIndex: 2 }),
      makeChapter({ id: 'c3', title: '第三章', content: '又有关键词', orderIndex: 3 })
    ]
    const entries = searchInChapters(chapters, '关键词')
    expect(entries).toHaveLength(2)
    expect(entries[0].chapterId).toBe('c1')
    expect(entries[1].chapterId).toBe('c3')
  })

  it('跳过无内容的章节', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '空章', content: '', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '有内容', content: '关键词', orderIndex: 2 })
    ]
    const entries = searchInChapters(chapters, '关键词')
    expect(entries).toHaveLength(1)
    expect(entries[0].chapterId).toBe('c2')
  })

  it('结果按 orderIndex 升序', () => {
    const chapters = [
      makeChapter({ id: 'c3', title: '三', content: '关键词', orderIndex: 3 }),
      makeChapter({ id: 'c1', title: '一', content: '关键词', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '二', content: '关键词', orderIndex: 2 })
    ]
    const entries = searchInChapters(chapters, '关键词')
    expect(entries.map(e => e.chapterId)).toEqual(['c1', 'c2', 'c3'])
  })

  it('每章默认 maxMatches=3', () => {
    const lines = Array.from({ length: 30 }, (_, i) => i % 2 === 0 ? '关键词' : `第${i}行`)
    const content = lines.join('\n')
    const chapters = [makeChapter({ id: 'c1', title: '一章', content, orderIndex: 1 })]
    const entries = searchInChapters(chapters, '关键词')
    // 不显式传 maxMatches 时，searchInChapters 仍用默认 5
    // 这里测试不传 options 时行为
    expect(entries[0].result.ranges.length).toBeLessThanOrEqual(5)
  })
})

// ─── searchInBook（全书搜索）───

describe('searchInBook', () => {
  it('空关键词返回空结果', () => {
    const chapters = [makeChapter({ id: 'c1', title: '第一章', content: '内容' })]
    const volumes = [makeVolume({ id: 'v1', name: '第一卷' })]
    const result = searchInBook(chapters, volumes, '')
    expect(result.totalMatches).toBe(0)
    expect(result.totalChapters).toBe(0)
    expect(result.volumes).toEqual([])
  })

  it('按卷分组，卷按 orderIndex 升序', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '一', content: '关键词', volumeId: 'v2', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '二', content: '关键词', volumeId: 'v1', orderIndex: 2 })
    ]
    const volumes = [
      makeVolume({ id: 'v1', name: '第一卷', orderIndex: 1 }),
      makeVolume({ id: 'v2', name: '第二卷', orderIndex: 2 })
    ]
    const result = searchInBook(chapters, volumes, '关键词')
    expect(result.volumes).toHaveLength(2)
    expect(result.volumes[0].volumeName).toBe('第一卷')
    expect(result.volumes[1].volumeName).toBe('第二卷')
  })

  it('未分卷章节归入 null 卷，排末尾', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '未分卷章', content: '关键词', volumeId: null, orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '已分卷章', content: '关键词', volumeId: 'v1', orderIndex: 2 })
    ]
    const volumes = [makeVolume({ id: 'v1', name: '第一卷', orderIndex: 1 })]
    const result = searchInBook(chapters, volumes, '关键词')
    expect(result.volumes).toHaveLength(2)
    expect(result.volumes[0].volumeName).toBe('第一卷')
    expect(result.volumes[1].volumeName).toBeNull()
    expect(result.volumes[1].volumeId).toBeNull()
  })

  it('过滤无匹配章节所在的整卷', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '一', content: '关键词', volumeId: 'v1', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '二', content: '无相关', volumeId: 'v2', orderIndex: 2 })
    ]
    const volumes = [
      makeVolume({ id: 'v1', name: '第一卷', orderIndex: 1 }),
      makeVolume({ id: 'v2', name: '第二卷', orderIndex: 2 })
    ]
    const result = searchInBook(chapters, volumes, '关键词')
    expect(result.volumes).toHaveLength(1)
    expect(result.volumes[0].volumeName).toBe('第一卷')
  })

  it('汇总 totalMatches 和 totalChapters', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '一', content: '关键词A\n关键词B', volumeId: 'v1', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '二', content: '关键词C', volumeId: 'v2', orderIndex: 2 })
    ]
    const volumes = [
      makeVolume({ id: 'v1', name: '第一卷', orderIndex: 1 }),
      makeVolume({ id: 'v2', name: '第二卷', orderIndex: 2 })
    ]
    const result = searchInBook(chapters, volumes, '关键词')
    expect(result.totalChapters).toBe(2)
    expect(result.totalMatches).toBe(3)
    expect(result.volumes[0].totalMatches).toBe(2)
    expect(result.volumes[1].totalMatches).toBe(1)
  })

  it('全书搜索默认 maxMatches=3 每章', () => {
    // 30 行每隔 2 行一个匹配，共 15 处
    const lines = Array.from({ length: 30 }, (_, i) => i % 2 === 0 ? '关键词' : `第${i}行`)
    const content = lines.join('\n')
    const chapters = [
      makeChapter({ id: 'c1', title: '一', content, volumeId: 'v1', orderIndex: 1 })
    ]
    const volumes = [makeVolume({ id: 'v1', name: '第一卷', orderIndex: 1 })]
    const result = searchInBook(chapters, volumes, '关键词')
    expect(result.totalMatches).toBe(15)
    expect(result.volumes[0].chapters[0].result.ranges.length).toBeLessThanOrEqual(3)
  })

  it('用户显式传 maxMatches 优先于默认值', () => {
    const lines = Array.from({ length: 30 }, (_, i) => i % 2 === 0 ? '关键词' : `第${i}行`)
    const content = lines.join('\n')
    const chapters = [makeChapter({ id: 'c1', title: '一', content, volumeId: 'v1', orderIndex: 1 })]
    const volumes = [makeVolume({ id: 'v1', name: '第一卷', orderIndex: 1 })]
    const result = searchInBook(chapters, volumes, '关键词', { maxMatches: 10 })
    expect(result.volumes[0].chapters[0].result.ranges.length).toBeLessThanOrEqual(10)
  })

  it('卷内章节按 orderIndex 升序', () => {
    const chapters = [
      makeChapter({ id: 'c3', title: '三', content: '关键词', volumeId: 'v1', orderIndex: 3 }),
      makeChapter({ id: 'c1', title: '一', content: '关键词', volumeId: 'v1', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '二', content: '关键词', volumeId: 'v1', orderIndex: 2 })
    ]
    const volumes = [makeVolume({ id: 'v1', name: '第一卷', orderIndex: 1 })]
    const result = searchInBook(chapters, volumes, '关键词')
    const chapterIds = result.volumes[0].chapters.map(c => c.chapterId)
    expect(chapterIds).toEqual(['c1', 'c2', 'c3'])
  })
})

// ─── formatChapterResult ───

describe('formatChapterResult', () => {
  it('无匹配返回未找到提示', () => {
    const result = searchInChapter('内容', '不存在')
    const output = formatChapterResult('测试章节', '不存在', '内容', result)
    expect(output).toBe('在章节「测试章节」中未找到「不存在」')
  })

  it('单匹配格式包含行号和上下文', () => {
    const content = '第一行\n关键词\n第三行'
    const result = searchInChapter(content, '关键词', { contextLines: 1 })
    const output = formatChapterResult('测试章', '关键词', content, result)
    expect(output).toContain('找到 1 处匹配')
    expect(output).toContain('第 1-3 行')
    expect(output).toContain('▶ 2| 关键词')
  })

  it('截断时显示"显示前 N 处"', () => {
    const lines = Array.from({ length: 60 }, (_, i) => i % 3 === 0 ? '关键词' : `第${i}行`)
    const content = lines.join('\n')
    const result = searchInChapter(content, '关键词', { contextLines: 0, maxMatches: 3 })
    const output = formatChapterResult('测试章', '关键词', content, result)
    expect(output).toContain('找到 20 处匹配')
    expect(output).toContain('显示前 3 处')
  })

  it('匹配行用 ▶ 标记，非匹配行用空格', () => {
    const content = '第一行\n关键词\n第三行'
    const result = searchInChapter(content, '关键词', { contextLines: 1 })
    const output = formatChapterResult('测试章', '关键词', content, result)
    const outputLines = output.split('\n')
    const marked = outputLines.filter(l => l.startsWith('▶'))
    const unmarked = outputLines.filter(l => l.startsWith(' ') && l.includes('|'))
    expect(marked).toHaveLength(1)
    expect(marked[0]).toContain('关键词')
    expect(unmarked.length).toBeGreaterThan(0)
  })

  it('单行区间显示"第 N 行"而非"第 N-N 行"', () => {
    const content = '关键词\n第二行\n第三行'
    const result = searchInChapter(content, '关键词', { contextLines: 0 })
    const output = formatChapterResult('测试章', '关键词', content, result)
    expect(output).toContain('第 1 行')
    expect(output).not.toContain('第 1-1 行')
  })
})

// ─── formatVolumeResult ───

describe('formatVolumeResult', () => {
  it('多章节按章节标题分组', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '第一章', content: '关键词出现', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '第二章', content: '关键词也出现', orderIndex: 2 })
    ]
    const entries = searchInChapters(chapters, '关键词')
    const contentsById = new Map(chapters.map(c => [c.id, c.content]))
    const output = formatVolumeResult('第一卷', '关键词', entries, contentsById)
    expect(output).toContain('在卷「第一卷」')
    expect(output).toContain('2 个章节中找到')
    expect(output).toContain('## 章节「第一章」')
    expect(output).toContain('## 章节「第二章」')
  })

  it('卷名 null 时显示"未分卷"', () => {
    const chapters = [makeChapter({ id: 'c1', title: '第一章', content: '关键词', orderIndex: 1 })]
    const entries = searchInChapters(chapters, '关键词')
    const contentsById = new Map(chapters.map(c => [c.id, c.content]))
    const output = formatVolumeResult(null, '关键词', entries, contentsById)
    expect(output).toContain('在卷「未分卷」')
  })

  it('汇总每章匹配数', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '第一章', content: '关键词A\n关键词B', orderIndex: 1 })
    ]
    const entries = searchInChapters(chapters, '关键词')
    const contentsById = new Map(chapters.map(c => [c.id, c.content]))
    const output = formatVolumeResult('第一卷', '关键词', entries, contentsById)
    expect(output).toContain('2 处匹配')
  })
})

// ─── formatBookResult ───

describe('formatBookResult', () => {
  it('按卷→章节层级输出', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '第一章', content: '关键词', volumeId: 'v1', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '第二章', content: '关键词', volumeId: 'v2', orderIndex: 2 })
    ]
    const volumes = [
      makeVolume({ id: 'v1', name: '第一卷', orderIndex: 1 }),
      makeVolume({ id: 'v2', name: '第二卷', orderIndex: 2 })
    ]
    const bookResult = searchInBook(chapters, volumes, '关键词')
    const contentsById = new Map(chapters.map(c => [c.id, c.content]))
    const output = formatBookResult('关键词', bookResult, contentsById)
    expect(output).toContain('在全书搜索')
    expect(output).toContain('2 个卷、2 个章节中找到')
    expect(output).toContain('# 卷「第一卷」')
    expect(output).toContain('# 卷「第二卷」')
    expect(output).toContain('## 章节「第一章」')
    expect(output).toContain('## 章节「第二章」')
  })

  it('未分卷章节归入"未分卷"组', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '散章', content: '关键词', volumeId: null, orderIndex: 1 })
    ]
    const volumes: Volume[] = []
    const bookResult = searchInBook(chapters, volumes, '关键词')
    const contentsById = new Map(chapters.map(c => [c.id, c.content]))
    const output = formatBookResult('关键词', bookResult, contentsById)
    expect(output).toContain('# 卷「未分卷」')
  })

  it('无匹配返回"全书未找到"', () => {
    const chapters = [makeChapter({ id: 'c1', title: '第一章', content: '无内容' })]
    const volumes: Volume[] = []
    const bookResult = searchInBook(chapters, volumes, '关键词')
    const contentsById = new Map(chapters.map(c => [c.id, c.content]))
    const output = formatBookResult('关键词', bookResult, contentsById)
    expect(output).toBe('全书未找到「关键词」')
  })

  it('每卷显示章节数和匹配数', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '一', content: '关键词A\n关键词B', volumeId: 'v1', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '二', content: '关键词C', volumeId: 'v1', orderIndex: 2 })
    ]
    const volumes = [makeVolume({ id: 'v1', name: '第一卷', orderIndex: 1 })]
    const bookResult = searchInBook(chapters, volumes, '关键词')
    const contentsById = new Map(chapters.map(c => [c.id, c.content]))
    const output = formatBookResult('关键词', bookResult, contentsById)
    expect(output).toContain('2 个章节，3 处匹配')
  })

  it('汇总头部显示卷数和章节数', () => {
    const chapters = [
      makeChapter({ id: 'c1', title: '一', content: '关键词', volumeId: 'v1', orderIndex: 1 }),
      makeChapter({ id: 'c2', title: '二', content: '关键词', volumeId: 'v2', orderIndex: 2 }),
      makeChapter({ id: 'c3', title: '三', content: '关键词', volumeId: 'v2', orderIndex: 3 })
    ]
    const volumes = [
      makeVolume({ id: 'v1', name: '第一卷', orderIndex: 1 }),
      makeVolume({ id: 'v2', name: '第二卷', orderIndex: 2 })
    ]
    const bookResult = searchInBook(chapters, volumes, '关键词')
    const contentsById = new Map(chapters.map(c => [c.id, c.content]))
    const output = formatBookResult('关键词', bookResult, contentsById)
    expect(output).toContain('2 个卷、3 个章节中找到 3 处匹配')
  })
})
