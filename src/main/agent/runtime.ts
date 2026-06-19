import type { BrowserWindow } from 'electron'
import type { Project, Volume, Chapter, LLMConfigSingle, IntentClassifierResult } from '../../shared/types'
import { routeRequest, type RouteResult } from './task-router'
import { WriterAgentController } from './wac'

/**
 * Agent Runtime - 统一管理所有 Agent 实例
 * 
 * 职责：
 * - 管理 WAC 实例的生命周期
 * - 提供统一的调用接口
 * - 处理取消和错误
 */
export class AgentRuntime {
  private mainWindow: BrowserWindow
  private wac: WriterAgentController | null = null

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  private getWAC(): WriterAgentController {
    if (!this.wac) {
      this.wac = new WriterAgentController(this.mainWindow)
    }
    return this.wac
  }

  /**
   * 处理用户请求（主入口）
   * 自动创建/复用 WAC 实例
   */
  async processRequest(
    userRequest: string,
    project: Project,
    volume: Volume | null,
    chapter: Chapter | null,
    level: 'book' | 'volume' | 'chapter',
    streamId?: string
  ): Promise<string> {
    return this.getWAC().processRequest(userRequest, project, volume, chapter, level, streamId)
  }

  /**
   * 意图驱动路由（主入口）
   * 所有对话输入统一走此方法
   */
  async route(
    input: string,
    project: Project,
    volume: Volume | null,
    chapter: Chapter | null,
    level: 'book' | 'volume' | 'chapter',
    config: LLMConfigSingle,
    signal?: AbortSignal,
    streamId?: string
  ): Promise<{ classification: IntentClassifierResult; result: RouteResult }> {
    return routeRequest(input, {
      mainWindow: this.mainWindow,
      project, volume, chapter, level, config, signal, streamId
    }, () => this.getWAC())
  }

  /**
   * 获取当前状态
   */
  getState() {
    return this.wac?.getState() ?? { currentTask: null, phase: 'idle', taskHistory: [] }
  }

  /**
   * 取消当前任务
   */
  cancel(): void {
    this.wac?.cancel()
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.cancel()
    this.wac = null
  }
}

// ─── 全局实例管理 ───

let globalRuntime: AgentRuntime | null = null

export function getAgentRuntime(mainWindow: BrowserWindow): AgentRuntime {
  if (!globalRuntime) {
    globalRuntime = new AgentRuntime(mainWindow)
  }
  return globalRuntime
}

export function disposeAgentRuntime(): void {
  if (globalRuntime) {
    globalRuntime.dispose()
    globalRuntime = null
  }
}
