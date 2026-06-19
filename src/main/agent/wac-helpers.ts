import type { BrowserWindow } from 'electron'
import type {
  WritingTask, WritingPhase, AgentIntent, SubTask, TaskContext,
  CriticScore, AgentResult, WACState, AgentExecutionContext,
  AgentPhaseChange, AgentSubTaskUpdate, AgentCriticResult, AgentTaskComplete,
  Project, Volume, Chapter, Outline, WritingSkill, LLMConfigSingle
} from '../../shared/types'
import { randomUUID } from 'crypto'
import { getOutline, getSkills, getChapters } from '../store/db'

// ─── Rewrite Approval ───

const pendingRewriteApprovals = new Map<string, {
  resolve: (approved: boolean) => void
}>()

export function waitForRewriteApproval(approvalId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingRewriteApprovals.delete(approvalId)
      resolve(false) // 超时默认不重写
    }, 5 * 60 * 1000)

    pendingRewriteApprovals.set(approvalId, {
      resolve: (approved) => {
        clearTimeout(timeout)
        pendingRewriteApprovals.delete(approvalId)
        resolve(approved)
      }
    })
  })
}

export function handleRewriteApprovalResponse(approvalId: string, approved: boolean): void {
  const pending = pendingRewriteApprovals.get(approvalId)
  if (pending) {
    pending.resolve(approved)
  }
}

// ─── Task Lifecycle ───

export function createTask(userRequest: string, taskContext: TaskContext): WritingTask {
  return {
    id: randomUUID(),
    intent: 'chat',
    description: userRequest,
    subTasks: [],
    phase: 'planning',
    context: taskContext,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

export function finalizeTask(task: WritingTask, state: WACState, stateMachine: { reset: () => void }): void {
  task.updatedAt = new Date().toISOString()
  state.taskHistory.push(task)
  state.currentTask = null
  stateMachine.reset()
}

// ─── Context Resolution ───

export function resolveOutlines(projectId: string, volumeId?: string, chapterId?: string): Outline[] {
  const outlines: Outline[] = []
  const bookOutline = getOutline('book', projectId)
  if (bookOutline) outlines.push(bookOutline)
  if (volumeId) {
    const volumeOutline = getOutline('volume', volumeId)
    if (volumeOutline) outlines.push(volumeOutline)
  }
  if (chapterId) {
    const chapterOutline = getOutline('chapter', chapterId)
    if (chapterOutline) outlines.push(chapterOutline)
  }
  return outlines
}

export function resolveSkills(project: Project): WritingSkill[] {
  const allSkills = getSkills()
  const skillIds = project.featureSkillIds?.dialogue || project.enabledSkillIds || []
  return skillIds.length > 0 ? allSkills.filter(s => skillIds.includes(s.id)) : []
}

export function resolvePreviousSummaries(chapter: Chapter | null): string[] {
  if (!chapter) return []
  const allChapters = getChapters(chapter.projectId)
  const chapterIndex = allChapters.findIndex(c => c.id === chapter.id)
  if (chapterIndex <= 0) return []
  const previous = allChapters.slice(Math.max(0, chapterIndex - 3), chapterIndex)
  return previous.filter(c => c.summaryResult).map(c => `【${c.title}】${c.summaryResult}`)
}

// ─── Formatting ───

export function formatCriticFeedback(score: CriticScore): string {
  return [
    `评分：${score.overall}/10`,
    `结构：${score.structure}/10，节奏：${score.pacing}/10，冲突：${score.conflict}/10`,
    `问题：${score.issues.join('；')}`,
    `建议：${score.suggestions.join('；')}`
  ].join('\n')
}

export function isSimpleTask(plan: { intent: AgentIntent; subTasks: SubTask[] }): boolean {
  if (plan.subTasks.length === 1 && plan.subTasks[0].agentRole === 'writer') return true
  if (plan.intent === 'chat' || plan.intent === 'summarize') return true
  return false
}

// ─── Event Emission ───

export function emitPhaseChange(mainWindow: BrowserWindow, taskId: string, phase: WritingPhase): void {
  mainWindow.webContents.send('agent:phase-change', { taskId, phase } satisfies AgentPhaseChange)
}

export function emitSubTaskUpdate(mainWindow: BrowserWindow, taskId: string, subTaskId: string, status: SubTask['status'], result?: AgentResult): void {
  mainWindow.webContents.send('agent:subtask-update', { taskId, subTaskId, status, result } satisfies AgentSubTaskUpdate)
}

export function emitCriticResult(mainWindow: BrowserWindow, taskId: string, score: CriticScore): void {
  mainWindow.webContents.send('agent:critic-result', { taskId, score } satisfies AgentCriticResult)
}

export function emitTaskComplete(mainWindow: BrowserWindow, taskId: string, result: string, writingPhase: WritingPhase): void {
  mainWindow.webContents.send('agent:task-complete', { taskId, result, writingPhase } satisfies AgentTaskComplete)
  // 桥接回前端对话系统
  mainWindow.webContents.send('dialogue:done', { streamId: taskId, fullText: result })
}
