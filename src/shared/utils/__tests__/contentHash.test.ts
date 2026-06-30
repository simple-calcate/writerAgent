import { describe, it, expect } from 'vitest'
import { contentHash, isSummaryStale, getSummaryStatus } from '../contentHash'

describe('contentHash', () => {
  it('空内容返回固定标识 "empty"', () => {
    expect(contentHash('')).toBe('empty')
  })

  it('相同内容必然产生相同哈希', () => {
    const text = '这是一段测试内容，用于验证哈希稳定性。'
    expect(contentHash(text)).toBe(contentHash(text))
  })

  it('短内容（≤200 字符）包含长度信息', () => {
    const text = '短文本'
    const hash = contentHash(text)
    expect(hash).toMatch(/^3:/)
  })

  it('长内容（>200 字符）包含长度信息', () => {
    const text = 'A'.repeat(500)
    const hash = contentHash(text)
    expect(hash).toMatch(/^500:/)
  })

  it('内容任何实质修改都会改变哈希', () => {
    const original = '第一章 开端\n\n张三走进了森林。'.repeat(20)
    const edited = '第一章 开端\n\n李四走进了森林。'.repeat(20)
    expect(contentHash(original)).not.toBe(contentHash(edited))
  })

  it('长度相同但内容不同的文本哈希不同', () => {
    const a = 'A'.repeat(300)
    const b = 'B'.repeat(300)
    expect(contentHash(a)).not.toBe(contentHash(b))
  })

  it('仅首尾空白变化也视为内容变化（不做 normalize）', () => {
    const a = '内容'
    const b = ' 内容 '
    expect(contentHash(a)).not.toBe(contentHash(b))
  })
})

describe('isSummaryStale', () => {
  it('未生成摘要时视为过期', () => {
    expect(isSummaryStale({ content: '章节内容', summaryResult: null, summaryOfContentHash: null })).toBe(true)
  })

  it('内容为空时不算过期（无需生成摘要）', () => {
    expect(isSummaryStale({ content: '', summaryResult: null })).toBe(false)
    expect(isSummaryStale({ content: '   \n  ', summaryResult: null })).toBe(false)
  })

  it('有摘要但无指纹（旧数据）视为过期', () => {
    expect(isSummaryStale({ content: '内容', summaryResult: '旧摘要', summaryOfContentHash: null })).toBe(true)
    expect(isSummaryStale({ content: '内容', summaryResult: '旧摘要' })).toBe(true)
  })

  it('指纹与当前内容一致 → 未过期', () => {
    const content = '章节内容'.repeat(50)
    const hash = contentHash(content)
    expect(isSummaryStale({ content, summaryResult: '摘要', summaryOfContentHash: hash })).toBe(false)
  })

  it('指纹与当前内容不一致 → 已过期', () => {
    const oldContent = '原始内容'.repeat(50)
    const newContent = '修改后内容'.repeat(50)
    const hash = contentHash(oldContent)
    expect(isSummaryStale({ content: newContent, summaryResult: '摘要', summaryOfContentHash: hash })).toBe(true)
  })
})

describe('getSummaryStatus', () => {
  it('none: 未生成过摘要', () => {
    expect(getSummaryStatus({ content: '内容', summaryResult: null })).toBe('none')
  })

  it('fresh: 空内容但有摘要 → fresh（避免误报过期）', () => {
    expect(getSummaryStatus({ content: '', summaryResult: '摘要' })).toBe('fresh')
  })

  it('fresh: 指纹与当前内容一致', () => {
    const content = '内容'.repeat(50)
    expect(getSummaryStatus({ content, summaryResult: '摘要', summaryOfContentHash: contentHash(content) })).toBe('fresh')
  })

  it('stale: 指纹与当前内容不一致', () => {
    expect(getSummaryStatus({ content: '新内容', summaryResult: '旧摘要', summaryOfContentHash: 'old-hash' })).toBe('stale')
  })

  it('stale: 有摘要但无指纹（旧数据迁移场景）', () => {
    expect(getSummaryStatus({ content: '内容', summaryResult: '旧摘要', summaryOfContentHash: null })).toBe('stale')
  })
})
