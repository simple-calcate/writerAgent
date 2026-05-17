import type OpenAI from 'openai'
import type { LLMConfigSingle, BookAIConfig, Chapter, Volume, DialogueLevel } from '../../shared/types'
import { summarizeChapter } from './client'
import { polishText } from './client'
import { refineSummary } from './refine-summary'
import { createChapter, createVolume, renameChapter, updateChapter, saveOutline, getOutline } from '../store/db'
import { randomUUID } from 'crypto'

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  summarize_chapter: '章节摘要',
  refine_summary: '精炼总结',
  polish_text: '文本润色',
  create_chapter: '创建章节',
  rename_chapter: '重命名章节',
  write_outline: '撰写书籍大纲',
  write_volume_outline: '撰写卷纲',
  write_chapter_outline: '撰写章纲',
  read_chapter_content: '查看章节内容',
  write_chapter_content: '撰写章节内容',
  create_volume: '创建卷'
}

// Tools that always need user approval
const WRITE_TOOLS = new Set(['create_chapter', 'create_volume', 'rename_chapter', 'write_outline', 'write_volume_outline', 'write_chapter_outline', 'read_chapter_content', 'write_chapter_content'])

// Tools that can use cache
const CACHEABLE_TOOLS = new Set(['summarize_chapter', 'refine_summary'])

export function needsApproval(toolName: string): boolean {
  return WRITE_TOOLS.has(toolName)
}

export function isCacheable(toolName: string): boolean {
  return CACHEABLE_TOOLS.has(toolName)
}

export function getToolApprovalDescription(toolName: string, args: Record<string, string>): string {
  switch (toolName) {
    case 'create_chapter':
      return `创建新章节「${args.title || '未命名'}」`
    case 'create_volume':
      return `创建新卷「${args.name || '未命名'}」`
    case 'rename_chapter':
      return `将章节重命名为「${args.newTitle}」`
    case 'write_outline':
      return '更新书籍大纲内容'
    case 'write_volume_outline':
      return '更新卷纲内容'
    case 'write_chapter_outline':
      return '更新章纲内容'
    case 'read_chapter_content':
      return `查看章节「${args.chapterId ? '指定章节' : '当前章节'}」的完整内容`
    case 'write_chapter_content':
      return `为章节撰写内容（约 ${(args.content?.length || 0)} 字）`
    default:
      return `执行 ${toolName}`
  }
}

export function checkCache(toolName: string, args: Record<string, string>, allChapters: Chapter[]): { cached: boolean; result?: string; hint?: string } {
  if (!isCacheable(toolName)) return { cached: false }

  const chapter = allChapters.find(c => c.id === args.chapterId)
  if (!chapter) return { cached: false }

  if (toolName === 'summarize_chapter' && chapter.summaryResult) {
    return {
      cached: true,
      result: chapter.summaryResult,
      hint: `该章节已有结构化摘要，是否使用缓存？`
    }
  }

  if (toolName === 'refine_summary' && chapter.summaryResult) {
    return {
      cached: true,
      result: chapter.summaryResult,
      hint: `该章节已有摘要，是否使用缓存？（精炼总结需要重新生成）`
    }
  }

  return { cached: false }
}

export function getDialogueTools(): OpenAI.ChatCompletionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'summarize_chapter',
        description: '对指定章节进行结构化摘要，按人物、事件、伏笔、场景、情感五个维度分析。如果章节已有缓存摘要，会询问用户是否刷新。',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID' }
          },
          required: ['chapterId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'refine_summary',
        description: '用一段话精炼概括指定章节的核心情节，适合快速了解章节内容。如果章节已有缓存摘要，会询问用户是否使用缓存。',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID' }
          },
          required: ['chapterId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'polish_text',
        description: '润色指定文本片段，改善用词、句式和描写生动度',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID（用于获取上下文风格）' },
            text: { type: 'string', description: '需要润色的文本片段' }
          },
          required: ['chapterId', 'text']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_chapter',
        description: '创建一个新章节。需要用户确认后执行。注意：必须先有卷才能创建章节，如果当前没有卷，请先使用 create_volume 创建卷。',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '章节标题' },
            volumeId: { type: 'string', description: '所属卷 ID（必填，先用 create_volume 创建卷）' }
          },
          required: ['title', 'volumeId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_volume',
        description: '创建一个新卷。当还没有卷时，必须先创建卷再创建章节。',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '卷名称' }
          },
          required: ['name']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'rename_chapter',
        description: '重命名指定章节。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID' },
            newTitle: { type: 'string', description: '新的章节标题' }
          },
          required: ['chapterId', 'newTitle']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_outline',
        description: '撰写或更新书籍大纲（Markdown 格式）。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '大纲内容（Markdown 格式）' }
          },
          required: ['content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_volume_outline',
        description: '撰写或更新指定卷的卷纲（Markdown 格式）。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            volumeId: { type: 'string', description: '卷 ID' },
            content: { type: 'string', description: '卷纲内容（Markdown 格式）' }
          },
          required: ['volumeId', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_chapter_outline',
        description: '撰写或更新指定章节的章纲（Markdown 格式）。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID' },
            content: { type: 'string', description: '章纲内容（Markdown 格式）' }
          },
          required: ['chapterId', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_chapter_content',
        description: '读取指定章节的完整正文内容。需要用户确认后执行。当你需要查看某个章节的具体内容来给出建议时使用。',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID' }
          },
          required: ['chapterId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_chapter_content',
        description: '根据大纲、章纲或作者的想法，为指定章节撰写完整正文内容。始终需要用户确认。如果章节已有内容，会提示用户确认覆盖。撰写前应先了解章节大纲和上下文。',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID' },
            content: { type: 'string', description: '要写入的章节正文内容' }
          },
          required: ['chapterId', 'content']
        }
      }
    }
  ]
}

interface ExecuteToolParams {
  config: LLMConfigSingle
  level: DialogueLevel
  projectId: string
  chapter: Chapter | null
  allChapters: Chapter[]
  allVolumes: Volume[]
  aiConfig?: Partial<BookAIConfig>
  refreshCache?: boolean
}

export async function executeTool(
  toolName: string,
  args: Record<string, string>,
  params: ExecuteToolParams
): Promise<string> {
  const { config, level, projectId, chapter: currentChapter, allChapters, aiConfig, refreshCache } = params

  // Find target chapter
  const targetChapter = args.chapterId
    ? allChapters.find(c => c.id === args.chapterId)
    : currentChapter

  switch (toolName) {
    case 'summarize_chapter': {
      if (!targetChapter) return '错误：找不到指定章节'
      // Use cache if available and not refreshing
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

    case 'create_chapter': {
      if (!args.title) return '错误：未提供章节标题'
      const newChapter = createChapter(projectId, args.title, args.volumeId || null)
      if (!newChapter) return `错误：章节名「${args.title}」在该卷下已存在`
      params.allChapters.push(newChapter)
      return `已创建章节「${newChapter.title}」（ID: ${newChapter.id}）`
    }

    case 'create_volume': {
      if (!args.name) return '错误：未提供卷名称'
      const newVolume = createVolume(projectId, args.name)
      params.allVolumes.push(newVolume)
      return `已创建卷「${newVolume.name}」（ID: ${newVolume.id}）`
    }

    case 'rename_chapter': {
      if (!args.chapterId) return '错误：未提供章节 ID'
      if (!args.newTitle) return '错误：未提供新标题'
      renameChapter(args.chapterId, args.newTitle)
      return `已将章节重命名为「${args.newTitle}」`
    }

    case 'write_outline': {
      if (!args.content) return '错误：未提供大纲内容'
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

    case 'read_chapter_content': {
      if (!args.chapterId) return '错误：未提供章节 ID'
      const target = allChapters.find(c => c.id === args.chapterId)
      if (!target) return '错误：找不到指定章节'
      const content = target.content
      if (!content) return `章节「${target.title}」暂无内容`
      // Truncate if too long
      const truncated = content.length > 10000
        ? content.substring(0, 5000) + '\n\n[...内容过长已截断...]\n\n' + content.substring(content.length - 3000)
        : content
      return `章节「${target.title}」的内容：\n\n${truncated}`
    }

    case 'write_chapter_content': {
      if (!args.chapterId) return '错误：未提供章节 ID'
      if (!args.content) return '错误：未提供内容'
      const target = allChapters.find(c => c.id === args.chapterId)
      if (!target) return '错误：找不到指定章节'
      updateChapter(args.chapterId, { content: args.content })
      const contentPreview = args.content.length > 500 ? args.content.substring(0, 500) + '...' : args.content
      return `已为章节「${target.title}」写入内容（${args.content.length} 字）\n\n${contentPreview}`
    }

    default:
      return `错误：未知工具 ${toolName}`
  }
}
