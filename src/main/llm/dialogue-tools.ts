import type OpenAI from 'openai'
import type { LLMConfig, BookAIConfig, Chapter } from '../../shared/types'
import { summarizeChapter } from './client'
import { polishText } from './client'
import { refineSummary } from './refine-summary'

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  summarize_chapter: '章节摘要',
  refine_summary: '精炼总结',
  polish_text: '文本润色'
}

export function getDialogueTools(): OpenAI.ChatCompletionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'summarize_chapter',
        description: '对指定章节进行结构化摘要，按人物、事件、伏笔、场景、情感五个维度分析',
        parameters: {
          type: 'object',
          properties: {
            chapterId: {
              type: 'string',
              description: '章节 ID'
            }
          },
          required: ['chapterId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'refine_summary',
        description: '用一段话精炼概括指定章节的核心情节，适合快速了解章节内容',
        parameters: {
          type: 'object',
          properties: {
            chapterId: {
              type: 'string',
              description: '章节 ID'
            }
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
            chapterId: {
              type: 'string',
              description: '章节 ID（用于获取上下文风格）'
            },
            text: {
              type: 'string',
              description: '需要润色的文本片段'
            }
          },
          required: ['chapterId', 'text']
        }
      }
    }
  ]
}

interface ExecuteToolParams {
  config: LLMConfig
  chapter: Chapter | null
  allChapters: Chapter[]
  aiConfig?: Partial<BookAIConfig>
}

export async function executeTool(
  toolName: string,
  args: Record<string, string>,
  params: ExecuteToolParams
): Promise<string> {
  const { config, chapter: currentChapter, allChapters, aiConfig } = params

  // Find target chapter
  const targetChapter = args.chapterId
    ? allChapters.find(c => c.id === args.chapterId)
    : currentChapter

  if (!targetChapter && toolName !== 'polish_text') {
    return `错误：找不到章节 ${args.chapterId || '（未指定）'}`
  }

  switch (toolName) {
    case 'summarize_chapter': {
      if (!targetChapter) return '错误：找不到指定章节'
      return await summarizeChapter(config, targetChapter.content, aiConfig)
    }

    case 'refine_summary': {
      if (!targetChapter) return '错误：找不到指定章节'
      return await refineSummary(config, targetChapter.content, aiConfig)
    }

    case 'polish_text': {
      if (!targetChapter) return '错误：找不到指定章节'
      if (!args.text) return '错误：未提供需要润色的文本'
      // Use chapter content as context for style consistency
      const context = targetChapter.content.substring(0, 500)
      const result = await polishText(config, args.text, context)
      return `润色结果：${result.polished}\n\n改动理由：${result.reason}`
    }

    default:
      return `错误：未知工具 ${toolName}`
  }
}
