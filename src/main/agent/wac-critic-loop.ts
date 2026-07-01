import type { BrowserWindow } from 'electron'
import type {
  WritingTask, SubTask, AgentResult, AgentExecutionContext, CriticScore
} from '../../shared/types'
import { executeWriter } from './writer'
import { executeCritic } from './critic'
import { executePlanner } from './planner'
import { selectRewriteStrategy, trackScoreTrend, shouldStopRewrite } from './rewrite-strategy'
import { executeTaskGraph } from './task-executor'
import { formatCriticFeedback, emitPhaseChange, emitSubTaskUpdate, emitCriticResult, waitForRewriteApproval } from './wac-helpers'
import type { WritingStateMachine } from './state-machine'
import type { TrajectoryRecorder } from './visualization'
import { randomUUID } from 'crypto'
import { log } from '../utils/logger'

const MAX_REWRITE_ROUNDS = 2

/** 打分最小内容长度阈值（字符数）。短于这个值不值得打分 */
const CRITIC_MIN_LENGTH = 800

/**
 * 判断是否值得运行 Critic Loop。
 * 很多场景打分纯属浪费时间：
 *  - 局部编辑/润色（edit）：用户只想改一小段
 *  - 局部重写（revise）：同上
 *  - 续写但内容较短（continue + 短文本）
 *  - 任何短于阈值的输出
 */
function shouldRunCritic(task: WritingTask, content: string): boolean {
  if (!content) return false
  if (task.intent === 'chat' || task.intent === 'summarize') return false
  // 局部修改类不打分
  if (task.intent === 'edit' || task.intent === 'revise') return false
  // 短内容不值得打分
  if (content.length < CRITIC_MIN_LENGTH) return false
  return true
}

export async function executeWithCriticLoop(
  task: WritingTask,
  context: AgentExecutionContext,
  mainWindow: BrowserWindow,
  stateMachine: WritingStateMachine,
  memoryContext: string,
  abortController: AbortController | null,
  streamId?: string,
  trajectory?: TrajectoryRecorder
): Promise<string> {
  stateMachine.transition('writing')
  task.phase = 'writing'
  emitPhaseChange(mainWindow, task.id, 'writing')
  trajectory?.record('phase_change', { phase: 'writing' })

  const graphResult = await executeTaskGraph(
    task.subTasks,
    context,
    (subTaskId, status, result) => {
      emitSubTaskUpdate(mainWindow, task.id, subTaskId, status, result)
    },
    streamId
  )

  log.debug(`[WAC] TaskGraph 执行完成: 成功=${graphResult.completedTasks.size}, 失败=${graphResult.failedTasks.size}`)

  let lastWriterContent = ''
  for (const [, result] of graphResult.completedTasks) {
    if (result.agentRole === 'writer' && result.success) {
      lastWriterContent = result.content
    }
  }

  if (!lastWriterContent) {
    for (const [, result] of graphResult.completedTasks) {
      if (result.success) {
        lastWriterContent = result.content
        break
      }
    }
  }

  if (shouldRunCritic(task, lastWriterContent)) {
    log.debug(`[WAC] → Critic Agent 启动...`)
    stateMachine.transition('critic_check', { hasContent: true })
    task.phase = 'critic_check'
    emitPhaseChange(mainWindow, task.id, 'critic_check')
    trajectory?.record('phase_change', { phase: 'critic_check' })

    const scoreHistory: number[] = []
    let currentContent = lastWriterContent
    let rewriteRound = 0

    while (rewriteRound < MAX_REWRITE_ROUNDS) {
      if (abortController?.signal.aborted) break

      log.debug(`[WAC] Critic 评审第 ${rewriteRound + 1} 轮...`)
      const score = await executeCritic(currentContent, context)
      scoreHistory.push(score.overall)
      emitCriticResult(mainWindow, task.id, score)
      trajectory?.record('critic_score', { round: rewriteRound, overall: score.overall, issues: score.issues })
      log.debug(`[WAC] Critic 评分: ${score.overall}/10 (结构:${score.structure} 节奏:${score.pacing} 冲突:${score.conflict})`)

      const trend = trackScoreTrend(scoreHistory)
      const stopDecision = shouldStopRewrite(score, trend, rewriteRound, MAX_REWRITE_ROUNDS)
      if (stopDecision.stop) {
        log.debug(`[WAC] Critic 停止: ${stopDecision.reason}`)
        trajectory?.record('phase_change', { phase: 'finalizing', reason: stopDecision.reason })
        break
      }

      const rewritePlan = selectRewriteStrategy(score, rewriteRound + 1)
      if (rewritePlan.strategy === 'skip') {
        log.debug(`[WAC] 重写策略: skip`)
        trajectory?.record('phase_change', { phase: 'finalizing', reason: 'skip' })
        break
      }

      // 请求用户审批重写
      const approvalId = randomUUID()
      mainWindow.webContents.send('agent:rewrite-approval', {
        approvalId,
        taskId: task.id,
        score,
        strategy: rewritePlan.strategy,
        instruction: rewritePlan.instruction.substring(0, 200),
        round: rewriteRound + 1
      })

      const approved = await waitForRewriteApproval(approvalId)
      if (!approved) {
        log.debug(`[WAC] 用户拒绝重写，跳过`)
        trajectory?.record('phase_change', { phase: 'finalizing', reason: 'user_rejected_rewrite' })
        break
      }

      rewriteRound++
      log.debug(`[WAC] → Writer 重写第 ${rewriteRound} 轮 (策略: ${rewritePlan.strategy})`)
      stateMachine.transition('revision', { hasIssues: true })
      task.phase = 'revision'
      emitPhaseChange(mainWindow, task.id, 'revision')
      trajectory?.record('rewrite', { round: rewriteRound, strategy: rewritePlan.strategy })

      currentContent = await executeWriter({
        instruction: rewritePlan.instruction,
        context,
        streamId: rewriteRound === 1 ? streamId : undefined,
        existingContent: context.taskContext.currentContent,
        criticFeedback: formatCriticFeedback(score),
        memoryContext
      })

      stateMachine.transition('critic_check', { hasContent: true })
      task.phase = 'critic_check'
      emitPhaseChange(mainWindow, task.id, 'critic_check')
    }

    return currentContent
  }

  return lastWriterContent
}

/**
 * 执行单个子任务
 */
export async function executeSingleTask(
  subTask: SubTask,
  context: AgentExecutionContext,
  memoryContext: string,
  streamId?: string,
  additionalContext?: string
): Promise<AgentResult> {
  const instruction = additionalContext
    ? `${subTask.description}\n\n## 前置任务结果\n${additionalContext}`
    : subTask.description

  switch (subTask.agentRole) {
    case 'planner':
    case 'researcher': {
      const result = await executePlanner(instruction, context)
      return { agentRole: subTask.agentRole, success: true, content: JSON.stringify(result) }
    }
    case 'writer': {
      const content = await executeWriter({
        instruction, context, streamId,
        existingContent: context.taskContext.currentContent,
        memoryContext
      })
      return { agentRole: 'writer', success: true, content }
    }
    case 'critic': {
      const score = await executeCritic(context.taskContext.currentContent || instruction, context)
      return { agentRole: 'critic', success: true, content: JSON.stringify(score), metadata: { score } }
    }
    case 'editor': {
      const { executeEditor } = await import('./editor')
      const result = await executeEditor({
        content: context.taskContext.currentContent || instruction,
        instruction, context
      })
      return { agentRole: 'editor', success: true, content: result.editedContent, metadata: { changes: result.changes, summary: result.summary } }
    }
    default:
      return { agentRole: subTask.agentRole, success: false, content: '', error: `未知的 agent 角色: ${subTask.agentRole}` }
  }
}
