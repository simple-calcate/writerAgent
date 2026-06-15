import type { Project, Volume, Chapter, Outline } from '../../../shared/types'
import { truncateToTokenBudget } from '../token-counter'

export function buildBookContext(project: Project, volumes: Volume[], chapters: Chapter[]): string {
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

  const summaries = chapters.filter(c => c.summaryResult).map(c => `【${c.title}】${c.summaryResult}`)
  if (summaries.length > 0) {
    parts.push(`\n已有章节摘要：\n${summaries.join('\n')}`)
  }

  return parts.join('\n')
}

export function buildVolumeContext(project: Project, volume: Volume, allChapters: Chapter[]): string {
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

export function buildChapterContext(project: Project, volume: Volume | null | undefined, chapter: Chapter, allChapters: Chapter[], outlines: Outline[], maxTokens?: number): string {
  const parts: string[] = ['\n## 当前章节信息']
  parts.push(`书名：${project.name}`)
  if (volume) parts.push(`卷名：${volume.name}`)
  parts.push(`章节：${chapter.title}`)

  if (chapter.summaryResult) {
    parts.push(`\n章节摘要：${chapter.summaryResult}`)
  }

  if (chapter.content) {
    const contentBudget = maxTokens ? Math.floor(maxTokens * 0.6) : undefined
    const content = contentBudget
      ? truncateToTokenBudget(chapter.content, contentBudget)
      : chapter.content.length > 8000
        ? chapter.content.substring(0, 4000) + '\n\n[...内容已截断...]\n\n' + chapter.content.substring(chapter.content.length - 2000)
        : chapter.content
    parts.push(`\n章节内容：\n${content}`)
  }

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

  const chapterOutline = outlines.find(o => o.chapterId === chapter.id)
  if (chapterOutline) {
    const outlineBudget = maxTokens ? Math.floor(maxTokens * 0.15) : 2000
    const outlineContent = truncateToTokenBudget(chapterOutline.content, outlineBudget)
    parts.push(`\n当前章纲：\n${outlineContent}`)
  }

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

export function getToolScopeChapters(
  level: 'book' | 'volume' | 'chapter',
  currentChapter: Chapter | null | undefined,
  allVolumes: Volume[],
  allChapters: Chapter[]
): Chapter[] {
  if (level === 'chapter') {
    return currentChapter ? [currentChapter] : []
  }
  if (level === 'volume') {
    return allChapters
  }
  return allChapters
}

export function buildOutlineContext(outlines: Outline[], maxTokens?: number): string {
  const parts: string[] = ['\n## 已有大纲']
  const budgetPerOutline = maxTokens ? Math.floor(maxTokens / outlines.length) : 2000

  for (const outline of outlines) {
    const label = outline.level === 'book' ? '书籍大纲' : outline.level === 'volume' ? '卷纲' : '章纲'
    const content = truncateToTokenBudget(outline.content, budgetPerOutline)
    parts.push(`\n### ${label}\n${content}`)
  }
  return parts.join('\n')
}
