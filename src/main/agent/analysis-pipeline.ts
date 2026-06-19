import type { BrowserWindow } from 'electron'
import type {
  AnalysisResult,
  CriticScore,
  Project,
  Volume,
  Chapter,
  LLMConfigSingle,
  AgentExecutionContext
} from '../../shared/types'
import { executeCritic } from './critic'

export interface AnalysisPipelineParams {
  content: string
  project: Project
  volume: Volume | null
  chapter: Chapter | null
  config: LLMConfigSingle
  mainWindow: BrowserWindow
  signal: AbortSignal
}

export async function executeAnalysisPipeline(
  params: AnalysisPipelineParams
): Promise<AnalysisResult> {
  const { content, project, volume, chapter, config, mainWindow, signal } = params

  const taskContext: AgentExecutionContext['taskContext'] = {
    projectId: project.id,
    level: chapter ? 'chapter' : volume ? 'volume' : 'book',
    userRequest: content
  }
  if (volume) taskContext.volumeId = volume.id
  if (chapter) {
    taskContext.chapterId = chapter.id
    taskContext.currentContent = chapter.content
  }

  const context: AgentExecutionContext = {
    config,
    project,
    volume,
    chapter,
    outlines: [],
    skills: [],
    taskContext,
    mainWindow,
    signal
  }

  const score = await executeCritic(content, context)
  const summary = buildAnalysisSummary(score)

  return {
    targetContent: content,
    score,
    summary,
    timestamp: new Date().toISOString()
  }
}

function buildAnalysisSummary(score: CriticScore): string {
  const highlights: string[] = []
  const weak: string[] = []

  if (score.structure >= 8) highlights.push('结构')
  else if (score.structure < 6) weak.push('结构')
  if (score.pacing >= 8) highlights.push('节奏')
  else if (score.pacing < 6) weak.push('节奏')
  if (score.conflict >= 8) highlights.push('冲突')
  else if (score.conflict < 6) weak.push('冲突')
  if (score.infoDensity >= 8) highlights.push('信息密度')
  else if (score.infoDensity < 6) weak.push('信息密度')
  if (score.styleConsistency >= 8) highlights.push('文风')
  else if (score.styleConsistency < 6) weak.push('文风')

  const parts: string[] = [`综合评分 ${score.overall.toFixed(1)}/10`]
  if (highlights.length > 0) parts.push(`亮点：${highlights.join('、')}`)
  if (weak.length > 0) parts.push(`需改进：${weak.join('、')}`)
  if (score.issues.length > 0) parts.push(`问题：${score.issues[0]}`)

  return parts.join('；')
}
