import type { ReasoningChain } from '../../shared/types'
import { getReasoningChains as getCustomChains } from '../store/db'

// ─── 内置推理链 ───

export const BUILTIN_REASONING_CHAINS: ReasoningChain[] = [
  {
    id: 'chapter-writing',
    name: '章节创作推理',
    description: '写章节前的多维度分析，帮助构建更立体的场景和人物',
    trigger: 'both',
    triggerKeywords: ['写这一章', '写章节', '创作正文', '写正文', '开始写', '帮我写'],
    steps: [
      {
        id: 'psychology',
        name: '人物心理分析',
        prompt: '分析当前场景中每个主要人物的心理状态、动机和内心冲突。考虑他们的过去经历、当前处境和目标。输出每个人物的心理画像。',
        outputKey: 'psychology'
      },
      {
        id: 'relationships',
        name: '人物关系变化',
        prompt: '分析场景中人物之间的关系动态。是否有权力关系的变化？情感的转变？隐藏的张力？关系如何推动剧情发展？',
        outputKey: 'relationships'
      },
      {
        id: 'environment',
        name: '场景环境分析',
        prompt: '分析物理环境的细节：时间、天气、光线、空间布局、重要物品。这些环境元素如何烘托氛围、反映人物心理或预示后续发展？',
        outputKey: 'environment'
      },
      {
        id: 'actions',
        name: '动作与交互设计',
        prompt: '设计人物的物理动作和场景交互。包括微表情、肢体语言、与环境的互动。动作应该体现人物性格和心理状态，推动情节发展。',
        outputKey: 'actions'
      },
      {
        id: 'emotion-rhythm',
        name: '情感节奏规划',
        prompt: '规划本章的情感起伏曲线。从开头到结尾，情感应该如何变化？哪里是高潮？哪里是低谷？如何通过节奏变化抓住读者？',
        outputKey: 'emotionRhythm'
      },
      {
        id: 'integration',
        name: '整合创作指导',
        prompt: '综合以上所有分析，生成一份具体的创作指导。包括：1) 开头建议 2) 关键场景描写要点 3) 对话风格建议 4) 节奏把控 5) 结尾方向。输出可以直接指导写作的结构化建议。',
        outputKey: 'guidance'
      }
    ],
    includeInContext: false,
    builtin: true
  },
  {
    id: 'outline-planning',
    name: '大纲规划推理',
    description: '规划大纲前的系统性思考，确保剧情连贯、伏笔完整',
    trigger: 'both',
    triggerKeywords: ['规划大纲', '写大纲', '剧情规划', '接下来怎么写', '剧情走向', '后续发展'],
    steps: [
      {
        id: 'mainline',
        name: '主线梳理',
        prompt: '梳理当前主线剧情的发展脉络。主角的目标是什么？目前进展到哪一步？主要障碍和冲突是什么？',
        outputKey: 'mainline'
      },
      {
        id: 'sublines',
        name: '支线分析',
        prompt: '分析所有活跃的支线剧情。每条支线与主线的关系是什么？发展状态如何？哪些需要推进？哪些可以收束？',
        outputKey: 'sublines'
      },
      {
        id: 'foreshadowing',
        name: '伏笔检查',
        prompt: '检查已埋设的伏笔。哪些伏笔已经到期需要回收？哪些还在发展？回收伏笔的最佳时机和方式是什么？',
        outputKey: 'foreshadowing'
      },
      {
        id: 'pacing',
        name: '节奏规划',
        prompt: '规划接下来几章的节奏。信息密度如何分配？高潮和低谷如何安排？如何保持读者的阅读动力？',
        outputKey: 'pacing'
      }
    ],
    includeInContext: false,
    builtin: true
  }
]

// 获取所有推理链（内置 + 自定义，去重）
export function getReasoningChains(): ReasoningChain[] {
  const customChains = getCustomChains()
  // 过滤掉与内置推理链 ID 重复的自定义推理链
  const builtinIds = new Set(BUILTIN_REASONING_CHAINS.map(c => c.id))
  const filteredCustom = customChains.filter(c => !builtinIds.has(c.id))
  return [...BUILTIN_REASONING_CHAINS, ...filteredCustom]
}

// 根据 ID 获取推理链
export function getReasoningChainById(id: string): ReasoningChain | undefined {
  const allChains = getReasoningChains()
  return allChains.find(chain => chain.id === id)
}

// 根据 ID 或名称获取推理链（更灵活的查找）
export function findReasoningChain(idOrName: string): ReasoningChain | undefined {
  const allChains = getReasoningChains()
  // 先按 ID 查找
  const byId = allChains.find(chain => chain.id === idOrName)
  if (byId) return byId
  // 再按名称查找（精确匹配）
  const byName = allChains.find(chain => chain.name === idOrName)
  if (byName) return byName
  // 最后按名称模糊匹配
  const byNameLower = allChains.find(chain => chain.name.toLowerCase().includes(idOrName.toLowerCase()))
  return byNameLower
}

// 检测是否应该自动触发推理链
export function detectAutoTrigger(message: string): ReasoningChain | null {
  // 先检测手动触发格式 [reasoning:chain-id]
  const manualMatch = message.match(/^\[reasoning:([^\]]+)\]/)
  if (manualMatch) {
    const chainId = manualMatch[1]
    const chain = getReasoningChainById(chainId)
    if (chain) return chain
  }

  // 再检测关键词自动触发
  const lowerMessage = message.toLowerCase()
  const allChains = getReasoningChains()

  for (const chain of allChains) {
    if (chain.trigger === 'manual') continue
    if (!chain.triggerKeywords) continue

    const matched = chain.triggerKeywords.some(keyword =>
      lowerMessage.includes(keyword.toLowerCase())
    )
    if (matched) return chain
  }

  return null
}

// 提取用户实际消息（去掉触发标记）
export function extractUserMessage(message: string): string {
  return message.replace(/(\[reasoning:[^\]]+\]\s*)+/g, '').trim()
}

// 构建单个步骤的提示词
export function buildStepPrompt(
  step: { name: string; prompt: string },
  previousResults: Record<string, string>,
  context: string
): string {
  let prompt = `## 推理任务：${step.name}\n\n`
  prompt += `### 任务说明\n${step.prompt}\n\n`

  if (Object.keys(previousResults).length > 0) {
    prompt += `### 前序分析结果\n`
    for (const [key, value] of Object.entries(previousResults)) {
      prompt += `**${key}**:\n${value}\n\n`
    }
  }

  prompt += `### 当前上下文\n${context}\n\n`
  prompt += `请根据以上信息完成推理分析。输出要具体、可操作，直接指导后续创作。`

  return prompt
}
