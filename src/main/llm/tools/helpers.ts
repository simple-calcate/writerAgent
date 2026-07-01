import type { Chapter } from '../../../shared/types'
import type { ApprovalMode } from '../../../shared/types'
import { getLLMConfig } from '../../store/db'

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
  create_reasoning_chain: '创建推理链',
  update_reasoning_chain: '修改推理链',
  delete_reasoning_chain: '删除推理链',
  toggle_reasoning_context: '调整推理上下文',
  bind_reasoning_to_tool: '绑定推理链到工具',
  list_tool_bindings: '查看工具绑定',
  web_search: '联网搜索',
  search_content: '搜索正文内容'
}

// 真正写入/修改/删除类工具 —— 任何模式下都需要用户确认
const MUTATING_TOOLS = new Set([
  'create_chapter', 'create_volume', 'rename_chapter',
  'write_outline', 'write_volume_outline', 'write_chapter_outline',
  'write_chapter_content',
  'extract_skill', 'refine_skill', 'toggle_feature_skill',
  'batch_refine_summaries',
  'create_reasoning_chain', 'update_reasoning_chain', 'delete_reasoning_chain',
  'toggle_reasoning_context', 'bind_reasoning_to_tool'
])

// 只读但严格模式下需要确认的工具（智能模式自动放行）
const STRICT_ONLY_TOOLS = new Set([
  'read_chapter_content'
])

// Tools that can use cache
const CACHEABLE_TOOLS = new Set(['summarize_chapter', 'refine_summary'])

/**
 * 判断工具是否需要用户确认。
 * - smart 模式（默认）：仅 MUTATING_TOOLS 需确认
 * - strict 模式：MUTATING_TOOLS + STRICT_ONLY_TOOLS 都需确认
 */
export function needsApproval(toolName: string): boolean {
  if (MUTATING_TOOLS.has(toolName)) return true
  const mode = getCurrentApprovalMode()
  if (mode === 'strict') return STRICT_ONLY_TOOLS.has(toolName)
  return false
}

/** 读取当前确认模式（未配置时默认 smart） */
export function getCurrentApprovalMode(): ApprovalMode {
  try {
    return getLLMConfig().approvalMode ?? 'smart'
  } catch {
    return 'smart'
  }
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
