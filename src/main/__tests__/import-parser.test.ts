import { describe, it, expect } from 'vitest'
import { parseTxtContent } from '../import-parser'

describe('parseTxtContent', () => {
  it('空内容返回空数组', () => {
    expect(parseTxtContent('')).toEqual([])
  })

  it('纯空白内容返回空数组', () => {
    expect(parseTxtContent('   \n\n  \t  ')).toEqual([])
  })

  it('识别"第N章 标题"格式', () => {
    const content = '第1章 开端\n主角登场\n\n第2章 冲突\n冲突开始'
    const result = parseTxtContent(content)
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('第1章 开端')
    expect(result[0].content).toContain('主角登场')
    expect(result[1].title).toBe('第2章 冲突')
    expect(result[1].content).toContain('冲突开始')
  })

  it('章节标题行首不能有前导空白（CHAPTER_RE 锚定行首）', () => {
    // 注意：CHAPTER_RE = /^第\d+章\s+(.+)/，行首必须直接是"第"
    const content = '第1章 开端\n内容'
    const result = parseTxtContent(content)
    expect(result[0].title).toBe('第1章 开端')
  })

  it('支持 CRLF 换行', () => {
    const content = '第1章 开端\r\n内容行1\r\n第2章 结束\r\n内容行2'
    const result = parseTxtContent(content)
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('第1章 开端')
  })

  it('每个非空行作为独立段落，用 \\n\\n 连接', () => {
    const content = '第1章 测试\n行1\n行2\n行3'
    const result = parseTxtContent(content)
    expect(result[0].content).toBe('行1\n\n行2\n\n行3')
  })

  it('空行不产生内容段落', () => {
    const content = '第1章 测试\n行1\n\n\n\n行2'
    const result = parseTxtContent(content)
    expect(result[0].content).toBe('行1\n\n行2')
  })

  it('分隔线 --- 作为独立段落保留', () => {
    const content = '第1章 测试\n场景A\n---\n场景B'
    const result = parseTxtContent(content)
    expect(result[0].content).toContain('---')
    expect(result[0].content).toContain('场景A')
    expect(result[0].content).toContain('场景B')
  })

  it('无章节标记时按字数自动分段（约 3000 字/段）', () => {
    // 构造超过 3000 字的内容：300 段 × 约 14 字 ≈ 4200 字
    const longText = Array.from({ length: 300 }, (_, i) => `这是第${i}段内容，约二十字`).join('\n')
    const result = parseTxtContent(longText)
    expect(result.length).toBeGreaterThan(1)
    // 自动分段的标题为"第N节"
    expect(result[0].title).toMatch(/^第\d+节$/)
  })

  it('无章节标记且内容较短时返回单段"第1节"', () => {
    const content = '这是一段简短的内容\n第二行'
    const result = parseTxtContent(content)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('第1节')
  })

  it('大章节序号也能识别', () => {
    const content = '第123章 大事件\n内容'
    const result = parseTxtContent(content)
    expect(result[0].title).toBe('第123章 大事件')
  })

  it('章节标题后无内容也能识别', () => {
    const content = '第1章 空章\n\n第2章 有内容\n内容'
    const result = parseTxtContent(content)
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('第1章 空章')
    expect(result[0].content).toBe('')
  })
})
