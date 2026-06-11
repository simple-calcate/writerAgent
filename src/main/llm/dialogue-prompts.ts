import type { Project, Volume, Chapter, BookAIConfig, DialogueLevel, Outline, WritingSkill, SkillCategory, SKILL_CATEGORIES, ContextConfig } from '../../shared/types'
import { formatKnowledgeForPrompt } from '../../shared/novel-knowledge'
import { getFeatureSkillContent } from './feature-skills'
import { estimateTokens, createBudget, allocateSectionBudgets, truncateToTokenBudget } from './token-counter'

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
  reasoningContext?: string  // 推理链输出的分析结果
  contextWindow?: number     // 模型上下文窗口大小
  contextConfig?: ContextConfig  // 上下文管理配置
}

const ROLE_PREAMBLES: Record<DialogueLevel, string> = {
  book: `你是一位资深网文创作策略师和编辑顾问。你的职责是帮助作者进行书籍层面的创作规划和内容创作。

你的工作方式：
- 主动提问，了解作者的创作意图、目标读者、想要表达的核心主题
- 针对每个问题提出 2-3 个不同的方向供作者选择和探索
- 引用类型惯例和成功案例来支撑你的建议
- 帮助作者梳理世界观设定、角色体系、整体故事架构
- 讨论剧情时，默认从整本书的角度出发，思考下一卷的方向和整体节奏
- 当用户确认方案后，可以使用工具自动创建章节、撰写大纲和内容
- 用中文交流，语气亲切专业`,

  volume: `你是一位故事弧线规划师，擅长把握网文的节奏和结构。你的职责是帮助作者规划当前卷的内容并撰写章节。

你的工作方式：
- 帮助作者梳理这一卷的主线和支线
- 分析章节间的节奏起伏，识别可能的节奏问题
- 提出伏笔埋设和回收的建议
- 帮助规划每章的核心事件和转折点
- 讨论剧情时，默认思考当前卷下一章的发展方向，以及卷内整体节奏
- 关注卷与卷之间的衔接和承上启下
- 当用户确认方案后，可以使用工具自动创建章节、撰写章纲和正文内容
- 用中文交流，语气亲切专业`,

  chapter: `你是一位场景写作伙伴，专注于章节级别的创作执行和内容撰写。你的职责是帮助作者打磨当前章节、推演后续发展、并根据大纲撰写内容。

你的工作方式：
- 分析场景的节奏、氛围、情感张力
- 提供角色对话和行为的改进建议
- 讨论描写技巧：感官细节、画面感、情绪渲染
- 帮助作者找到更精准的用词和句式
- 关注章节开头的吸引力和结尾的钩子
- 讨论剧情时，默认推演下一章节可能的情节发展方向，除非用户明确要求讨论当前章节内部的修改
- 如果需要查看章节内容来给出建议，使用 read_chapter_content 工具（会请求用户同意）
- 可以根据大纲或作者的想法，使用 write_chapter_content 工具为章节撰写完整正文
- 当用户确认方案后，可以使用工具自动创建章节、撰写章纲和正文内容
- 可以直接展示修改示例，但要说明改动理由
- 用中文交流，语气亲切专业`
}

export function buildDialogueSystemPrompt(params: PromptParams): string {
  const { level, project, volume, chapter, allVolumes, allChapters, outlines, isPlanMode } = params

  // 创建 token 预算
  const budget = createBudget(params.contextWindow, params.contextConfig)
  const sectionBudgets = allocateSectionBudgets(budget, params.contextConfig)

  // 构建各区块（按优先级排列）
  interface Section {
    content: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    budgetName: string
  }

  const sections: Section[] = []

  // 1. Role preamble (固定，不裁剪)
  sections.push({ content: ROLE_PREAMBLES[level], priority: 'critical', budgetName: 'other' })

  // 2. Genre knowledge
  if (project.genre) {
    const knowledge = formatKnowledgeForPrompt(project.genre)
    if (knowledge) {
      sections.push({ content: `\n## 类型知识库\n${knowledge}`, priority: 'high', budgetName: 'other' })
    }
  }

  // 3. AI config
  const aiConfig = resolveConfig(project)
  if (aiConfig.customPrompt) {
    sections.push({ content: `\n## 作者补充要求\n${aiConfig.customPrompt}`, priority: 'medium', budgetName: 'other' })
  }

  // 3.5 Writing skills
  if (params.skills && params.skills.length > 0) {
    const skillsContent = buildSkillsSection(params.skills)
    sections.push({ content: skillsContent, priority: 'medium', budgetName: 'skills' })
  }

  // 4. Level-specific context (章节内容是最关键的)
  if (level === 'book') {
    sections.push({ content: buildBookContext(project, allVolumes || [], allChapters || []), priority: 'high', budgetName: 'chapter' })
  } else if (level === 'volume' && volume) {
    sections.push({ content: buildVolumeContext(project, volume, allChapters || []), priority: 'high', budgetName: 'chapter' })
  } else if (level === 'chapter' && chapter) {
    const chapterBudget = sectionBudgets.chapter.maxTokens
    sections.push({ content: buildChapterContext(project, volume, chapter, allChapters || [], outlines || [], chapterBudget), priority: 'critical', budgetName: 'chapter' })
  }

  // 5. Outline content
  if (outlines && outlines.length > 0) {
    const outlineBudget = sectionBudgets.outlines.maxTokens
    sections.push({ content: buildOutlineContext(outlines, outlineBudget), priority: 'high', budgetName: 'outlines' })
  }

  // 6. Tool usage instructions
  const toolChapters = getToolScopeChapters(level, chapter, allVolumes || [], allChapters || [])
  sections.push({ content: buildToolInstructions(toolChapters, level, chapter, allVolumes || []), priority: 'medium', budgetName: 'tools' })

  // 7. Plan mode
  if (isPlanMode) {
    sections.push({ content: PLAN_MODE_PROMPT, priority: 'high', budgetName: 'other' })
  }

  // 7.5 Reasoning context
  if (params.reasoningContext) {
    sections.push({ content: params.reasoningContext, priority: 'medium', budgetName: 'reasoning' })
  }

  // 8. Behavioral guidelines (固定，不裁剪)
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

  // 按优先级组装，超出预算时裁剪低优先级区块
  return assembleWithBudget(sections, budget.available)
}

function resolveConfig(project: Project): BookAIConfig {
  return project.aiConfig
}

// 按优先级组装区块，超出预算时裁剪低优先级区块
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
      // 关键区块必须包含，即使超预算
      included.push(section.content)
      usedTokens += sectionTokens
    } else {
      // 尝试裁剪后包含
      const remaining = totalBudget - usedTokens
      if (remaining > 100) {  // 至少 100 token 才值得包含
        const truncated = truncateToTokenBudget(section.content, remaining)
        if (estimateTokens(truncated) > 50) {  // 裁剪后至少 50 token 才有意义
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
  custom: '自定义'
}

function buildSkillsSection(skills: WritingSkill[]): string {
  const parts: string[] = ['\n## 写作技能库\n以下是已掌握的写作技能，撰写内容时请参考：']

  // Group by category
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

function buildBookContext(project: Project, volumes: Volume[], chapters: Chapter[]): string {
  const parts: string[] = ['\n## 当前书籍信息']
  parts.push(`书名：${project.name}`)
  if (project.genre) parts.push(`类型：${project.genre}`)

  if (volumes.length > 0) {
    parts.push(`\n卷目录（共 ${volumes.length} 卷）：`)
    for (const vol of volumes) {
      const volChapters = chapters.filter(c => c.volumeId === vol.id)
      parts.push(`- ${vol.name}（${volChapters.length} 章）`)
    }
  }

  const unassigned = chapters.filter(c => !c.volumeId)
  if (unassigned.length > 0) {
    parts.push(`- 未分卷章节：${unassigned.length} 章`)
  }

  parts.push(`\n总计 ${chapters.length} 章`)

  // Include summaries if available
  const summaries = chapters.filter(c => c.summaryResult).map(c => `【${c.title}】${c.summaryResult}`)
  if (summaries.length > 0) {
    parts.push(`\n已有章节摘要：\n${summaries.join('\n')}`)
  }

  return parts.join('\n')
}

function buildVolumeContext(project: Project, volume: Volume, allChapters: Chapter[]): string {
  const parts: string[] = ['\n## 当前卷信息']
  parts.push(`书名：${project.name}`)
  parts.push(`卷名：${volume.name}`)

  const volChapters = allChapters.filter(c => c.volumeId === volume.id)
  if (volChapters.length > 0) {
    parts.push(`\n章节列表（共 ${volChapters.length} 章）：`)
    for (const ch of volChapters) {
      const summary = ch.summaryResult ? ` — ${ch.summaryResult.substring(0, 100)}` : ''
      parts.push(`- ${ch.title}${summary}`)
    }
  }

  return parts.join('\n')
}

function buildChapterContext(project: Project, volume: Volume | null | undefined, chapter: Chapter, allChapters: Chapter[], outlines: Outline[], maxTokens?: number): string {
  const parts: string[] = ['\n## 当前章节信息']
  parts.push(`书名：${project.name}`)
  if (volume) parts.push(`卷名：${volume.name}`)
  parts.push(`章节：${chapter.title}`)

  if (chapter.summaryResult) {
    parts.push(`\n章节摘要：${chapter.summaryResult}`)
  }

  // Chapter content (truncated based on budget)
  if (chapter.content) {
    const contentBudget = maxTokens ? Math.floor(maxTokens * 0.6) : undefined
    const content = contentBudget
      ? truncateToTokenBudget(chapter.content, contentBudget)
      : chapter.content.length > 8000
        ? chapter.content.substring(0, 4000) + '\n\n[...内容已截断...]\n\n' + chapter.content.substring(chapter.content.length - 2000)
        : chapter.content
    parts.push(`\n章节内容：\n${content}`)
  }

  // Adjacent chapter summaries + previous chapter ending
  const sameVolume = allChapters
    .filter(c => c.volumeId === chapter.volumeId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
  const idx = sameVolume.findIndex(c => c.id === chapter.id)
  const adjacent: string[] = []
  if (idx > 0) {
    const prev = sameVolume[idx - 1]
    if (prev.summaryResult) {
      adjacent.push(`【上一章 ${prev.title}】${prev.summaryResult}`)
    }
    // Include previous chapter's ending content for continuity
    if (prev.content) {
      const ending = prev.content.length > 1500
        ? prev.content.substring(prev.content.length - 1500)
        : prev.content
      parts.push(`\n上一章末尾内容（用于衔接）：\n${ending}`)
    }
  }
  if (idx < sameVolume.length - 1 && sameVolume[idx + 1].summaryResult) {
    adjacent.push(`【下一章 ${sameVolume[idx + 1].title}】${sameVolume[idx + 1].summaryResult}`)
  }
  if (adjacent.length > 0) {
    parts.push(`\n相邻章节摘要：\n${adjacent.join('\n')}`)
  }

  // Current chapter outline
  const chapterOutline = outlines.find(o => o.chapterId === chapter.id)
  if (chapterOutline) {
    const outlineBudget = maxTokens ? Math.floor(maxTokens * 0.15) : 2000
    const outlineContent = truncateToTokenBudget(chapterOutline.content, outlineBudget)
    parts.push(`\n当前章纲：\n${outlineContent}`)
  }

  // Volume outline
  if (volume) {
    const volumeOutline = outlines.find(o => o.volumeId === volume.id)
    if (volumeOutline) {
      const volBudget = maxTokens ? Math.floor(maxTokens * 0.25) : 3000
      const volContent = truncateToTokenBudget(volumeOutline.content, volBudget)
      parts.push(`\n卷纲：\n${volContent}`)
    }
  }

  return parts.join('\n')
}

function getToolScopeChapters(
  level: DialogueLevel,
  currentChapter: Chapter | null | undefined,
  allVolumes: Volume[],
  allChapters: Chapter[]
): Chapter[] {
  if (level === 'chapter') {
    return currentChapter ? [currentChapter] : []
  }
  if (level === 'volume') {
    // Volume-level already filtered in context, return all chapters
    return allChapters
  }
  // book level: all chapters
  return allChapters
}

function buildOutlineContext(outlines: Outline[], maxTokens?: number): string {
  const parts: string[] = ['\n## 已有大纲']
  const budgetPerOutline = maxTokens ? Math.floor(maxTokens / outlines.length) : 2000

  for (const outline of outlines) {
    const label = outline.level === 'book' ? '书籍大纲' : outline.level === 'volume' ? '卷纲' : '章纲'
    const content = truncateToTokenBudget(outline.content, budgetPerOutline)
    parts.push(`\n### ${label}\n${content}`)
  }
  return parts.join('\n')
}

const PLAN_MODE_PROMPT = `\n## 计划模式（规划 → 确认 → 自动执行）

你正在为用户进行剧情规划。这是一个三阶段工作流：

### 阶段一：规划
根据当前层级（书籍/卷/章节）分析已有内容，提出结构化方案。

**必须提供至少两个方案：**

**方案 A — 情节推演路线**
基于当前故事已有的伏笔、人物动机、因果逻辑，推演接下来最可能发生的情节走向。
- 引用前文的伏笔和线索
- 保持内在逻辑一致性
- 适合稳扎稳打的叙事

**方案 B — 创意突破路线**
结合类型知识库中的节奏公式、爆点技巧、读者心理，提出更有创意、更抓人的情节走向。
- 参考同类型成功作品的爆点设计
- 打破读者预期，制造惊喜
- 注重节奏感和商业吸引力

每个方案应包含：
1. 核心事件概述（2-3句话）
2. 涉及的主要人物
3. 对后续剧情的影响
4. 节奏分析（高潮/过渡/铺垫）

### 阶段二：确认
提出方案后，**必须主动询问用户**："以上是初步方案，是否满意？需要调整哪些部分？"
- 根据用户反馈修改方案
- 可以多轮修改，直到用户明确表示确认
- 用户说"可以"、"确认"、"就这样"等表示同意

### 阶段三：自动执行
用户确认后，**立即开始执行**，按以下顺序调用工具：
1. **create_volume** — 如果当前没有卷，先创建卷（需要用户确认）
2. **create_chapter** — 创建章节，必须指定 volumeId（需要用户确认）
3. **write_chapter_outline** — 撰写章纲（需要用户确认）
4. **write_chapter_content** — 撰写正文内容（需要用户确认）

**重要**：创建章节前必须先有卷。如果当前项目没有卷，必须先调用 create_volume 创建卷，拿到卷 ID 后再创建章节。

执行规则（严格遵守）：
- 每个工具调用都会请求用户确认，这是正常流程，不要因此中断
- 完成一步后**必须立即调用下一个工具**，不要停下来等待用户指示或总结
- **绝对不要中途停止**：必须执行完计划中的所有章节的所有步骤才算完成
- 每步完成后用一句话报告进度（如"第2章章纲已写入，接下来写第3章章纲..."），然后立刻调用下一个工具
- 如果用户拒绝某个步骤，跳过该步骤继续下一步
- 如果计划包含多个章节，按顺序逐章执行：先完成第1章的全部步骤（创建→章纲→内容），再开始第2章
- 只有当所有章节的所有步骤都执行完毕后，才输出最终总结

**层级对应：**
- 书籍级对话：规划下一卷的方向和全书节奏，执行时创建卷和章节
- 卷级对话：规划下一章的发展和卷内节奏，执行时创建章节并撰写内容
- 章节级对话：推演下一章节的情节走向，执行时创建章节并撰写内容`

function buildToolInstructions(chapters: Chapter[], level: DialogueLevel, currentChapter: Chapter | null | undefined, allVolumes: Volume[]): string {
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

  // Inject skill content for outline and chapter writing
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

// Plan mode trigger keywords
const PLAN_TRIGGERS = ['规划', '计划', '大纲', '接下来怎么写', '剧情走向', '后续发展', '/plan']

export function detectPlanMode(userMessage: string): boolean {
  return PLAN_TRIGGERS.some(keyword => userMessage.includes(keyword))
}
