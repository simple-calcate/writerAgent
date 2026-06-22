import type { BrowserWindow } from 'electron'
import type {
  Project, Volume, Chapter, LLMConfigSingle, ContextConfig,
  IntentClassifierResult, AnalysisResult
} from '../../shared/types'
import { classifyIntent } from './intent-classifier'
import { executeAnalysisPipeline } from './analysis-pipeline'
import type { WriterAgentController } from './wac'
import { startDialogueStream } from '../llm/dialogue-stream'

export interface RouteContext {
  mainWindow: BrowserWindow
  project: Project
  volume: Volume | null
  chapter: Chapter | null
  level: 'book' | 'volume' | 'chapter'
  config: LLMConfigSingle
  signal?: AbortSignal
  streamId?: string
  messages?: { role: 'user' | 'assistant'; content: string }[]
  contextConfig?: ContextConfig
}

export type RouteResult =
  | { pipeline: 'writing'; streamId: string }
  | { pipeline: 'analysis'; result: AnalysisResult }
  | { pipeline: 'chat'; streamId: string }

export async function routeRequest(
  input: string,
  ctx: RouteContext,
  getWAC: () => WriterAgentController
): Promise<{ classification: IntentClassifierResult; result: RouteResult }> {
  const classification = await classifyIntent(input, ctx.config, ctx.signal)
  console.log(`[Router] intent=${classification.intent} confidence=${classification.confidence} method=${classification.method}`)

  switch (classification.intent) {
    case 'writing': {
      const streamId = ctx.streamId || `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      getWAC().processRequest(input, ctx.project, ctx.volume, ctx.chapter, ctx.level, streamId)
        .catch(err => {
          if (err.message !== '任务已取消') {
            console.error('[Router] Writing pipeline error:', err)
            ctx.mainWindow.webContents.send('dialogue:error', { streamId, error: err.message })
          }
        })
      return { classification, result: { pipeline: 'writing', streamId } }
    }

    case 'analysis': {
      const result = await executeAnalysisPipeline({
        content: input,
        project: ctx.project,
        volume: ctx.volume,
        chapter: ctx.chapter,
        config: ctx.config,
        mainWindow: ctx.mainWindow,
        signal: ctx.signal || new AbortController().signal
      })
      return { classification, result: { pipeline: 'analysis', result } }
    }

    case 'chat':
    case 'tool':
    default: {
      const messages = ctx.messages && ctx.messages.length > 0
        ? ctx.messages
        : [{ role: 'user' as const, content: input }]
      const streamResult = await startDialogueStream({
        config: ctx.config,
        mainWindow: ctx.mainWindow,
        level: ctx.level,
        project: ctx.project,
        volume: ctx.volume,
        chapter: ctx.chapter,
        allVolumes: [],
        allChapters: [],
        messages,
        contextConfig: ctx.contextConfig
      })
      return { classification, result: { pipeline: 'chat', streamId: streamResult.streamId } }
    }
  }
}
