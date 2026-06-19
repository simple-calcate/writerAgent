import type { PipelineIntent, IntentClassifierResult, LLMConfigSingle } from '../../shared/types'
import { callLLMSync } from './base-agent'

interface RulePattern {
  intent: PipelineIntent
  patterns: RegExp[]
  baseConfidence: number
}

const RULES: RulePattern[] = [
  {
    intent: 'writing',
    patterns: [
      /写[一-龥]/, /续写/, /重写/, /修改/, /润色/, /创作/, /生成/, /编写/,
      /扩写/, /缩写/, /改写/, /规划/, /大纲/, /剧情走向/, /后续发展/,
      /怎么写/, /接下来/, /构思/, /设定/
    ],
    baseConfidence: 0.9
  },
  {
    intent: 'analysis',
    patterns: [
      /评价/, /评估/, /打分/, /评分/, /写得怎么样/, /好不好/, /水平/,
      /质量/, /分析/, /检查/, /有什么问题/, /改进/, /优化建议/, /不足/
    ],
    baseConfidence: 0.85
  },
  {
    intent: 'tool',
    patterns: [
      /润色/, /摘要/, /总结/, /精炼/, /翻译/, /导出/, /导入/, /搜索/, /查找/
    ],
    baseConfidence: 0.85
  }
]

function ruleClassify(input: string): IntentClassifierResult {
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(input)) {
        return {
          intent: rule.intent,
          confidence: rule.baseConfidence,
          method: 'rule',
          originalInput: input
        }
      }
    }
  }
  return {
    intent: 'chat',
    confidence: 0.5,
    method: 'rule',
    originalInput: input
  }
}

async function llmClassify(
  input: string,
  config: LLMConfigSingle,
  signal?: AbortSignal
): Promise<IntentClassifierResult | null> {
  const prompt = `你是一个意图分类器。根据用户输入判断意图类别，只返回JSON。

类别：
- writing: 写作、续写、重写、修改、润色、创作、生成、扩写、缩写、改写、规划、大纲、剧情、构思
- analysis: 评价、评估、打分、评分、分析、检查、改进、优化建议、质量评估
- tool: 润色、摘要、总结、精炼、翻译、导出、导入、搜索
- chat: 闲聊、问答、其他

用户输入: "${input}"

返回格式: {"intent":"类别","confidence":0.0-1.0,"reasoning":"简短理由"}`

  try {
    const result = await callLLMSync({
      config,
      messages: [
        { role: 'system', content: '你是意图分类器，只返回JSON，不要有其他内容。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      maxTokens: 200,
      signal
    })

    const text = result.content.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const validIntents: PipelineIntent[] = ['writing', 'analysis', 'tool', 'chat']
    if (!validIntents.includes(parsed.intent)) return null

    return {
      intent: parsed.intent,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
      method: 'llm',
      originalInput: input,
      reasoning: parsed.reasoning
    }
  } catch {
    return null
  }
}

export async function classifyIntent(
  input: string,
  config?: LLMConfigSingle,
  signal?: AbortSignal
): Promise<IntentClassifierResult> {
  const ruleResult = ruleClassify(input)

  if (ruleResult.confidence >= 0.8) {
    return ruleResult
  }

  if (config) {
    const llmResult = await llmClassify(input, config, signal)
    if (llmResult) {
      return llmResult
    }
  }

  return ruleResult
}
