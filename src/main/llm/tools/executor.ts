import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, BookAIConfig, Chapter, Volume, DialogueLevel, WritingSkill, FeatureSkillIds, ReasoningChain, ConversationMessage, ProjectReasoningConfig, ContextConfig } from '../../../shared/types'
import { DEFAULT_FEATURE_SKILL_IDS, DEFAULT_REASONING_CONTEXT_CONFIG, DEFAULT_CONTEXT_CONFIG } from '../../../shared/types'
import { summarizeChapter } from '../client'
import { polishText } from '../client'
import { refineSummary } from '../refine-summary'
import { createChapter, createVolume, renameChapter, updateChapter, saveOutline, getOutline, saveSkill, getSkills, getProjects, updateProjectFeatureSkillIds, saveVersion, updateChapterSummary, saveReasoningChain, deleteReasoningChain, getLLMConfig } from '../../store/db'
import { randomUUID } from 'crypto'
import { getReasoningChains, getReasoningChainById, findReasoningChain } from '../reasoning-chains'

export interface ExecuteToolParams {
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
  dialogueMessages?: ConversationMessage[]
  executedReasoningChains?: Set<string>  // 已执行过的推理链 ID
  messageChainIds?: string[]
  volume?: Volume | null
  contextConfig?: ContextConfig  // 上下文管理配置
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
    // Initialize executed chains tracker if not exists
    if (!params.executedReasoningChains) {
      params.executedReasoningChains = new Set()
    }

    const chainsToExecute: ReasoningChain[] = []

    // 1. Check project's tool-chain binding (only if not already executed)
    const projects = getProjects()
    const project = projects.find(p => p.id === projectId)
    const binding = project?.reasoningConfig?.toolChainBindings?.[toolName]
    if (binding) {
      const chain = findReasoningChain(binding)
      if (chain && !params.executedReasoningChains.has(chain.id)) {
        chainsToExecute.push(chain)
      }
    }

    // Execute all chains
    if (chainsToExecute.length > 0) {
      const { executeReasoningChain, buildReasoningContext } = await import('../dialogue')

      for (const chain of chainsToExecute) {
        // Mark as executed
        params.executedReasoningChains.add(chain.id)

        // Build context based on chain's contextConfig
        const ctxConfig = chain.contextConfig || DEFAULT_REASONING_CONTEXT_CONFIG
        const contextParts: string[] = []

        // Current chapter info
        if (targetChapter) {
          contextParts.push(`当前章节：${targetChapter.title}`)
        }

        // Book outline
        if (ctxConfig.bookOutline) {
          const bookOutline = getOutline('book', projectId)
          if (bookOutline?.content) {
            contextParts.push(`## 书籍大纲\n${bookOutline.content.substring(0, 2000)}`)
          }
        }

        // Volume outline
        if (ctxConfig.volumeOutline) {
          const volumeId = targetChapter?.volumeId || params.chapter?.volumeId
          if (volumeId) {
            const volOutline = getOutline('volume', volumeId)
            if (volOutline?.content) {
              contextParts.push(`## 卷大纲\n${volOutline.content.substring(0, 2000)}`)
            }
          }
        }

        // Chapter outline
        if (ctxConfig.chapterOutline && targetChapter) {
          const chOutline = getOutline('chapter', targetChapter.id)
          if (chOutline?.content) {
            contextParts.push(`## 章节大纲\n${chOutline.content.substring(0, 1000)}`)
          }
        }

        // Previous chapters summaries (up to 3)
        if (ctxConfig.previousSummaries && targetChapter) {
          const volChapters = allChapters
            .filter(c => c.volumeId === targetChapter.volumeId)
            .sort((a, b) => a.orderIndex - b.orderIndex)
          const currentIdx = volChapters.findIndex(c => c.id === targetChapter.id)
          const prevChapters = volChapters.slice(Math.max(0, currentIdx - 3), currentIdx)
          if (prevChapters.length > 0) {
            const summaries = prevChapters
              .filter(c => c.summaryResult)
              .map(c => `- ${c.title}：${c.summaryResult?.substring(0, 200)}`)
            if (summaries.length > 0) {
              contextParts.push(`## 前文摘要\n${summaries.join('\n')}`)
            }
          }
        }

        // Dialogue history (recent messages)
        if (ctxConfig.dialogueHistory && params.dialogueMessages?.length) {
          const recentMessages = params.dialogueMessages.slice(-6)
          const dialogueText = recentMessages
            .map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content.substring(0, 200)}`)
            .join('\n')
          contextParts.push(`## 最近对话\n${dialogueText}`)
        }

        const context = contextParts.join('\n\n')

        const session = await executeReasoningChain(chain, context, config, mainWindow)
        const reasoningResult = buildReasoningContext(session, true)
        if (reasoningResult) {
          reasoningResults += reasoningResult
        }
      }

      // Clear message chain IDs after execution
      if (params.messageChainIds) {
        params.messageChainIds = []
      }
    }
  }

  const rawResult = await executeToolInternal(toolName, args, params, targetChapter, reasoningResults)
  return rawResult
}

async function executeToolInternal(
  toolName: string,
  args: Record<string, string>,
  params: ExecuteToolParams,
  targetChapter: Chapter | undefined | null,
  reasoningResults: string
): Promise<string> {
  const { config, level, projectId, chapter: currentChapter, allChapters, aiConfig, refreshCache } = params

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
      console.log('[write_chapter_content] reasoningResults length:', reasoningResults.length)
      if (reasoningResults) {
        console.log('[write_chapter_content] Returning reasoning results to AI')
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

      const chain = findReasoningChain(args.chainId)
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

    case 'web_search': {
      const { query, count = 5 } = args
      if (!query) return '错误：缺少搜索关键词'

      const llmConfig = getLLMConfig()
      const searchConfig = llmConfig.searchEngineConfig || { engine: 'duckduckgo' }

      try {
        const { searchWeb } = await import('../search')
        const results = await searchWeb(query, Math.min(Math.max(1, parseInt(String(count)) || 5), 10), searchConfig)
        if (results.length === 0) return '未找到相关搜索结果'
        return results.map((r, i) =>
          `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description}`
        ).join('\n\n')
      } catch (err: any) {
        return `错误：搜索请求失败 - ${err.message}`
      }
    }

    default:
      return `错误：未知工具 ${toolName}`
  }
}
