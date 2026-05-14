import type { Project, Volume, Chapter, BookAIConfig, DialogueLevel } from '../../shared/types'
import { formatKnowledgeForPrompt } from '../../shared/novel-knowledge'

interface PromptParams {
  level: DialogueLevel
  project: Project
  volume?: Volume | null
  chapter?: Chapter | null
  allVolumes?: Volume[]
  allChapters?: Chapter[]
}

const ROLE_PREAMBLES: Record<DialogueLevel, string> = {
  book: `你是一位资深网文创作策略师和编辑顾问。你的职责是帮助作者进行书籍层面的创作规划。

你的工作方式：
- 主动提问，了解作者的创作意图、目标读者、想要表达的核心主题
- 针对每个问题提出 2-3 个不同的方向供作者选择和探索
- 引用类型惯例和成功案例来支撑你的建议
- 帮助作者梳理世界观设定、角色体系、整体故事架构
- 不要直接帮作者写正文，除非作者明确要求
- 用中文交流，语气亲切专业`,

  volume: `你是一位故事弧线规划师，擅长把握网文的节奏和结构。你的职责是帮助作者规划当前卷的内容。

你的工作方式：
- 帮助作者梳理这一卷的主线和支线
- 分析章节间的节奏起伏，识别可能的节奏问题
- 提出伏笔埋设和回收的建议
- 帮助规划每章的核心事件和转折点
- 关注卷与卷之间的衔接和承上启下
- 不要直接帮作者写正文，除非作者明确要求
- 用中文交流，语气亲切专业`,

  chapter: `你是一位场景写作伙伴，专注于章节级别的创作执行。你的职责是帮助作者打磨当前章节。

你的工作方式：
- 分析场景的节奏、氛围、情感张力
- 提供角色对话和行为的改进建议
- 讨论描写技巧：感官细节、画面感、情绪渲染
- 帮助作者找到更精准的用词和句式
- 关注章节开头的吸引力和结尾的钩子
- 可以直接展示修改示例，但要说明改动理由
- 用中文交流，语气亲切专业`
}

export function buildDialogueSystemPrompt(params: PromptParams): string {
  const { level, project, volume, chapter, allVolumes, allChapters } = params
  const parts: string[] = []

  // 1. Role preamble
  parts.push(ROLE_PREAMBLES[level])

  // 2. Genre knowledge
  if (project.genre) {
    const knowledge = formatKnowledgeForPrompt(project.genre)
    if (knowledge) {
      parts.push(`\n## 类型知识库\n${knowledge}`)
    }
  }

  // 3. AI config
  const aiConfig = resolveConfig(project, volume)
  if (aiConfig.customPrompt) {
    parts.push(`\n## 作者补充要求\n${aiConfig.customPrompt}`)
  }

  // 4. Level-specific context
  if (level === 'book') {
    parts.push(buildBookContext(project, allVolumes || [], allChapters || []))
  } else if (level === 'volume' && volume) {
    parts.push(buildVolumeContext(project, volume, allChapters || []))
  } else if (level === 'chapter' && chapter) {
    parts.push(buildChapterContext(project, volume, chapter, allChapters || []))
  }

  // 5. Tool usage instructions
  const toolChapters = getToolScopeChapters(level, chapter, allVolumes || [], allChapters || [])
  if (toolChapters.length > 0) {
    parts.push(buildToolInstructions(toolChapters, level, chapter))
  }

  // 6. Behavioral guidelines
  parts.push(`\n## 行为准则
- 你的目标是通过启发式对话帮助作者思考，而不是直接给出答案
- 每次回复后，可以提出 1-2 个引导性问题帮助作者深入思考
- 如果作者的想法有明显的类型惯例冲突，友善地指出并提供建议
- 尊重作者的创作自由，提供建议而非指令
- 回复简洁有力，避免冗长的理论阐述
- 当用户要求总结、摘要、润色章节内容时，主动调用工具而不是自己编造结果`)

  return parts.join('\n')
}

function resolveConfig(project: Project, volume?: Volume | null): BookAIConfig {
  const base = project.aiConfig
  if (!volume?.aiConfig || Object.keys(volume.aiConfig).length === 0) return base
  return { ...base, ...volume.aiConfig }
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

function buildChapterContext(project: Project, volume: Volume | null | undefined, chapter: Chapter, allChapters: Chapter[]): string {
  const parts: string[] = ['\n## 当前章节信息']
  parts.push(`书名：${project.name}`)
  if (volume) parts.push(`卷名：${volume.name}`)
  parts.push(`章节：${chapter.title}`)

  if (chapter.summaryResult) {
    parts.push(`\n章节摘要：${chapter.summaryResult}`)
  }

  // Chapter content (truncated if too long)
  if (chapter.content) {
    const content = chapter.content.length > 8000
      ? chapter.content.substring(0, 4000) + '\n\n[...内容已截断...]\n\n' + chapter.content.substring(chapter.content.length - 2000)
      : chapter.content
    parts.push(`\n章节内容：\n${content}`)
  }

  // Adjacent chapter summaries
  const sameVolume = allChapters
    .filter(c => c.volumeId === chapter.volumeId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
  const idx = sameVolume.findIndex(c => c.id === chapter.id)
  const adjacent: string[] = []
  if (idx > 0 && sameVolume[idx - 1].summaryResult) {
    adjacent.push(`【上一章 ${sameVolume[idx - 1].title}】${sameVolume[idx - 1].summaryResult}`)
  }
  if (idx < sameVolume.length - 1 && sameVolume[idx + 1].summaryResult) {
    adjacent.push(`【下一章 ${sameVolume[idx + 1].title}】${sameVolume[idx + 1].summaryResult}`)
  }
  if (adjacent.length > 0) {
    parts.push(`\n相邻章节摘要：\n${adjacent.join('\n')}`)
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

function buildToolInstructions(chapters: Chapter[], level: DialogueLevel, currentChapter: Chapter | null | undefined): string {
  const parts: string[] = ['\n## 可用工具']

  parts.push('你可以调用以下工具来帮助用户：')
  parts.push('- **summarize_chapter**(chapterId) — 对章节进行结构化摘要（人物/事件/伏笔/场景/情感）')
  parts.push('- **refine_summary**(chapterId) — 用一段话精炼概括章节核心情节')
  parts.push('- **polish_text**(chapterId, text) — 润色指定文本片段')

  parts.push('\n可操作的章节列表：')
  for (const ch of chapters) {
    const summary = ch.summaryResult ? ` — ${ch.summaryResult.substring(0, 60)}...` : ''
    const isCurrent = ch.id === currentChapter?.id ? ' （当前章节）' : ''
    parts.push(`- [${ch.id}] ${ch.title}${isCurrent}${summary}`)
  }

  if (level === 'chapter' && currentChapter) {
    parts.push(`\n当用户未指定章节时，默认操作当前章节（ID: ${currentChapter.id}）。`)
  }

  return parts.join('\n')
}
