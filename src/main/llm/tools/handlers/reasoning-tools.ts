import type { ReasoningChain } from '../../../../shared/types'
import { DEFAULT_REASONING_CONTEXT_CONFIG } from '../../../../shared/types'
import { getReasoningChains, getReasoningChainById, findReasoningChain } from '../../reasoning-chains'
import { saveReasoningChain, deleteReasoningChain, getProjects } from '../../../store/db'
import { randomUUID } from 'crypto'

export async function handleReasoningTools(
  toolName: string,
  args: Record<string, string>,
  projectId: string
): Promise<string | null> {
  switch (toolName) {
    case 'list_reasoning_chains': {
      const chains = getReasoningChains()
      const lines = chains.map(chain => {
        const triggerLabel = chain.trigger === 'auto' ? '自动触发' : chain.trigger === 'manual' ? '手动触发' : '自动/手动'
        const contextLabel = chain.includeInContext ? '纳入上下文' : '不纳入上下文'
        const steps = chain.steps.map(s => `  - ${s.name}`).join('\n')
        return `- ID: ${chain.id}\n  名称: 「${chain.name}」（${triggerLabel}，${contextLabel}）\n  ${chain.description}\n  步骤：\n${steps}`
      })
      return `共 ${chains.length} 个推理链（绑定时使用 ID 或名称）：\n\n${lines.join('\n\n')}`
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
        trigger: (args.trigger as any) || 'auto',
        steps: steps.map((s, i) => ({
          id: `step-${Date.now()}-${i}`,
          name: s.name,
          prompt: s.prompt,
          outputKey: `step${i + 1}`
        })),
        includeInContext: args.includeInContext === 'true',
        contextConfig: DEFAULT_REASONING_CONTEXT_CONFIG,
        builtin: false
      }

      saveReasoningChain(newChain)
      return `已创建推理链「${newChain.name}」，包含 ${newChain.steps.length} 个步骤。`
    }

    case 'update_reasoning_chain': {
      if (!args.chainId) return '错误：未提供推理链 ID'

      const existingChain = findReasoningChain(args.chainId)
      if (!existingChain) return '错误：找不到指定推理链'
      if (existingChain.builtin) return '错误：内置推理链无法修改'

      const updates: Partial<ReasoningChain> = {}
      if (args.name) updates.name = args.name
      if (args.description) updates.description = args.description
      if (args.trigger) updates.trigger = args.trigger as any
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

      const chainToDelete = findReasoningChain(args.chainId)
      if (!chainToDelete) return '错误：找不到指定推理链'
      if (chainToDelete.builtin) return '错误：内置推理链无法删除'

      deleteReasoningChain(args.chainId)
      return `已删除推理链「${chainToDelete.name}」。`
    }

    case 'toggle_reasoning_context': {
      if (!args.chainId) return '错误：未提供推理链 ID'
      if (args.includeInContext === undefined) return '错误：未提供上下文设置'

      const chain = findReasoningChain(args.chainId)
      if (!chain) return '错误：找不到指定推理链'

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
        const projects = getProjects()
        const project = projects.find(p => p.id === projectId)
        if (project?.reasoningConfig?.toolChainBindings?.[args.toolName]) {
          const newBindings = { ...project.reasoningConfig.toolChainBindings }
          delete newBindings[args.toolName]
          return `已解绑「${displayName}」的推理链。`
        }
        return `「${displayName}」没有绑定推理链。`
      }

      const chain = findReasoningChain(args.chainId)
      if (!chain) return '错误：找不到指定推理链'

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
      return null
  }
}
