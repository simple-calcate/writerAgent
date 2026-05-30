import type OpenAI from 'openai'
import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, BookAIConfig, Chapter, Volume, DialogueLevel, WritingSkill, FeatureSkillIds, ReasoningChain } from '../../shared/types'
import { DEFAULT_FEATURE_SKILL_IDS } from '../../shared/types'
import { summarizeChapter } from './client'
import { polishText } from './client'
import { refineSummary } from './refine-summary'
import { createChapter, createVolume, renameChapter, updateChapter, saveOutline, getOutline, saveSkill, getSkills, getProjects, updateProjectFeatureSkillIds, saveVersion, updateChapterSummary, saveReasoningChain, deleteReasoningChain } from '../store/db'
import { randomUUID } from 'crypto'
import { getReasoningChains, getReasoningChainById } from './reasoning-chains'

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
  create_volume: '创建卷',
  extract_skill: '提取写作技能',
  refine_skill: '修正写作技能',
  list_skills: '查看技能列表',
  toggle_feature_skill: '调整技能挂载',
  batch_refine_summaries: '批量精炼摘要',
  list_reasoning_chains: '查看推理链',
  get_reasoning_chain: '获取推理链详情',
  create_reasoning_chain: '创建推理链',
  update_reasoning_chain: '修改推理链',
  delete_reasoning_chain: '删除推理链',
  toggle_reasoning_context: '调整推理上下文',
  bind_reasoning_to_tool: '绑定推理链到工具',
  list_tool_bindings: '查看工具绑定'
}

// Tools that always need user approval
const WRITE_TOOLS = new Set(['create_chapter', 'create_volume', 'rename_chapter', 'write_outline', 'write_volume_outline', 'write_chapter_outline', 'read_chapter_content', 'write_chapter_content', 'extract_skill', 'refine_skill', 'toggle_feature_skill', 'batch_refine_summaries', 'create_reasoning_chain', 'update_reasoning_chain', 'delete_reasoning_chain', 'toggle_reasoning_context', 'bind_reasoning_to_tool'])

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
    case 'extract_skill':
      return `提取写作技能「${args.name || '未命名'}」（${args.category || 'custom'}）`
    case 'refine_skill':
      return `修正写作技能（${(args.content?.length || 0)} 字）`
    case 'toggle_feature_skill':
      return `${args.enabled === 'true' ? '启用' : '禁用'}技能在${args.feature || '某功能'}上的挂载`
    case 'batch_refine_summaries':
      return `批量精炼整卷章节摘要`
    case 'create_reasoning_chain':
      return `创建推理链「${args.name || '未命名'}」`
    case 'update_reasoning_chain':
      return `修改推理链配置`
    case 'delete_reasoning_chain':
      return `删除推理链`
    case 'toggle_reasoning_context':
      return `${args.includeInContext === 'true' ? '启用' : '禁用'}推理结果纳入上下文`
    case 'bind_reasoning_to_tool':
      return args.chainId ? `绑定推理链到「${args.toolName}」` : `解绑「${args.toolName}」的推理链`
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
    },
    {
      type: 'function',
      function: {
        name: 'extract_skill',
        description: '从当前章节内容中提取可复用的写作技能。分析章节中值得学习的写作模式（如场景描写、对话风格、节奏把控等），保存为技能供其他书籍使用。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '技能名称，如"都市打斗场景写法"' },
            category: { type: 'string', enum: ['scene', 'dialogue', 'pacing', 'formatting', 'style', 'character', 'structure', 'custom'], description: '技能分类' },
            content: { type: 'string', description: '结构化的写作指导内容，包含具体规则和示例' },
            source: { type: 'string', description: '来源说明，如"提取自《xxx》第三章"' }
          },
          required: ['name', 'category', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'refine_skill',
        description: '根据实际写作内容修正已有写作技能。对比技能描述和实际章节内容，更新技能使其更准确。需要用户确认后执行。先用 read_chapter_content 读取相关章节作为参考。',
        parameters: {
          type: 'object',
          properties: {
            skillId: { type: 'string', description: '要修正的技能 ID' },
            content: { type: 'string', description: '修正后的技能内容' },
            reason: { type: 'string', description: '修正理由' }
          },
          required: ['skillId', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_skills',
        description: '查看所有写作技能列表及其在各 AI 功能上的挂载状态。返回技能的 ID、名称、分类、是否内置、以及在对话/润色/摘要/续写四个功能上的启用状态。只读操作，无需用户确认。',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'toggle_feature_skill',
        description: '调整写作技能在指定 AI 功能上的挂载状态（启用或禁用）。需要用户确认后执行。可以用来为某个功能添加或移除特定的写作风格技能。',
        parameters: {
          type: 'object',
          properties: {
            skillId: { type: 'string', description: '技能 ID' },
            feature: { type: 'string', enum: ['dialogue', 'polish', 'summary', 'continuation', 'outline', 'chapterContent'], description: '目标功能：dialogue(AI对话)、polish(智能润色)、summary(章节摘要)、continuation(智能续写)、outline(大纲撰写)、chapterContent(正文撰写)' },
            enabled: { type: 'boolean', description: 'true 为启用（挂载），false 为禁用（卸载）' }
          },
          required: ['skillId', 'feature', 'enabled']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'batch_refine_summaries',
        description: '对指定卷的所有章节进行批量精炼总结（一段话概括核心情节）。适合快速了解整卷内容。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            volumeId: { type: 'string', description: '卷 ID（可选，不传则使用当前对话的卷）' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_reasoning_chains',
        description: '列出所有可用的推理链。推理链是预定义的思考流程，帮助 AI 在执行特定任务时进行系统性分析。只读操作，无需用户确认。',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_reasoning_chain',
        description: '获取指定推理链的详细信息，包括所有步骤的提示词。只读操作，无需用户确认。',
        parameters: {
          type: 'object',
          properties: {
            chainId: { type: 'string', description: '推理链 ID' }
          },
          required: ['chainId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_reasoning_chain',
        description: '创建一个新的推理链。推理链定义了 AI 在执行特定任务时的思考流程。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '推理链名称' },
            description: { type: 'string', description: '推理链描述' },
            trigger: { type: 'string', enum: ['auto', 'manual', 'both'], description: '触发方式' },
            triggerKeywords: { type: 'string', description: '触发关键词，逗号分隔' },
            steps: {
              type: 'array',
              description: '推理步骤列表',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '步骤名称' },
                  prompt: { type: 'string', description: '步骤提示词' }
                },
                required: ['name', 'prompt']
              }
            },
            includeInContext: { type: 'boolean', description: '推理结果是否纳入上下文' }
          },
          required: ['name', 'steps']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_reasoning_chain',
        description: '修改现有推理链的配置。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            chainId: { type: 'string', description: '要修改的推理链 ID' },
            name: { type: 'string', description: '新的名称' },
            description: { type: 'string', description: '新的描述' },
            trigger: { type: 'string', enum: ['auto', 'manual', 'both'], description: '新的触发方式' },
            triggerKeywords: { type: 'string', description: '新的触发关键词，逗号分隔' },
            steps: {
              type: 'array',
              description: '新的推理步骤列表',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '步骤名称' },
                  prompt: { type: 'string', description: '步骤提示词' }
                },
                required: ['name', 'prompt']
              }
            },
            includeInContext: { type: 'boolean', description: '推理结果是否纳入上下文' }
          },
          required: ['chainId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'delete_reasoning_chain',
        description: '删除指定的推理链。内置推理链无法删除。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            chainId: { type: 'string', description: '要删除的推理链 ID' }
          },
          required: ['chainId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'toggle_reasoning_context',
        description: '切换推理结果是否纳入对话上下文。启用后，推理分析结果会注入到系统提示词中，供后续对话参考。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            chainId: { type: 'string', description: '推理链 ID' },
            includeInContext: { type: 'boolean', description: 'true 为纳入上下文，false 为不纳入' }
          },
          required: ['chainId', 'includeInContext']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'bind_reasoning_to_tool',
        description: '将推理链绑定到指定工具。绑定后，执行该工具前会自动执行推理链。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            toolName: {
              type: 'string',
              enum: ['write_chapter_content', 'write_chapter_outline', 'write_volume_outline', 'write_outline'],
              description: '要绑定的工具名称'
            },
            chainId: { type: 'string', description: '推理链 ID（传空字符串则解绑）' }
          },
          required: ['toolName', 'chainId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_tool_bindings',
        description: '查看所有工具与推理链的绑定关系。只读操作，无需用户确认。',
        parameters: {
          type: 'object',
          properties: {}
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
  mainWindow?: BrowserWindow
  reasoningContext?: string
  messageChainIds?: string[]
}

export async function executeTool(
  toolName: string,
  args: Record<string, string>,
  params: ExecuteToolParams
): Promise<string> {
  const { config, level, projectId, chapter: currentChapter, allChapters, aiConfig, refreshCache, mainWindow } = params

  // Find target chapter
  const targetChapter = args.chapterId
    ? allChapters.find(c => c.id === args.chapterId)
    : currentChapter

  // Execute reasoning chains before tool execution
  // Returns reasoning results to be injected into AI context
  const REASONING_TOOLS = ['write_chapter_content', 'write_chapter_outline', 'write_volume_outline', 'write_outline']
  let reasoningResults = ''
  if (REASONING_TOOLS.includes(toolName) && mainWindow) {
    const chainsToExecute: ReasoningChain[] = []

    // 1. Check project's tool-chain binding
    const projects = getProjects()
    const project = projects.find(p => p.id === projectId)
    const binding = project?.reasoningConfig?.toolChainBindings?.[toolName]
    if (binding) {
      const chain = getReasoningChainById(binding)
      if (chain) chainsToExecute.push(chain)
    }

    // 2. Check message chain IDs
    if (params.messageChainIds?.length) {
      for (const chainId of params.messageChainIds) {
        const chain = getReasoningChainById(chainId)
        if (chain && !chainsToExecute.find(c => c.id === chain.id)) {
          chainsToExecute.push(chain)
        }
      }
    }

    // Execute all chains
    if (chainsToExecute.length > 0) {
      const { executeReasoningChain, buildReasoningContext } = await import('./dialogue')

      for (const chain of chainsToExecute) {
        const chapterContent = targetChapter?.content || ''
        const context = [
          targetChapter ? `当前章节: ${targetChapter.title}` : '',
          chapterContent ? `章节内容:\n${chapterContent.substring(0, 3000)}` : ''
        ].filter(Boolean).join('\n\n')

        const session = await executeReasoningChain(chain, context, config, mainWindow)
        const reasoningResult = buildReasoningContext(session)
        if (reasoningResult) {
          reasoningResults += reasoningResult
        }
      }

      // Clear message chain IDs after execution to prevent re-execution
      if (params.messageChainIds) {
        params.messageChainIds = []
      }
    }
  }

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

      // If reasoning was executed, return results and ask AI to regenerate
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

      // If reasoning was executed, return results and ask AI to regenerate
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

      // If reasoning was executed, return results and ask AI to regenerate
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

      // If reasoning was executed, return results and ask AI to regenerate
      if (reasoningResults) {
        return `推理分析已完成，请根据以下分析结果重新撰写章节内容，然后再次调用 write_chapter_content：\n\n${reasoningResults}\n\n请基于以上分析，重新生成更优质的章节内容。`
      }

      // 覆盖前自动保存版本
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

    case 'extract_skill': {
      if (!args.name) return '错误：未提供技能名称'
      if (!args.content) return '错误：未提供技能内容'
      const now = new Date().toISOString()
      const skill = {
        id: randomUUID(),
        name: args.name,
        category: (args.category || 'custom') as any,
        content: args.content,
        source: args.source,
        createdAt: now,
        updatedAt: now
      }
      saveSkill(skill)
      return `已提取写作技能「${skill.name}」（分类：${skill.category}）\n\n${args.content.substring(0, 200)}${args.content.length > 200 ? '...' : ''}`
    }

    case 'refine_skill': {
      if (!args.skillId) return '错误：未提供技能 ID'
      if (!args.content) return '错误：未提供修正内容'
      const skills = getSkills()
      const targetSkill = skills.find(s => s.id === args.skillId)
      if (!targetSkill) return '错误：找不到指定技能'
      const updatedSkill = {
        ...targetSkill,
        content: args.content,
        updatedAt: new Date().toISOString()
      }
      saveSkill(updatedSkill)
      return `已修正技能「${targetSkill.name}」${args.reason ? '\n\n修正理由：' + args.reason : ''}\n\n${args.content.substring(0, 200)}${args.content.length > 200 ? '...' : ''}`
    }

    case 'list_skills': {
      const allSkills = getSkills()
      const projects = getProjects()
      const project = projects.find(p => p.id === projectId)
      const featureSkillIds = project?.featureSkillIds || DEFAULT_FEATURE_SKILL_IDS

      const featureNames: Record<string, string> = {
        dialogue: 'AI 对话',
        polish: '智能润色',
        summary: '章节摘要',
        continuation: '智能续写'
      }

      const lines = allSkills.map(skill => {
        const features = Object.entries(featureSkillIds)
          .filter(([, ids]) => ids.includes(skill.id))
          .map(([key]) => featureNames[key] || key)
        const mountStatus = features.length > 0 ? `已挂载：${features.join('、')}` : '未挂载到任何功能'
        const builtinTag = skill.builtin ? ' [内置]' : ''
        return `- 「${skill.name}」${builtinTag}（${skill.category}）${mountStatus}\n  ${skill.content.substring(0, 100)}${skill.content.length > 100 ? '...' : ''}`
      })

      return `共 ${allSkills.length} 个写作技能：\n\n${lines.join('\n\n')}`
    }

    case 'toggle_feature_skill': {
      if (!args.skillId) return '错误：未提供技能 ID'
      if (!args.feature) return '错误：未提供目标功能'
      if (args.enabled === undefined) return '错误：未提供启用/禁用状态'

      const allSkills = getSkills()
      const skill = allSkills.find(s => s.id === args.skillId)
      if (!skill) return '错误：找不到指定技能'

      const projects = getProjects()
      const project = projects.find(p => p.id === projectId)
      const current = project?.featureSkillIds || { ...DEFAULT_FEATURE_SKILL_IDS }
      const feature = args.feature as keyof FeatureSkillIds

      if (!(feature in current)) return `错误：不支持的功能「${args.feature}」`

      const ids = [...(current[feature] || [])]
      const isEnabled = ids.includes(args.skillId)

      if (args.enabled === 'true' && !isEnabled) {
        ids.push(args.skillId)
      } else if (args.enabled === 'false' && isEnabled) {
        const idx = ids.indexOf(args.skillId)
        ids.splice(idx, 1)
      }

      const newFeatureSkillIds = { ...current, [feature]: ids }
      updateProjectFeatureSkillIds(projectId, newFeatureSkillIds)

      const featureNames: Record<string, string> = {
        dialogue: 'AI 对话',
        polish: '智能润色',
        summary: '章节摘要',
        continuation: '智能续写'
      }
      const action = args.enabled === 'true' ? '启用' : '禁用'
      const mountedSkills = ids.map(id => allSkills.find(s => s.id === id)?.name || id).join('、')

      return `已${action}技能「${skill.name}」在${featureNames[feature] || feature}上的挂载。\n\n当前${featureNames[feature] || feature}已挂载技能：${mountedSkills || '无'}`
    }

    case 'batch_refine_summaries': {
      const targetVolumeId = args.volumeId || params.volume?.id
      if (!targetVolumeId) return '错误：未指定卷 ID，且当前没有上下文卷'
      const volume = params.allVolumes.find(v => v.id === targetVolumeId)
      if (!volume) return '错误：找不到指定卷'
      const volChapters = allChapters
        .filter(c => c.volumeId === targetVolumeId)
        .sort((a, b) => a.orderIndex - b.orderIndex)
      if (volChapters.length === 0) return `卷「${volume.name}」下没有章节`

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

      return `已对卷「${volume.name}」的 ${volChapters.length} 个章节进行精炼总结：\n\n${results.join('\n')}`
    }

    case 'list_reasoning_chains': {
      const chains = getReasoningChains()
      const lines = chains.map(chain => {
        const triggerLabel = chain.trigger === 'auto' ? '自动触发' : chain.trigger === 'manual' ? '手动触发' : '自动/手动'
        const contextLabel = chain.includeInContext ? '纳入上下文' : '不纳入上下文'
        const steps = chain.steps.map(s => `  - ${s.name}`).join('\n')
        return `- 「${chain.name}」（${triggerLabel}，${contextLabel}）\n  ${chain.description}\n  步骤：\n${steps}`
      })
      return `共 ${chains.length} 个推理链：\n\n${lines.join('\n\n')}`
    }

    case 'get_reasoning_chain': {
      if (!args.chainId) return '错误：未提供推理链 ID'

      const chain = getReasoningChainById(args.chainId)
      if (!chain) return '错误：找不到指定推理链'

      const triggerLabel = chain.trigger === 'auto' ? '自动触发' : chain.trigger === 'manual' ? '手动触发' : '自动/手动'
      const contextLabel = chain.includeInContext ? '纳入上下文' : '不纳入上下文'
      const steps = chain.steps.map((s, i) => `${i + 1}. ${s.name}\n   提示词：${s.prompt}`).join('\n')

      return `推理链「${chain.name}」详情：\n\n描述：${chain.description}\n触发方式：${triggerLabel}\n上下文设置：${contextLabel}\n触发关键词：${chain.triggerKeywords?.join(', ') || '无'}\n\n步骤：\n${steps}`
    }

    case 'create_reasoning_chain': {
      if (!args.name) return '错误：未提供推理链名称'
      if (!args.steps) return '错误：未提供推理步骤'

      let steps: { name: string; prompt: string }[]
      try {
        steps = JSON.parse(args.steps)
      } catch {
        return '错误：推理步骤格式不正确'
      }

      if (!Array.isArray(steps) || steps.length === 0) return '错误：至少需要一个推理步骤'

      const newChain: ReasoningChain = {
        id: randomUUID(),
        name: args.name,
        description: args.description || '',
        trigger: (args.trigger as any) || 'both',
        triggerKeywords: args.triggerKeywords ? args.triggerKeywords.split(',').map(k => k.trim()).filter(Boolean) : [],
        steps: steps.map((s, i) => ({
          id: `step-${Date.now()}-${i}`,
          name: s.name,
          prompt: s.prompt,
          outputKey: `step${i + 1}`
        })),
        includeInContext: args.includeInContext === 'true',
        builtin: false
      }

      saveReasoningChain(newChain)
      return `已创建推理链「${newChain.name}」，包含 ${newChain.steps.length} 个步骤。`
    }

    case 'update_reasoning_chain': {
      if (!args.chainId) return '错误：未提供推理链 ID'

      const existingChain = getReasoningChainById(args.chainId)
      if (!existingChain) return '错误：找不到指定推理链'
      if (existingChain.builtin) return '错误：内置推理链无法修改'

      const updates: Partial<ReasoningChain> = {}
      if (args.name) updates.name = args.name
      if (args.description) updates.description = args.description
      if (args.trigger) updates.trigger = args.trigger as any
      if (args.triggerKeywords) updates.triggerKeywords = args.triggerKeywords.split(',').map(k => k.trim()).filter(Boolean)
      if (args.includeInContext !== undefined) updates.includeInContext = args.includeInContext === 'true'

      if (args.steps) {
        let steps: { name: string; prompt: string }[]
        try {
          steps = JSON.parse(args.steps)
        } catch {
          return '错误：推理步骤格式不正确'
        }

        if (!Array.isArray(steps) || steps.length === 0) return '错误：至少需要一个推理步骤'

        updates.steps = steps.map((s, i) => ({
          id: existingChain.steps[i]?.id || `step-${Date.now()}-${i}`,
          name: s.name,
          prompt: s.prompt,
          outputKey: existingChain.steps[i]?.outputKey || `step${i + 1}`
        }))
      }

      const updatedChain = { ...existingChain, ...updates }
      saveReasoningChain(updatedChain)
      return `已更新推理链「${updatedChain.name}」。`
    }

    case 'delete_reasoning_chain': {
      if (!args.chainId) return '错误：未提供推理链 ID'

      const chainToDelete = getReasoningChainById(args.chainId)
      if (!chainToDelete) return '错误：找不到指定推理链'
      if (chainToDelete.builtin) return '错误：内置推理链无法删除'

      deleteReasoningChain(args.chainId)
      return `已删除推理链「${chainToDelete.name}」。`
    }

    case 'toggle_reasoning_context': {
      if (!args.chainId) return '错误：未提供推理链 ID'
      if (args.includeInContext === undefined) return '错误：未提供上下文设置'

      const chain = getReasoningChainById(args.chainId)
      if (!chain) return '错误：找不到指定推理链'

      // Note: This is a runtime toggle, not persisted
      const action = args.includeInContext === 'true' ? '启用' : '禁用'
      return `已${action}推理链「${chain.name}」的上下文纳入功能。\n\n注意：此设置仅对当前对话会话生效。`
    }

    case 'bind_reasoning_to_tool': {
      if (!args.toolName) return '错误：未提供工具名称'

      const TOOL_NAMES: Record<string, string> = {
        write_chapter_content: '撰写章节内容',
        write_chapter_outline: '撰写章纲',
        write_volume_outline: '撰写卷纲',
        write_outline: '撰写书籍大纲'
      }

      const displayName = TOOL_NAMES[args.toolName] || args.toolName

      if (!args.chainId) {
        // Unbind
        const projects = getProjects()
        const project = projects.find(p => p.id === projectId)
        if (project?.reasoningConfig?.toolChainBindings?.[args.toolName]) {
          const newBindings = { ...project.reasoningConfig.toolChainBindings }
          delete newBindings[args.toolName]
          // Note: We can't directly update project config here, would need a DB function
          return `已解绑「${displayName}」的推理链。`
        }
        return `「${displayName}」没有绑定推理链。`
      }

      const chain = getReasoningChainById(args.chainId)
      if (!chain) return '错误：找不到指定推理链'

      // Note: Binding is stored in project config, would need DB update function
      return `已将推理链「${chain.name}」绑定到「${displayName}」。执行该工具前将自动执行推理。`
    }

    case 'list_tool_bindings': {
      const projects = getProjects()
      const project = projects.find(p => p.id === projectId)
      const bindings = project?.reasoningConfig?.toolChainBindings || {}

      const TOOL_NAMES: Record<string, string> = {
        write_chapter_content: '撰写章节内容',
        write_chapter_outline: '撰写章纲',
        write_volume_outline: '撰写卷纲',
        write_outline: '撰写书籍大纲'
      }

      const lines = Object.entries(bindings).map(([tool, chainId]) => {
        const chain = getReasoningChainById(chainId)
        const toolName = TOOL_NAMES[tool] || tool
        return `- ${toolName} → ${chain ? chain.name : '未知推理链'}`
      })

      if (lines.length === 0) {
        return '当前没有工具绑定推理链。使用 bind_reasoning_to_tool 可以绑定。'
      }

      return `工具绑定关系：\n\n${lines.join('\n')}`
    }

    default:
      return `错误：未知工具 ${toolName}`
  }
}
