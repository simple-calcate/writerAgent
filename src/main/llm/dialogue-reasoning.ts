import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, ReasoningChain, ReasoningStep, ReasoningStepResult, ReasoningSession } from '../../shared/types'
import { createClient, buildThinkingParams, hasThinkingParams } from './client'
import { buildStepPrompt } from './reasoning-chains'

// 按依赖关系分层：返回 levels，每层内的步骤可并发
function topologicalLevels(steps: ReasoningStep[]): ReasoningStep[][] {
  const keyToStep = new Map(steps.map(s => [s.outputKey, s]))
  const completed = new Set<string>()
  const remaining = new Set(steps.map(s => s.outputKey))
  const levels: ReasoningStep[][] = []

  while (remaining.size > 0) {
    const level: ReasoningStep[] = []
    for (const key of remaining) {
      const step = keyToStep.get(key)!
      const deps = step.dependsOn || []
      if (deps.every(d => completed.has(d))) {
        level.push(step)
      }
    }
    if (level.length === 0) {
      // 剩余步骤存在循环依赖，按顺序执行
      for (const key of remaining) {
        level.push(keyToStep.get(key)!)
      }
      levels.push(level)
      break
    }
    for (const s of level) {
      completed.add(s.outputKey)
      remaining.delete(s.outputKey)
    }
    levels.push(level)
  }
  return levels
}

async function executeStepLLM(
  step: ReasoningStep,
  results: Record<string, string>,
  context: string,
  config: LLMConfigSingle,
  signal?: AbortSignal
): Promise<string> {
  const client = createClient(config)
  // 只传入该步骤依赖的结果
  const depResults: Record<string, string> = {}
  const deps = step.dependsOn || []
  for (const dep of deps) {
    if (results[dep] !== undefined) depResults[dep] = results[dep]
  }
  const stepPrompt = buildStepPrompt(step, depResults, context)

  const thinkingParams = buildThinkingParams(config)
  let response: any
  try {
    response = await client.chat.completions.create({
      model: config.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '你是一位专业的写作分析助手。请根据任务说明进行分析，输出具体、可操作的分析结果。' },
        { role: 'user', content: stepPrompt }
      ],
      temperature: 0.7,
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
      ...thinkingParams
    }, { signal })
  } catch (err: any) {
    if (hasThinkingParams(config) && (err.status === 400 || err.status === 422)) {
      response = await client.chat.completions.create({
        model: config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '你是一位专业的写作分析助手。请根据任务说明进行分析，输出具体、可操作的分析结果。' },
          { role: 'user', content: stepPrompt }
        ],
        temperature: 0.7,
        ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
      }, { signal })
    } else {
      throw err
    }
  }
  return response.choices[0]?.message?.content?.trim() || '分析失败'
}

export async function executeReasoningChain(
  chain: ReasoningChain,
  context: string,
  config: LLMConfigSingle,
  mainWindow: BrowserWindow,
  signal?: AbortSignal
): Promise<ReasoningSession> {
  const sessionId = randomUUID()
  const session: ReasoningSession = {
    id: sessionId,
    chainId: chain.id,
    chainName: chain.name,
    steps: [],
    context,
    status: 'running',
    includeInContext: chain.includeInContext,
    createdAt: new Date().toISOString()
  }

  // Notify start
  mainWindow.webContents.send('dialogue:reasoning-start', {
    sessionId,
    chainId: chain.id,
    chainName: chain.name,
    steps: chain.steps.map(s => ({ id: s.id, name: s.name }))
  })

  const results: Record<string, string> = {}
  const stepResultMap = new Map<string, ReasoningStepResult>()

  try {
    // 按依赖关系分层
    const levels = topologicalLevels(chain.steps)

    for (const level of levels) {
      if (signal?.aborted) break

      // 为每层中的步骤创建 stepResult 并通知开始
      for (const step of level) {
        const stepResult: ReasoningStepResult = {
          chainId: chain.id,
          stepId: step.id,
          stepName: step.name,
          result: '',
          status: 'running'
        }
        session.steps.push(stepResult)
        stepResultMap.set(step.id, stepResult)

        mainWindow.webContents.send('dialogue:reasoning-step-start', {
          sessionId,
          stepId: step.id,
          stepName: step.name
        })
      }

      // 并发执行当前层的所有步骤
      const promises = level.map(async step => {
        try {
          const result = await executeStepLLM(step, results, context, config, signal)
          results[step.outputKey] = result
          const stepResult = stepResultMap.get(step.id)!
          stepResult.result = result
          stepResult.status = 'done'

          mainWindow.webContents.send('dialogue:reasoning-step-done', {
            sessionId,
            stepId: step.id,
            stepName: step.name,
            result
          })
        } catch (err: any) {
          if (signal?.aborted) return
          const stepResult = stepResultMap.get(step.id)!
          stepResult.status = 'error'
          stepResult.result = `错误: ${err.message}`

          mainWindow.webContents.send('dialogue:reasoning-step-error', {
            sessionId,
            stepId: step.id,
            stepName: step.name,
            error: err.message
          })
        }
      })

      await Promise.all(promises)
    }

    session.status = signal?.aborted ? 'error' : 'completed'
  } catch (err: any) {
    session.status = 'error'
  }

  // Notify complete
  mainWindow.webContents.send('dialogue:reasoning-done', {
    sessionId,
    status: session.status,
    includeInContext: chain.includeInContext
  })

  return session
}

// Build reasoning context for injection into system prompt
export function buildReasoningContext(session: ReasoningSession, forceInclude = false): string {
  // Always build context if session is completed, regardless of includeInContext setting
  // The includeInContext flag now controls whether to persist across conversation turns
  if (session.status !== 'completed') return ''

  let context = `\n## 推理分析（${session.chainName}）\n`
  for (const step of session.steps) {
    if (step.status === 'done') {
      context += `\n### ${step.stepName}\n${step.result}\n`
    }
  }
  return context
}
