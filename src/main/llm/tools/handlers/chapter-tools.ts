import type { Chapter, Volume, BookAIConfig, LLMConfigSingle } from '../../../../shared/types'
import { summarizeChapter } from '../../client-summary'
import { polishText } from '../../client-polish'
import { refineSummary } from '../../refine-summary'
import { updateChapter, saveVersion, updateChapterSummary } from '../../../store/db'
import { TRUNCATE } from '../../constants'

export interface ChapterToolParams {
  config: LLMConfigSingle
  projectId: string
  allChapters: Chapter[]
  aiConfig?: Partial<BookAIConfig>
  refreshCache?: boolean
}

export async function handleChapterTools(
  toolName: string,
  args: Record<string, string>,
  params: ChapterToolParams,
  targetChapter: Chapter | undefined | null,
  reasoningResults: string
): Promise<string | null> {
  const { config, allChapters, aiConfig, refreshCache } = params

  switch (toolName) {
    case 'summarize_chapter': {
      if (!targetChapter) return '错误：找不到指定章节'
      if (!refreshCache && targetChapter.summaryResult) {
        return targetChapter.summaryResult
      }
      return await summarizeChapter(config, targetChapter.content, aiConfig)
    }

    case 'refine_summary': {
      if (!targetChapter) return '错误：找不到指定章节'
      return await refineSummary(config, targetChapter.content, aiConfig)
    }

    case 'polish_text': {
      if (!targetChapter) return '错误：找不到指定章节'
      if (!args.text) return '错误：未提供需要润色的文本'
      const context = targetChapter.content.substring(0, 500)
      const result = await polishText(config, args.text, context)
      return `润色结果：${result.polished}\n\n改动理由：${result.reason}`
    }

    case 'read_chapter_content': {
      if (!args.chapterId) return '错误：未提供章节 ID'
      const target = allChapters.find(c => c.id === args.chapterId)
      if (!target) return '错误：找不到指定章节'
      const content = target.content
      if (!content) return `章节「${target.title}」暂无内容`
      const truncated = content.length > TRUNCATE.CHAPTER
        ? content.substring(0, TRUNCATE.VOLUME) + '\n\n[...内容过长已截断...]\n\n' + content.substring(content.length - TRUNCATE.BOOK)
        : content
      return `章节「${target.title}」的内容：\n\n${truncated}`
    }

    case 'write_chapter_content': {
      if (!args.chapterId) return '错误：未提供章节 ID'
      if (!args.content) return '错误：未提供内容'
      const target = allChapters.find(c => c.id === args.chapterId)
      if (!target) return '错误：找不到指定章节'

      if (reasoningResults) {
        return `推理分析已完成，请根据以下分析结果重新撰写章节内容，然后再次调用 write_chapter_content：\n\n${reasoningResults}\n\n请基于以上分析，重新生成更优质的章节内容。`
      }

      if (target.content) {
        saveVersion(args.chapterId, {
          content: target.content,
          polishingMarks: [],
          timestamp: new Date().toISOString()
        })
      }
      updateChapter(args.chapterId, { content: args.content })
      const contentPreview = args.content.length > 500 ? args.content.substring(0, 500) + '...' : args.content
      return `已为章节「${target.title}」写入内容（${args.content.length} 字）\n\n${contentPreview}`
    }

    case 'batch_refine_summaries': {
      const { volume, allVolumes } = params as any
      const targetVolumeId = args.volumeId || volume?.id
      if (!targetVolumeId) return '错误：未指定卷 ID，且当前没有上下文卷'
      const targetVolume = allVolumes.find((v: Volume) => v.id === targetVolumeId)
      if (!targetVolume) return '错误：找不到指定卷'
      const volChapters = allChapters
        .filter(c => c.volumeId === targetVolumeId)
        .sort((a, b) => a.orderIndex - b.orderIndex)
      if (volChapters.length === 0) return `卷「${targetVolume.name}」下没有章节`

      const results: string[] = []
      for (const ch of volChapters) {
        if (!ch.content) {
          results.push(`- 「${ch.title}」：无内容，跳过`)
          continue
        }
        try {
          const summary = await refineSummary(config, ch.content, aiConfig)
          updateChapterSummary(ch.id, summary)
          results.push(`- 「${ch.title}」：已完成`)
        } catch {
          results.push(`- 「${ch.title}」：精炼失败`)
        }
      }

      return `已对卷「${targetVolume.name}」的 ${volChapters.length} 个章节进行精炼总结：\n\n${results.join('\n')}`
    }

    default:
      return null
  }
}
