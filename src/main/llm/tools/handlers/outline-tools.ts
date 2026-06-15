import type { Chapter } from '../../../../shared/types'
import { getOutline, saveOutline } from '../../../store/db'
import { randomUUID } from 'crypto'

export interface OutlineToolParams {
  projectId: string
}

export async function handleOutlineTools(
  toolName: string,
  args: Record<string, string>,
  params: OutlineToolParams,
  targetChapter: Chapter | undefined | null,
  reasoningResults: string
): Promise<string | null> {
  const { projectId } = params

  switch (toolName) {
    case 'write_outline': {
      if (!args.content) return '错误：未提供大纲内容'

      if (reasoningResults) {
        return `推理分析已完成，请根据以下分析结果重新撰写书籍大纲，然后再次调用 write_outline：\n\n${reasoningResults}\n\n请基于以上分析，重新生成更完善的大纲。`
      }

      const existing = getOutline('book', projectId)
      const outline = {
        id: existing?.id || randomUUID(),
        projectId,
        volumeId: null,
        chapterId: null,
        level: 'book' as const,
        content: args.content,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      saveOutline(outline)
      const outlinePreview = args.content.length > 300 ? args.content.substring(0, 300) + '...' : args.content
      return `已更新书籍大纲（${args.content.length} 字）\n\n${outlinePreview}`
    }

    case 'write_volume_outline': {
      if (!args.volumeId) return '错误：未提供卷 ID'
      if (!args.content) return '错误：未提供卷纲内容'

      if (reasoningResults) {
        return `推理分析已完成，请根据以下分析结果重新撰写卷纲，然后再次调用 write_volume_outline：\n\n${reasoningResults}\n\n请基于以上分析，重新生成更完善的卷纲。`
      }

      const existingVol = getOutline('volume', args.volumeId)
      const volOutline = {
        id: existingVol?.id || randomUUID(),
        projectId,
        volumeId: args.volumeId,
        chapterId: null,
        level: 'volume' as const,
        content: args.content,
        createdAt: existingVol?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      saveOutline(volOutline)
      const volPreview = args.content.length > 300 ? args.content.substring(0, 300) + '...' : args.content
      return `已更新卷纲（${args.content.length} 字）\n\n${volPreview}`
    }

    case 'write_chapter_outline': {
      if (!args.chapterId) return '错误：未提供章节 ID'
      if (!args.content) return '错误：未提供章纲内容'

      if (reasoningResults) {
        return `推理分析已完成，请根据以下分析结果重新撰写章纲，然后再次调用 write_chapter_outline：\n\n${reasoningResults}\n\n请基于以上分析，重新生成更完善的章纲。`
      }

      const existingCh = getOutline('chapter', args.chapterId)
      const chOutline = {
        id: existingCh?.id || randomUUID(),
        projectId,
        volumeId: null,
        chapterId: args.chapterId,
        level: 'chapter' as const,
        content: args.content,
        createdAt: existingCh?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      saveOutline(chOutline)
      const chPreview = args.content.length > 300 ? args.content.substring(0, 300) + '...' : args.content
      return `已更新章纲（${args.content.length} 字）\n\n${chPreview}`
    }

    default:
      return null
  }
}
