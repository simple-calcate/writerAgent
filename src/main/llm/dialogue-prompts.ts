import type { Project, Volume, Chapter, BookAIConfig, DialogueLevel, Outline, WritingSkill, SkillCategory, ContextConfig } from '../../shared/types'
import { formatKnowledgeForPrompt } from '../../shared/novel-knowledge'
import { estimateTokens, createBudget, allocateSectionBudgets, truncateToTokenBudget } from './token-counter'
import { ROLE_PREAMBLES, buildBookContext, buildVolumeContext, buildChapterContext, getToolScopeChapters, buildOutlineContext, buildToolInstructions, PLAN_MODE_PROMPT, detectPlanMode } from './prompts'

interface PromptParams {
  level: DialogueLevel
  project: Project
  volume?: Volume | null
  chapter?: Chapter | null
  allVolumes?: Volume[]
  allChapters?: Chapter[]
  outlines?: Outline[]
  isPlanMode?: boolean
  skills?: WritingSkill[]
  reasoningContext?: string
  contextWindow?: number
  contextConfig?: ContextConfig
}

export function buildDialogueSystemPrompt(params: PromptParams): string {
  const { level, project, volume, chapter, allVolumes, allChapters, outlines, isPlanMode } = params

  const budget = createBudget(params.contextWindow, params.contextConfig)
  const sectionBudgets = allocateSectionBudgets(budget, params.contextConfig)

  interface Section {
    content: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    budgetName: string
  }

  const sections: Section[] = []

  sections.push({ content: ROLE_PREAMBLES[level], priority: 'critical', budgetName: 'other' })

  if (project.genre) {
    const knowledge = formatKnowledgeForPrompt(project.genre)
    if (knowledge) {
      sections.push({ content: `\n## 类型知识库\n${knowledge}`, priority: 'high', budgetName: 'other' })
    }
  }

  const aiConfig = resolveConfig(project)
  if (aiConfig.customPrompt) {
    sections.push({ content: `\n## 作者补充要求\n${aiConfig.customPrompt}`, priority: 'medium', budgetName: 'other' })
  }

  if (params.skills && params.skills.length > 0) {
    const skillsContent = buildSkillsSection(params.skills)
    sections.push({ content: skillsContent, priority: 'medium', budgetName: 'skills' })
  }

  if (level === 'book') {
    sections.push({ content: buildBookContext(project, allVolumes || [], allChapters || []), priority: 'high', budgetName: 'chapter' })
  } else if (level === 'volume' && volume) {
    sections.push({ content: buildVolumeContext(project, volume, allChapters || []), priority: 'high', budgetName: 'chapter' })
  } else if (level === 'chapter' && chapter) {
    const chapterBudget = sectionBudgets.chapter.maxTokens
    sections.push({ content: buildChapterContext(project, volume, chapter, allChapters || [], outlines || [], chapterBudget), priority: 'critical', budgetName: 'chapter' })
  }

  if (outlines && outlines.length > 0) {
    const outlineBudget = sectionBudgets.outlines.maxTokens
    sections.push({ content: buildOutlineContext(outlines, outlineBudget), priority: 'high', budgetName: 'outlines' })
  }

  const toolChapters = getToolScopeChapters(level, chapter, allVolumes || [], allChapters || [])
  sections.push({ content: buildToolInstructions(toolChapters, level, chapter, allVolumes || []), priority: 'medium', budgetName: 'tools' })

  if (isPlanMode) {
    sections.push({ content: PLAN_MODE_PROMPT, priority: 'high', budgetName: 'other' })
  }

  if (params.reasoningContext) {
    sections.push({ content: params.reasoningContext, priority: 'medium', budgetName: 'reasoning' })
  }

  sections.push({ content: `\n## 行为准则
- 你的目标是通过启发式对话帮助作者思考，而不是直接给出答案
- 每次回复后，可以提出 1-2 个引导性问题帮助作者深入思考
- 如果作者的想法有明显的类型惯例冲突，友善地指出并提供建议
- 尊重作者的创作自由，提供建议而非指令
- 回复简洁有力，避免冗长的理论阐述
- 当用户要求总结、摘要、润色章节内容时，主动调用工具而不是自己编造结果
- 当你需要查看某个章节的内容来给出建议时，使用 read_chapter_content 工具（会请求用户同意）
- 写入类工具（创建章节、撰写大纲、撰写内容等）调用前会自动请求用户确认，这是正常流程
- 【重要】创建章节前必须先有卷。如果当前没有卷，先创建卷，再创建章节
- 【重要】在计划执行模式下，确认计划后必须连续调用工具完成所有步骤，不要中途停止或总结`, priority: 'critical', budgetName: 'other' })

  return assembleWithBudget(sections, budget.available)
}

function resolveConfig(project: Project): BookAIConfig {
  return project.aiConfig
}

function assembleWithBudget(sections: Array<{ content: string; priority: string; budgetName: string }>, totalBudget: number): string {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...sections].sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder])

  let usedTokens = 0
  const included: string[] = []

  for (const section of sorted) {
    const sectionTokens = estimateTokens(section.content)
    if (usedTokens + sectionTokens <= totalBudget) {
      included.push(section.content)
      usedTokens += sectionTokens
    } else if (section.priority === 'critical') {
      included.push(section.content)
      usedTokens += sectionTokens
    } else {
      const remaining = totalBudget - usedTokens
      if (remaining > 100) {
        const truncated = truncateToTokenBudget(section.content, remaining)
        if (estimateTokens(truncated) > 50) {
          included.push(truncated)
          usedTokens += estimateTokens(truncated)
        }
      }
    }
  }

  return included.join('\n')
}

const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  scene: '场景描写',
  dialogue: '对话风格',
  pacing: '节奏把控',
  formatting: '排版规范',
  style: '文风特征',
  character: '人物塑造',
  custom: '自定义',
  structure: '结构'
}

function buildSkillsSection(skills: WritingSkill[]): string {
  const parts: string[] = ['\n## 写作技能库\n以下是已掌握的写作技能，撰写内容时请参考：']

  const grouped = new Map<SkillCategory, WritingSkill[]>()
  for (const skill of skills) {
    const list = grouped.get(skill.category) || []
    list.push(skill)
    grouped.set(skill.category, list)
  }

  for (const [category, categorySkills] of grouped) {
    const label = SKILL_CATEGORY_LABELS[category] || category
    parts.push(`\n### ${label}`)
    for (const skill of categorySkills) {
      parts.push(`\n**${skill.name}**${skill.source ? `（${skill.source}）` : ''}\n${skill.content}`)
    }
  }

  return parts.join('\n')
}

export { detectPlanMode }
