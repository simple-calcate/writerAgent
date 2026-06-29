import type { BrowserWindow } from 'electron'
import { errorMessage } from '../utils/errors'
import type {
  WritingTask, WACState, AgentExecutionContext,
  Project, Volume, Chapter, TaskContext
} from '../../shared/types'
import { resolveFeatureConfig } from '../store/db'
import { executePlanner } from './planner'
import { createWritingStateMachine, type WritingStateMachine } from './state-machine'
import { buildMemorySystemPrompt, commitMemory } from '../memory/manager'
import {
  createTask, finalizeTask, isSimpleTask,
  resolveOutlines, resolveSkills, resolvePreviousSummaries,
  emitPhaseChange, emitTaskComplete
} from './wac-helpers'
import { executeWithCriticLoop, executeSingleTask } from './wac-critic-loop'
import { log } from '../utils/logger'
import { TrajectoryRecorder, emitTrajectory } from './visualization'

export class WriterAgentController {
  private state: WACState
  private mainWindow: BrowserWindow
  private abortController: AbortController | null = null
  private stateMachine: WritingStateMachine
  private memoryContext: string = ''
  private trajectory: TrajectoryRecorder | null = null

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
    this.state = { currentTask: null, phase: 'idle', taskHistory: [] }
    this.stateMachine = createWritingStateMachine()
    this.stateMachine.onStateChange(snapshot => { this.state.phase = snapshot.phase })
  }

  getState(): WACState {
    return { ...this.state, stateMachine: this.stateMachine.snapshot } as WACState
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  async processRequest(
    userRequest: string,
    project: Project,
    volume: Volume | null,
    chapter: Chapter | null,
    level: 'book' | 'volume' | 'chapter',
    streamId?: string
  ): Promise<string> {
    this.abortController = new AbortController()

    const outlines = resolveOutlines(project.id, volume?.id, chapter?.id)
    const skills = resolveSkills(project)
    const previousSummaries = resolvePreviousSummaries(chapter)

    const taskContext: TaskContext = {
      projectId: project.id,
      volumeId: volume?.id,
      chapterId: chapter?.id,
      level,
      userRequest,
      currentContent: chapter?.content,
      outline: outlines.map(o => o.content).join('\n\n'),
      previousSummaries,
      styleProfile: project.aiConfig?.customPrompt || undefined
    }

    const config = resolveFeatureConfig('dialogue')
    if (!config) throw new Error('对话功能未启用')
    if (!config.apiKey) throw new Error('请先配置 API Key')

    this.memoryContext = buildMemorySystemPrompt(project.id)

    const execContext: AgentExecutionContext = {
      config, project, volume, chapter, outlines, skills,
      taskContext, mainWindow: this.mainWindow,
      signal: this.abortController.signal
    }

    const task = createTask(userRequest, taskContext)
    this.state.currentTask = task
    this.stateMachine.reset()
    this.trajectory = new TrajectoryRecorder(task.id, project.id)
    this.trajectory.record('phase_change', { phase: 'planning' })
    this.stateMachine.transition('planning')
    emitPhaseChange(this.mainWindow, task.id, 'planning')
    log.debug(`[WAC] 任务开始: ${task.id}`)
    log.debug(`[WAC] 用户请求: ${userRequest.substring(0, 100)}`)

    try {
      task.phase = 'planning'
      log.debug(`[WAC] → Planning Agent 启动...`)
      const plan = await executePlanner(userRequest, execContext)
      task.intent = plan.intent
      task.description = plan.description
      task.subTasks = plan.subTasks
      log.debug(`[WAC] ← Planning 完成: intent=${plan.intent}, 子任务数=${plan.subTasks.length}`)
      for (const st of plan.subTasks) {
        log.debug(`[WAC]   子任务: [${st.agentRole}] ${st.description.substring(0, 60)}`)
      }
      this.trajectory.record('phase_change', { phase: 'writing', intent: plan.intent, subTaskCount: plan.subTasks.length })

      if (isSimpleTask(plan)) {
        log.debug(`[WAC] 简单任务，跳过 Critic Loop`)
        this.stateMachine.transition('writing')
        task.phase = 'writing'
        emitPhaseChange(this.mainWindow, task.id, 'writing')

        // 简单任务路径
        const result = await executeSingleTask(plan.subTasks[0], execContext, this.memoryContext, streamId)

        this.stateMachine.transition('finalizing')
        task.phase = 'finalizing'
        emitPhaseChange(this.mainWindow, task.id, 'finalizing')

        if (chapter && result.content && plan.intent === 'write') {
          this.commitMemoryAsync(project.id, chapter.id, chapter.title, result.content, config)
        }

        this.trajectory.record('complete', { success: true })
        emitTrajectory(this.mainWindow, this.trajectory.getTrajectory(result.content))
        finalizeTask(task, this.state, this.stateMachine)
        emitTaskComplete(this.mainWindow, task.id, result.content, 'finalizing', streamId)
        log.debug(`[WAC] 任务完成 (简单路径)`)
        return result.content
      }

      log.debug(`[WAC] 复杂任务，进入 Critic Loop`)
      const finalContent = await executeWithCriticLoop(
        task, execContext, this.mainWindow, this.stateMachine,
        this.memoryContext, this.abortController, streamId, this.trajectory
      )

      this.stateMachine.transition('finalizing')
      task.phase = 'finalizing'
      emitPhaseChange(this.mainWindow, task.id, 'finalizing')

      if (chapter && finalContent && task.intent === 'write') {
        this.commitMemoryAsync(project.id, chapter.id, chapter.title, finalContent, config)
      }

      this.trajectory.record('complete', { success: true })
        emitTrajectory(this.mainWindow, this.trajectory.getTrajectory(finalContent))
        finalizeTask(task, this.state, this.stateMachine)
        emitTaskComplete(this.mainWindow, task.id, finalContent, 'finalizing', streamId)
        log.debug(`[WAC] 任务完成 (Critic Loop 路径)`)
      return finalContent

    } catch (err) {
      const errorMsg = errorMessage(err) || 'Agent 执行失败'
      log.error(`[WAC] 任务失败: ${errorMsg}`)
      // 桥接回前端对话系统：使用前端传来的 streamId
      this.mainWindow.webContents.send('dialogue:error', { streamId: streamId || task.id, error: errorMsg })
      if (this.abortController?.signal.aborted) {
        this.stateMachine.forceTransition('idle')
        finalizeTask(task, this.state, this.stateMachine)
        throw new Error('任务已取消')
      }
      this.stateMachine.forceTransition('idle')
      finalizeTask(task, this.state, this.stateMachine)
      throw err
    } finally {
      this.abortController = null
    }
  }

  private commitMemoryAsync(projectId: string, chapterId: string, chapterTitle: string, content: string, config: import('../../shared/types').LLMConfigSingle): void {
    commitMemory(projectId, chapterId, chapterTitle, content, config)
      .catch(err => log.error('[Memory] 记忆提交失败:', err))
  }
}
