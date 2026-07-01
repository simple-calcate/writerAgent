import { describe, it, expect } from 'vitest'
import { extractQuestionGroups, stripQuestionTags } from '../helpers'

describe('extractQuestionGroups — 标签解析', () => {
  it('解析标准 <question> 标签', () => {
    const text = '需要确认风格：\n<question title="选择叙事视角">\n<option>第一人称</option>\n<option>第三人称有限</option>\n<option>全知视角</option>\n</question>'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(1)
    expect(groups[0].question).toBe('选择叙事视角')
    expect(groups[0].options).toHaveLength(3)
    expect(groups[0].options[0].value).toBe('第一人称')
    expect(groups[0].options[2].value).toBe('全知视角')
  })

  it('解析多个 <question> 块', () => {
    const text = '<question title="问题一">\n<option>A</option>\n<option>B</option>\n</question>\n文本\n<question title="问题二">\n<option>C</option>\n<option>D</option>\n</question>'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(2)
    expect(groups[0].question).toBe('问题一')
    expect(groups[1].question).toBe('问题二')
  })

  it('少于 2 个 option 的 question 块被忽略', () => {
    const text = '<question title="单选">\n<option>唯一选项</option>\n</question>'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(0)
  })

  it('标签优先于启发式：有标签时不走启发式', () => {
    const text = '你想用什么风格？\n1. 轻松\n2. 严肃\n\n<question title="选择篇幅">\n<option>短篇</option>\n<option>长篇</option>\n</question>'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(1)
    expect(groups[0].question).toBe('选择篇幅')
  })
})

describe('extractQuestionGroups — 严格启发式回退', () => {
  it('问号 + 编号列表 → 识别', () => {
    const text = '你希望用哪种叙事视角？\n1. 第一人称\n2. 第三人称有限\n3. 全知视角'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(1)
    expect(groups[0].options).toHaveLength(3)
    expect(groups[0].options[0].value).toBe('第一人称')
  })

  it('问号 + 字母列表 → 识别', () => {
    const text = '请选择哪种风格？\nA. 轻松幽默\nB. 严肃深沉'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(1)
    expect(groups[0].options).toHaveLength(2)
  })

  it('中文问号也识别', () => {
    const text = '你想要什么结局？\n1. 圆满\n2. 悲剧'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(1)
  })

  it('纯编号列表无问号 → 不识别（修复乱弹）', () => {
    const text = '写作步骤：\n1. 构思大纲\n2. 撰写初稿\n3. 润色修改'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(0)
  })

  it('枚举说明无问号 → 不识别', () => {
    const text = '本功能支持以下模式：\n1. 智能模式\n2. 严格模式'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(0)
  })

  it('问号但无列表 → 不识别', () => {
    const text = '你对这段情节有什么想法？'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(0)
  })

  it('列表在第一行（无前置问题文本）→ 不识别', () => {
    const text = '1. 选项A\n2. 选项B'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(0)
  })

  it('多个问号段落各自识别', () => {
    const text = '视角？\n1. 第一人称\n2. 第三人称\n\n篇幅？\nA. 短篇\nB. 长篇'
    const groups = extractQuestionGroups(text)
    expect(groups).toHaveLength(2)
  })
})

describe('stripQuestionTags', () => {
  it('无标签原样返回', () => {
    const text = '普通文本，没有标签'
    expect(stripQuestionTags(text)).toBe(text)
  })

  it('把 <question> 标签转为纯文本', () => {
    const text = '请选择：\n<question title="选择风格">\n<option>轻松</option>\n<option>严肃</option>\n</question>'
    const result = stripQuestionTags(text)
    expect(result).not.toContain('<question')
    expect(result).not.toContain('<option')
    expect(result).toContain('**选择风格**')
    expect(result).toContain('- 轻松')
    expect(result).toContain('- 严肃')
    expect(result).toContain('请选择：')
  })

  it('处理多个 question 块', () => {
    const text = '<question title="Q1">\n<option>A</option>\n<option>B</option>\n</question>\n中间文本\n<question title="Q2">\n<option>C</option>\n</question>'
    const result = stripQuestionTags(text)
    expect(result).not.toContain('<question')
    expect(result).toContain('**Q1**')
    expect(result).toContain('**Q2**')
    expect(result).toContain('中间文本')
  })

  it('空字符串安全处理', () => {
    expect(stripQuestionTags('')).toBe('')
    expect(stripQuestionTags(null as any)).toBe(null)
  })
})
