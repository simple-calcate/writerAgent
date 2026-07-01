import type { Chapter, Volume, DialogueLevel } from '../../../shared/types'
import { getFeatureSkillContent } from '../feature-skills'
import { getCurrentApprovalMode } from '../tools/helpers'

export function buildToolInstructions(chapters: Chapter[], level: DialogueLevel, currentChapter: Chapter | null | undefined, allVolumes: Volume[]): string {
  const parts: string[] = ['\n## 可用工具']

  const mode = getCurrentApprovalMode()
  const isStrict = mode === 'strict'

  parts.push('你可以调用以下工具来帮助用户：')
  parts.push('')
  parts.push('**摘要/润色类工具：**')
  parts.push('- **summarize_chapter**(chapterId) — 对章节进行结构化摘要（人物/事件/伏笔/场景/情感）')
  parts.push('- **refine_summary**(chapterId) — 用一段话精炼概括章节核心情节')
  parts.push('- **polish_text**(chapterId, text) — 润色指定文本片段')
  parts.push('')
  parts.push('**内容查看工具：**')
  parts.push(`- **read_chapter_content**(chapterId) — 读取章节完整正文内容${isStrict ? '（需要用户确认）' : '（智能模式下自动执行，无需确认）'}`)
  parts.push('')
  parts.push('**创建/编辑类工具（需要用户确认）：**')
  parts.push('- **create_volume**(name) — 创建新卷。当还没有卷时，必须先创建卷再创建章节')
  parts.push('- **create_chapter**(title, volumeId) — 创建新章节。volumeId 必填，必须先有卷')
  parts.push('- **rename_chapter**(chapterId, newTitle) — 重命名章节')
  parts.push('- **write_outline**(content) — 撰写或更新书籍大纲（Markdown 格式）')
  parts.push('- **write_volume_outline**(volumeId, content) — 撰写或更新卷纲（Markdown 格式）')
  parts.push('- **write_chapter_outline**(chapterId, content) — 撰写或更新章纲（Markdown 格式）')
  parts.push('- **write_chapter_content**(chapterId, content) — 为章节撰写完整正文内容。始终需要用户确认')
  parts.push('')
  parts.push('**正文搜索工具：**')
  parts.push('- **search_content**(query, scope?, chapterId?, volumeId?, contextLines?, maxMatches?, matchMode?) — 在章节/卷/全书中搜索关键词，返回匹配位置与上下文。只读，无需确认')
  parts.push('')
  parts.push('**技能管理工具：**')
  parts.push('- **list_skills**() — 查看所有写作技能及其在各功能上的挂载状态。只读，无需确认')
  parts.push('- **toggle_feature_skill**(skillId, feature, enabled) — 调整技能在指定功能（dialogue/polish/summary/continuation）上的挂载状态。需要用户确认')
  parts.push('- **extract_skill**(name, category, content, source?) — 从章节中提取写作技能。需要用户确认')
  parts.push('- **refine_skill**(skillId, content, reason?) — 修正已有技能内容。需要用户确认')
  parts.push('')
  parts.push('**批量工具（需要用户确认）：**')
  parts.push('- **batch_refine_summaries**(volumeId?) — 对指定卷的所有章节进行精炼总结。传入 volumeId 则处理该卷，不传则处理当前卷')
  parts.push('')
  parts.push(`**当前确认模式：${isStrict ? '严格模式' : '智能模式（默认）'}**`)
  if (isStrict) {
    parts.push('所有读取和写入操作均需用户确认。')
  } else {
    parts.push('仅写入/修改类操作需用户确认，查看类操作（如 read_chapter_content）会自动执行。')
  }
  parts.push('')
  parts.push('**计划执行流程**：当用户确认计划后，按以下顺序执行：')
  parts.push('1. create_chapter → 2. write_chapter_outline → 3. write_chapter_content')
  parts.push('每个写入步骤都会请求用户确认。完成一步后继续下一步，直到计划全部完成。')

  parts.push('')
  parts.push('## 向用户提问的格式')
  parts.push('当你需要用户在几个选项中做选择时（例如选择风格、方向、方案），必须用以下格式输出，前端会自动渲染为可点击的快捷回复按钮：')
  parts.push('')
  parts.push('```')
  parts.push('<question title="简短的问题描述">')
  parts.push('<option>选项一</option>')
  parts.push('<option>选项二</option>')
  parts.push('<option>选项三</option>')
  parts.push('</question>')
  parts.push('```')
  parts.push('')
  parts.push('规则：')
  parts.push('- 只有当你希望用户从给出的选项中做选择时才用此格式；开放式提问（如"你对这段情节有什么想法？"）直接用普通文本提问，不要用 <question> 标签')
  parts.push('- title 是对问题的简短概括（10-20 字），<option> 的文本就是选项内容')
  parts.push('- 提供 2-5 个选项，选项应当互斥且覆盖主要可能')
  parts.push('- 不要在 <question> 标签外重复列同样的编号列表，避免重复展示')
  parts.push('- 标签会自动被界面处理，用户点击选项即可回复')

  const outlineSkill = getFeatureSkillContent('outline')
  if (outlineSkill) {
    parts.push(`\n**大纲撰写指导：**\n${outlineSkill}`)
  }

  const chapterContentSkill = getFeatureSkillContent('chapterContent')
  if (chapterContentSkill) {
    parts.push(`\n**正文撰写指导：**\n${chapterContentSkill}`)
  }

  if (chapters.length > 0) {
    parts.push('\n可操作的章节列表：')
    for (const ch of chapters) {
      const summary = ch.summaryResult ? ` — ${ch.summaryResult.substring(0, 60)}...` : ''
      const isCurrent = ch.id === currentChapter?.id ? ' （当前章节）' : ''
      parts.push(`- [${ch.id}] ${ch.title}${isCurrent}${summary}`)
    }
  }

  if (allVolumes.length > 0) {
    parts.push('\n可操作的卷列表：')
    for (const vol of allVolumes) {
      parts.push(`- [${vol.id}] ${vol.name}`)
    }
  }

  if (level === 'chapter' && currentChapter) {
    parts.push(`\n当用户未指定章节时，默认操作当前章节（ID: ${currentChapter.id}）。`)
  }

  return parts.join('\n')
}
