import type { Chapter, Volume, DialogueLevel } from '../../../shared/types'
import { getFeatureSkillContent } from '../feature-skills'

export function buildToolInstructions(chapters: Chapter[], level: DialogueLevel, currentChapter: Chapter | null | undefined, allVolumes: Volume[]): string {
  const parts: string[] = ['\n## 可用工具']

  parts.push('你可以调用以下工具来帮助用户：')
  parts.push('')
  parts.push('**摘要/润色类工具：**')
  parts.push('- **summarize_chapter**(chapterId) — 对章节进行结构化摘要（人物/事件/伏笔/场景/情感）')
  parts.push('- **refine_summary**(chapterId) — 用一段话精炼概括章节核心情节')
  parts.push('- **polish_text**(chapterId, text) — 润色指定文本片段')
  parts.push('')
  parts.push('**内容查看工具（需要用户确认）：**')
  parts.push('- **read_chapter_content**(chapterId) — 读取章节完整正文内容。当你需要查看章节内容来给出建议时使用')
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
  parts.push('**技能管理工具：**')
  parts.push('- **list_skills**() — 查看所有写作技能及其在各功能上的挂载状态。只读，无需确认')
  parts.push('- **toggle_feature_skill**(skillId, feature, enabled) — 调整技能在指定功能（dialogue/polish/summary/continuation）上的挂载状态。需要用户确认')
  parts.push('- **extract_skill**(name, category, content, source?) — 从章节中提取写作技能。需要用户确认')
  parts.push('- **refine_skill**(skillId, content, reason?) — 修正已有技能内容。需要用户确认')
  parts.push('')
  parts.push('**批量工具（需要用户确认）：**')
  parts.push('- **batch_refine_summaries**(volumeId?) — 对指定卷的所有章节进行精炼总结。传入 volumeId 则处理该卷，不传则处理当前卷')
  parts.push('')
  parts.push('**计划执行流程**：当用户确认计划后，按以下顺序执行：')
  parts.push('1. create_chapter → 2. write_chapter_outline → 3. write_chapter_content')
  parts.push('每个步骤都会请求用户确认。完成一步后继续下一步，直到计划全部完成。')

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
