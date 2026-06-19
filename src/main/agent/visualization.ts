import type { BrowserWindow } from 'electron'
import type {
  WritingPhase, AgentRole, CriticScore, SubTask, AgentResult
} from '../../shared/types'

export interface FlowNode {
  id: string
  type: 'planner' | 'writer' | 'critic' | 'editor' | 'researcher' | 'start' | 'end'
  label: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  startTime?: string
  endTime?: string
  duration?: number
  metadata?: Record<string, unknown>
}

export interface FlowEdge {
  from: string
  to: string
  label?: string
}

export interface AgentFlowSnapshot {
  taskId: string
  phase: WritingPhase
  nodes: FlowNode[]
  edges: FlowEdge[]
  currentNodeId: string | null
  criticScores: CriticScore[]
  timestamp: string
}

export interface TrajectoryEntry {
  timestamp: string
  event: 'phase_change' | 'subtask_start' | 'subtask_done' | 'subtask_failed' | 'critic_score' | 'rewrite' | 'complete'
  data: Record<string, unknown>
}

export interface WritingTrajectory {
  taskId: string
  projectId: string
  entries: TrajectoryEntry[]
  finalContent?: string
  totalDuration?: number
  createdAt: string
}

// ─── Flow Builder ───

export function buildAgentFlow(
  taskId: string,
  phase: WritingPhase,
  subTasks: SubTask[],
  criticScores: CriticScore[]
): AgentFlowSnapshot {
  const nodes: FlowNode[] = [{ id: 'start', type: 'start', label: '开始', status: 'done' }]

  for (const task of subTasks) {
    nodes.push({
      id: task.id,
      type: task.agentRole,
      label: task.description.substring(0, 30),
      status: task.status,
      metadata: task.result ? { success: task.result.success } : undefined
    })
  }

  nodes.push({ id: 'end', type: 'end', label: '完成', status: phase === 'finalizing' ? 'done' : 'pending' })

  const edges: FlowEdge[] = []
  if (nodes.length > 1) {
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ from: nodes[i].id, to: nodes[i + 1].id })
    }
  }

  for (const task of subTasks) {
    if (task.dependsOn) {
      for (const depId of task.dependsOn) {
        edges.push({ from: depId, to: task.id, label: '依赖' })
      }
    }
  }

  const currentNodeId = subTasks.find(t => t.status === 'running')?.id || null

  return { taskId, phase, nodes, edges, currentNodeId, criticScores, timestamp: new Date().toISOString() }
}

// ─── Trajectory Recorder ───

export class TrajectoryRecorder {
  private entries: TrajectoryEntry[] = []
  private taskId: string
  private projectId: string
  private startTime: number

  constructor(taskId: string, projectId: string) {
    this.taskId = taskId
    this.projectId = projectId
    this.startTime = Date.now()
  }

  record(event: TrajectoryEntry['event'], data: Record<string, unknown> = {}): void {
    this.entries.push({ timestamp: new Date().toISOString(), event, data })
  }

  getTrajectory(finalContent?: string): WritingTrajectory {
    return {
      taskId: this.taskId,
      projectId: this.projectId,
      entries: [...this.entries],
      finalContent,
      totalDuration: Date.now() - this.startTime,
      createdAt: new Date(this.startTime).toISOString()
    }
  }

  getEntryCount(): number {
    return this.entries.length
  }
}

// ─── IPC Emitter ───

export function emitAgentFlow(mainWindow: BrowserWindow, snapshot: AgentFlowSnapshot): void {
  mainWindow.webContents.send('agent:flow-update', snapshot)
}

export function emitTrajectory(mainWindow: BrowserWindow, trajectory: WritingTrajectory): void {
  mainWindow.webContents.send('agent:trajectory', trajectory)
}
