import type { WritingPhase } from '../../shared/types'

export type TransitionGuard = (from: WritingPhase, to: WritingPhase, context: Record<string, unknown>) => boolean

export interface StateTransition {
  from: WritingPhase
  to: WritingPhase
  guard?: TransitionGuard
  onTransition?: (from: WritingPhase, to: WritingPhase) => void
}

export interface StateSnapshot {
  phase: WritingPhase
  previousPhase: WritingPhase | null
  transitionCount: number
  enteredAt: string
  history: Array<{ from: WritingPhase; to: WritingPhase; at: string }>
}

const VALID_TRANSITIONS: Record<WritingPhase, WritingPhase[]> = {
  idle: ['planning'],
  planning: ['writing', 'idle'],
  writing: ['critic_check', 'finalizing', 'idle'],
  critic_check: ['revision', 'finalizing', 'writing', 'idle'],
  revision: ['writing', 'critic_check', 'finalizing', 'idle'],
  finalizing: ['memory_commit', 'idle'],
  memory_commit: ['idle']
}

export class WritingStateMachine {
  private phase: WritingPhase = 'idle'
  private previousPhase: WritingPhase | null = null
  private transitionCount = 0
  private enteredAt: string = new Date().toISOString()
  private history: Array<{ from: WritingPhase; to: WritingPhase; at: string }> = []
  private listeners: Array<(snapshot: StateSnapshot) => void> = []
  private guards: TransitionGuard[] = []

  get currentPhase(): WritingPhase {
    return this.phase
  }

  get snapshot(): StateSnapshot {
    return {
      phase: this.phase,
      previousPhase: this.previousPhase,
      transitionCount: this.transitionCount,
      enteredAt: this.enteredAt,
      history: [...this.history]
    }
  }

  addGuard(guard: TransitionGuard): void {
    this.guards.push(guard)
  }

  onStateChange(listener: (snapshot: StateSnapshot) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx >= 0) this.listeners.splice(idx, 1)
    }
  }

  /**
   * 尝试状态转换
   * @returns true 如果转换成功
   */
  transition(to: WritingPhase, context: Record<string, unknown> = {}): boolean {
    if (!this.canTransition(to)) {
      return false
    }

    for (const guard of this.guards) {
      if (!guard(this.phase, to, context)) {
        return false
      }
    }

    const from = this.phase
    this.previousPhase = from
    this.phase = to
    this.transitionCount++
    this.enteredAt = new Date().toISOString()
    this.history.push({ from, to, at: this.enteredAt })

    this.notifyListeners()
    return true
  }

  canTransition(to: WritingPhase): boolean {
    return VALID_TRANSITIONS[this.phase]?.includes(to) ?? false
  }

  /**
   * 强制转换（跳过守卫检查，用于错误恢复）
   */
  forceTransition(to: WritingPhase): void {
    const from = this.phase
    this.previousPhase = from
    this.phase = to
    this.transitionCount++
    this.enteredAt = new Date().toISOString()
    this.history.push({ from, to, at: this.enteredAt })
    this.notifyListeners()
  }

  /**
   * 重置到空闲状态
   */
  reset(): void {
    if (this.phase !== 'idle') {
      this.forceTransition('idle')
    }
    this.history = []
    this.transitionCount = 0
  }

  /**
   * 从快照恢复状态
   */
  restore(snapshot: StateSnapshot): void {
    this.phase = snapshot.phase
    this.previousPhase = snapshot.previousPhase
    this.transitionCount = snapshot.transitionCount
    this.enteredAt = snapshot.enteredAt
    this.history = [...snapshot.history]
    this.notifyListeners()
  }

  private notifyListeners(): void {
    const snapshot = this.snapshot
    for (const listener of this.listeners) {
      try {
        listener(snapshot)
      } catch { /* 不让监听器错误影响状态机 */ }
    }
  }
}

/**
 * 创建带默认守卫的状态机
 */
export function createWritingStateMachine(): WritingStateMachine {
  const sm = new WritingStateMachine()

  // 默认守卫：确保从 critic_check 进入 revision 时有问题列表
  sm.addGuard((from, to, ctx) => {
    if (from === 'critic_check' && to === 'revision') {
      return !!ctx.hasIssues
    }
    return true
  })

  // 默认守卫：确保从 writing 进入 critic_check 时有内容
  sm.addGuard((from, to, ctx) => {
    if (from === 'writing' && to === 'critic_check') {
      return !!ctx.hasContent
    }
    return true
  })

  return sm
}
