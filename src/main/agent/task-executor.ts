import type { SubTask, AgentResult, AgentExecutionContext } from '../../shared/types'
import { executeWriter } from './writer'
import { executeCritic } from './critic'
import { executePlanner } from './planner'
import { resolveDependencyLayers } from './task-resolver'

export interface TaskExecutionResult {
  completedTasks: Map<string, AgentResult>
  failedTasks: Map<string, string>
  executionOrder: string[][]
}

async function executeSingleSubTask(
  subTask: SubTask,
  context: AgentExecutionContext,
  streamId?: string,
  depResults?: Map<string, AgentResult>
): Promise<AgentResult> {
  let additionalContext = ''
  if (depResults && subTask.dependsOn && subTask.dependsOn.length > 0) {
    const depParts: string[] = []
    for (const depId of subTask.dependsOn) {
      const depResult = depResults.get(depId)
      if (depResult) depParts.push(depResult.content.substring(0, 1000))
    }
    if (depParts.length > 0) {
      additionalContext = `\n\n## 前置任务结果\n${depParts.join('\n\n---\n\n')}`
    }
  }

  const instruction = additionalContext
    ? `${subTask.description}${additionalContext}`
    : subTask.description

  switch (subTask.agentRole) {
    case 'planner':
    case 'researcher': {
      const result = await executePlanner(instruction, context)
      return { agentRole: subTask.agentRole, success: true, content: JSON.stringify(result) }
    }
    case 'writer': {
      const content = await executeWriter({ instruction, context, streamId, existingContent: context.taskContext.currentContent })
      return { agentRole: 'writer', success: true, content }
    }
    case 'critic': {
      const score = await executeCritic(context.taskContext.currentContent || instruction, context)
      return { agentRole: 'critic', success: true, content: JSON.stringify(score), metadata: { score } }
    }
    case 'editor': {
      const { executeEditor: exec } = await import('./editor')
      const result = await exec({ content: context.taskContext.currentContent || instruction, instruction, context })
      return { agentRole: 'editor', success: true, content: result.editedContent, metadata: { changes: result.changes, summary: result.summary } }
    }
    default:
      return { agentRole: subTask.agentRole, success: false, content: '', error: `未知的 agent 角色: ${subTask.agentRole}` }
  }
}

async function executeLayer(
  layer: SubTask[],
  context: AgentExecutionContext,
  completedTasks: Map<string, AgentResult>,
  onTaskUpdate?: (taskId: string, status: SubTask['status'], result?: AgentResult) => void,
  streamId?: string
): Promise<void> {
  const writerTasks = layer.filter(t => t.agentRole === 'writer')
  const otherTasks = layer.filter(t => t.agentRole !== 'writer')

  if (otherTasks.length > 0) {
    const promises = otherTasks.map(async task => {
      task.status = 'running'
      onTaskUpdate?.(task.id, 'running')
      try {
        const result = await executeSingleSubTask(task, context, undefined, completedTasks)
        task.result = result
        task.status = 'done'
        completedTasks.set(task.id, result)
        onTaskUpdate?.(task.id, 'done', result)
      } catch (err: any) {
        task.status = 'failed'
        task.result = { agentRole: task.agentRole, success: false, content: '', error: err.message }
        onTaskUpdate?.(task.id, 'failed', task.result)
      }
    })
    await Promise.all(promises)
  }

  for (const task of writerTasks) {
    task.status = 'running'
    onTaskUpdate?.(task.id, 'running')
    try {
      const result = await executeSingleSubTask(task, context, streamId, completedTasks)
      task.result = result
      task.status = 'done'
      completedTasks.set(task.id, result)
      onTaskUpdate?.(task.id, 'done', result)
    } catch (err: any) {
      task.status = 'failed'
      task.result = { agentRole: task.agentRole, success: false, content: '', error: err.message }
      onTaskUpdate?.(task.id, 'failed', task.result)
    }
  }
}

export async function executeTaskGraph(
  subTasks: SubTask[],
  context: AgentExecutionContext,
  onTaskUpdate?: (taskId: string, status: SubTask['status'], result?: AgentResult) => void,
  streamId?: string
): Promise<TaskExecutionResult> {
  const layers = resolveDependencyLayers(subTasks)
  const completedTasks = new Map<string, AgentResult>()
  const failedTasks = new Map<string, string>()
  const executionOrder: string[][] = []

  for (const layer of layers) {
    executionOrder.push(layer.map(t => t.id))
    await executeLayer(layer, context, completedTasks, onTaskUpdate, streamId)
    for (const task of layer) {
      if (task.status === 'failed' && task.result?.error) {
        failedTasks.set(task.id, task.result.error)
      }
    }
  }

  return { completedTasks, failedTasks, executionOrder }
}
