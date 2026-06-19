import type { CriticScore, AgentExecutionContext } from '../../shared/types'
import { callLLMSync } from './base-agent'

const CRITIC_SYSTEM_PROMPT = `你是一位资深的网文编辑和文学评论家。你的任务是严格评估写作内容的质量。

评估维度（每项 0-10 分）：
- structure（结构完整性）：情节是否连贯，是否有清晰的起承转合
- pacing（节奏）：叙事节奏是否合理，是否有拖沓或过快
- conflict（冲突强度）：矛盾冲突是否足够吸引人
- infoDensity（信息密度）：信息量是否适中，是否有冗余或遗漏
- styleConsistency（文风一致性）：语言风格是否统一

你必须以严格的 JSON 格式返回评估结果，不要包含任何其他文字。

JSON 格式：
{
  "overall": 7.5,
  "structure": 8,
  "pacing": 7,
  "conflict": 6,
  "infoDensity": 8,
  "styleConsistency": 7,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "shouldRewrite": false,
  "rewriteInstructions": "如果需要重写，给出具体指令"
}

评分标准：
- 9-10：优秀，可直接发布
- 7-8：良好，小修即可
- 5-6：及格，需要较大修改
- 3-4：较差，需要重写
- 1-2：很差，需要重新构思

shouldRewrite 为 true 的条件：overall < 7 或任何关键维度（structure/conflict）< 5`

export async function executeCritic(
  content: string,
  context: AgentExecutionContext
): Promise<CriticScore> {
  const { config, taskContext, signal } = context

  const contextParts: string[] = []
  if (taskContext.outline) {
    contextParts.push(`## 大纲\n${taskContext.outline}`)
  }
  if (taskContext.currentContent) {
    contextParts.push(`## 当前已有内容（供参考连贯性）\n${taskContext.currentContent.substring(0, 2000)}`)
  }

  const userPrompt = `请评估以下写作内容：

${contextParts.length > 0 ? contextParts.join('\n\n') + '\n\n' : ''}## 待评估内容
${content}

请严格按照 JSON 格式返回评估结果。`

  const result = await callLLMSync({
    config,
    messages: [
      { role: 'system', content: CRITIC_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    signal
  })

  return parseCriticResult(result.content)
}

function parseCriticResult(raw: string): CriticScore {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return createDefaultScore('无法解析评审结果')
    }
    const parsed = JSON.parse(jsonMatch[0])
    return {
      overall: clamp(parsed.overall, 0, 10),
      structure: clamp(parsed.structure, 0, 10),
      pacing: clamp(parsed.pacing, 0, 10),
      conflict: clamp(parsed.conflict, 0, 10),
      infoDensity: clamp(parsed.infoDensity, 0, 10),
      styleConsistency: clamp(parsed.styleConsistency, 0, 10),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      shouldRewrite: !!parsed.shouldRewrite,
      rewriteInstructions: parsed.rewriteInstructions || undefined
    }
  } catch {
    return createDefaultScore('评审结果 JSON 解析失败')
  }
}

function clamp(val: unknown, min: number, max: number): number {
  const num = typeof val === 'number' ? val : min
  return Math.max(min, Math.min(max, num))
}

function createDefaultScore(reason: string): CriticScore {
  return {
    overall: 5,
    structure: 5,
    pacing: 5,
    conflict: 5,
    infoDensity: 5,
    styleConsistency: 5,
    issues: [reason],
    suggestions: ['建议重新评审'],
    shouldRewrite: false
  }
}
