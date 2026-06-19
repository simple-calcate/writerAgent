# Intent-Driven Agent OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the writing-focused agent system into an intent-driven Agent OS with a unified Intent Classifier → Task Router → Pipeline architecture.

**Architecture:** All user input flows through a rule-based Intent Classifier (with LLM fallback for ambiguous cases). A Task Router dispatches to specialized pipelines: Writing (existing WAC), Analysis (new Critic pipeline), Chat/QA/Tool (existing dialogue-stream). The `/agent` prefix requirement is removed — intent classification is the default.

**Tech Stack:** TypeScript, Electron IPC, existing LLM layer (createClient, callWithTools, callLLMSync)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/types/agent.ts` | Modify | Add `PipelineIntent`, `IntentClassifierResult`, `AnalysisResult` types |
| `src/main/agent/intent-classifier.ts` | Create | Rule-based + LLM fallback intent classification |
| `src/main/agent/task-router.ts` | Create | Route intent to pipeline, unified entry point |
| `src/main/agent/analysis-pipeline.ts` | Create | Analysis pipeline: content → Critic → structured score |
| `src/main/agent/runtime.ts` | Modify | Replace WAC-only with Router-based dispatch |
| `src/main/agent/index.ts` | Modify | Export new modules |
| `src/main/ipc-handlers/ai.ts` | Modify | Remove `/agent` prefix check, use router for all input |
| `src/main/ipc-handlers/agent.ts` | Modify | Simplify to use router |
| `src/main/agent/CLAUDE.md` | Modify | Update docs |

---

### Task 1: Add Intent & Pipeline Types

**Covers:** Intent classification type system

**Files:**
- Modify: `src/shared/types/agent.ts`

- [ ] **Step 1: Add new types to agent.ts**

Add after the existing `AgentIntent` type (line ~14):

```typescript
// Pipeline-level intent (simplified from AgentIntent)
export type PipelineIntent =
  | 'writing'     // 写作/生成内容（含 continue, revise, plan）
  | 'analysis'    // 分析/评价/评分
  | 'chat'        // 普通对话/问答/闲聊
  | 'tool'        // 工具调用（润色、摘要等）

// Intent classifier result
export interface IntentClassifierResult {
  intent: PipelineIntent
  confidence: number        // 0-1
  method: 'rule' | 'llm'   // classification method used
  originalInput: string
  reasoning?: string        // LLM reasoning (only for llm method)
}

// Analysis pipeline result
export interface AnalysisResult {
  targetContent: string     // 被分析的内容
  score: CriticScore        // 复用 CriticScore
  summary: string           // 一句话总结
  timestamp: string
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: PASS (new types are additive, no breakage)

---

### Task 2: Create Intent Classifier

**Covers:** Rule-based + LLM fallback classification

**Files:**
- Create: `src/main/agent/intent-classifier.ts`

- [ ] **Step 1: Create intent-classifier.ts**

```typescript
import type { PipelineIntent, IntentClassifierResult, LLMConfigSingle } from '../../shared/types'
import { callLLMSync } from './base-agent'

// Rule-based keyword patterns
const WRITING_PATTERNS = [
  /写[一这下个]?[章段节篇]/, /续写/, /重写/, /修改[一这下]/, /润色/,
  /创作/, /生成/, /编写/, /扩写/, /缩写/, /改写/,
  /写[一这]?[首诗歌]/, /帮我写/, /写[个一]故事/, /写[个一]小说/,
  /续[写下去]/, /接着写/, /往下写/, /继续写/,
  /规划[一这]?[下个]?[章段节篇]?/, /大纲/, /剧情走向/, /后续发展/,
  /怎么写/, /接下来/, /构思/, /设定/
]

const ANALYSIS_PATTERNS = [
  /评[价分估]/, /评估/, /打分/, /评分/, /打[个一]?分/,
  /写得[怎如]么[样度]/, /好不好/, /水平/, /质量/,
  /分析[一这]?[下个]?/, /看看[这这]?[段个章]/, /检查[一这]?[下个]?/,
  /有什[么麽]问题/, /改进/, /优化建议/, /不足/,
  /怎么样/, /如何[评改优]/
]

const TOOL_PATTERNS = [
  /润色/, /摘要/, /总结[一这]?[下个]?/, /精炼/,
  /翻译/, /导出/, /导入/, /搜索/, /查找/
]

const CHAT_PATTERNS = [
  /你[是谁是]/, /你好/, /谢谢/, /帮[我忙]/,
  /什么是/, /怎么[用使设配操]/, /如何/, /为什么/,
  /能不能/, /可以[吗嘛呢]/, /有[没无]/
]

function classifyByRules(input: string): { intent: PipelineIntent; confidence: number } | null {
  const text = input.trim().toLowerCase()

  for (const pattern of WRITING_PATTERNS) {
    if (pattern.test(text)) return { intent: 'writing', confidence: 0.9 }
  }
  for (const pattern of ANALYSIS_PATTERNS) {
    if (pattern.test(text)) return { intent: 'analysis', confidence: 0.85 }
  }
  for (const pattern of TOOL_PATTERNS) {
    if (pattern.test(text)) return { intent: 'tool', confidence: 0.85 }
  }
  for (const pattern of CHAT_PATTERNS) {
    if (pattern.test(text)) return { intent: 'chat', confidence: 0.7 }
  }

  return null
}

const CLASSIFIER_PROMPT = `你是一个意图分类器。根据用户输入，判断其意图类别。

类别定义：
- writing：生成、续写、修改、润色、规划大纲等创作相关
- analysis：评价、打分、分析、检查质量、找问题等评估相关
- chat：闲聊、问答、求助等非创作对话
- tool：润色、摘要、翻译等工具性操作

只返回 JSON：{"intent":"类别","confidence":0.9,"reasoning":"简短理由"}`

async function classifyByLLM(input: string, config: LLMConfigSingle, signal?: AbortSignal): Promise<{ intent: PipelineIntent; confidence: number; reasoning: string }> {
  const result = await callLLMSync({
    config,
    messages: [
      { role: 'system', content: CLASSIFIER_PROMPT },
      { role: 'user', content: input }
    ],
    temperature: 0.1,
    maxTokens: 200,
    signal
  })

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { intent: 'chat', confidence: 0.5, reasoning: 'LLM 返回格式错误' }
    const parsed = JSON.parse(jsonMatch[0])
    const validIntents: PipelineIntent[] = ['writing', 'analysis', 'chat', 'tool']
    const intent = validIntents.includes(parsed.intent) ? parsed.intent : 'chat'
    return { intent, confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7, reasoning: parsed.reasoning || '' }
  } catch {
    return { intent: 'chat', confidence: 0.5, reasoning: 'JSON 解析失败' }
  }
}

export async function classifyIntent(
  input: string,
  config?: LLMConfigSingle,
  signal?: AbortSignal
): Promise<IntentClassifierResult> {
  const ruleResult = classifyByRules(input)
  if (ruleResult && ruleResult.confidence >= 0.8) {
    return { ...ruleResult, method: 'rule', originalInput: input }
  }

  // LLM fallback for ambiguous cases
  if (config) {
    try {
      const llmResult = await classifyByLLM(input, config, signal)
      return { ...llmResult, method: 'llm', originalInput: input }
    } catch {
      // LLM failed, use rule result or default to chat
      if (ruleResult) return { ...ruleResult, method: 'rule', originalInput: input }
      return { intent: 'chat', confidence: 0.5, method: 'rule', originalInput: input }
    }
  }

  // No config available, use rule result or default
  if (ruleResult) return { ...ruleResult, method: 'rule', originalInput: input }
  return { intent: 'chat', confidence: 0.5, method: 'rule', originalInput: input }
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: PASS

---

### Task 3: Create Analysis Pipeline

**Covers:** Structured evaluation via Critic Agent

**Files:**
- Create: `src/main/agent/analysis-pipeline.ts`

- [ ] **Step 1: Create analysis-pipeline.ts**

```typescript
import type { BrowserWindow } from 'electron'
import type { AnalysisResult, CriticScore, Project, Volume, Chapter, LLMConfigSingle } from '../../shared/types'
import { executeCritic } from './critic'
import type { AgentExecutionContext } from '../../shared/types'

export interface AnalysisPipelineParams {
  content: string        // user's analysis request text
  project: Project
  volume: Volume | null
  chapter: Chapter | null
  config: LLMConfigSingle
  mainWindow: BrowserWindow
  signal: AbortSignal
}

export async function executeAnalysisPipeline(params: AnalysisPipelineParams): Promise<AnalysisResult> {
  const { content, project, volume, chapter, config, mainWindow, signal } = params

  const context: AgentExecutionContext = {
    config,
    project,
    volume,
    chapter,
    outlines: [],
    skills: [],
    taskContext: {
      projectId: project.id,
      volumeId: volume?.id,
      chapterId: chapter?.id,
      level: chapter ? 'chapter' : volume ? 'volume' : 'book',
      userRequest: content,
      currentContent: chapter?.content,
      outline: undefined,
      previousSummaries: undefined,
      styleProfile: project.aiConfig?.customPrompt || undefined
    },
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
  const parts: string[] = []
  parts.push(`综合评分：${score.overall}/10`)

  const dims = [
    { name: '结构', value: score.structure },
    { name: '节奏', value: score.pacing },
    { name: '冲突', value: score.conflict },
    { name: '信息密度', value: score.infoDensity },
    { name: '文风一致性', value: score.styleConsistency }
  ]

  const weakest = dims.reduce((a, b) => a.value < b.value ? a : b)
  const strongest = dims.reduce((a, b) => a.value > b.value ? a : b)

  if (strongest.value >= 7) parts.push(`亮点：${strongest.name}（${strongest.value}分）`)
  if (weakest.value < 6) parts.push(`需改进：${weakest.name}（${weakest.value}分）`)

  if (score.issues.length > 0) {
    parts.push(`问题：${score.issues.slice(0, 3).join('；')}`)
  }

  return parts.join('。')
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: PASS

---

### Task 4: Create Task Router

**Covers:** Unified routing dispatch

**Files:**
- Create: `src/main/agent/task-router.ts`

- [ ] **Step 1: Create task-router.ts**

```typescript
import type { BrowserWindow } from 'electron'
import type { PipelineIntent, IntentClassifierResult, AnalysisResult, Project, Volume, Chapter, LLMConfigSingle } from '../../shared/types'
import { classifyIntent } from './intent-classifier'
import { executeAnalysisPipeline } from './analysis-pipeline'
import type { WriterAgentController } from './wac'
import type { StartDialogueStreamFn } from './types'

export interface RouteContext {
  mainWindow: BrowserWindow
  project: Project
  volume: Volume | null
  chapter: Chapter | null
  level: 'book' | 'volume' | 'chapter'
  config: LLMConfigSingle
  signal?: AbortSignal
}

export type RouteResult =
  | { pipeline: 'writing'; streamId: string }
  | { pipeline: 'analysis'; result: AnalysisResult }
  | { pipeline: 'chat'; streamId: string }

export interface TaskRouterDeps {
  getWAC: () => WriterAgentController
  startDialogueStream: StartDialogueStreamFn
}

export async function routeRequest(
  input: string,
  ctx: RouteContext,
  deps: TaskRouterDeps
): Promise<{ classification: IntentClassifierResult; result: RouteResult }> {
  const classification = await classifyIntent(input, ctx.config, ctx.signal)

  console.log(`[Router] 意图分类: ${classification.intent} (confidence=${classification.confidence}, method=${classification.method})`)

  switch (classification.intent) {
    case 'writing': {
      const streamId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      deps.getWAC().processRequest(input, ctx.project, ctx.volume, ctx.chapter, ctx.level, streamId)
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
      const messages = [{ role: 'user' as const, content: input }]
      const streamResult = await deps.startDialogueStream({
        config: ctx.config,
        mainWindow: ctx.mainWindow,
        level: ctx.level,
        project: ctx.project,
        volume: ctx.volume,
        chapter: ctx.chapter,
        allVolumes: [],
        allChapters: [],
        messages,
        contextConfig: undefined
      })
      return { classification, result: { pipeline: 'chat', streamId: streamResult.streamId } }
    }
  }
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: PASS (will need type stubs for imports)

---

### Task 5: Update AgentRuntime to Use Router

**Covers:** Replace WAC-only dispatch with intent-driven routing

**Files:**
- Modify: `src/main/agent/runtime.ts`

- [ ] **Step 1: Rewrite runtime.ts**

Replace the full content of `runtime.ts` with:

```typescript
import type { BrowserWindow } from 'electron'
import type { Project, Volume, Chapter, LLMConfigSingle } from '../../shared/types'
import type { IntentClassifierResult, AnalysisResult } from '../../shared/types'
import { WriterAgentController } from './wac'
import { routeRequest, type RouteResult } from './task-router'
import { startDialogueStream } from '../llm/dialogue'

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

  async route(
    input: string,
    project: Project,
    volume: Volume | null,
    chapter: Chapter | null,
    level: 'book' | 'volume' | 'chapter',
    config: LLMConfigSingle,
    signal?: AbortSignal
  ): Promise<{ classification: IntentClassifierResult; result: RouteResult }> {
    return routeRequest(input, {
      mainWindow: this.mainWindow,
      project, volume, chapter, level, config, signal
    }, {
      getWAC: () => this.getWAC(),
      startDialogueStream: (params) => startDialogueStream(params)
    })
  }

  getState() {
    return this.wac?.getState() ?? { currentTask: null, phase: 'idle', taskHistory: [] }
  }

  cancel(): void {
    this.wac?.cancel()
  }

  dispose(): void {
    this.cancel()
    this.wac = null
  }
}

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
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: PASS

---

### Task 6: Update IPC Handlers — Remove /agent Prefix, Use Router

**Covers:** Unified entry point for all dialogue

**Files:**
- Modify: `src/main/ipc-handlers/ai.ts`

- [ ] **Step 1: Modify dialogue:send handler**

In `ai.ts`, replace the `/agent` prefix detection block (lines ~149-165) with:

```typescript
    // All input goes through intent classification → router
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    const userContent = lastUserMsg?.content || ''

    // Only /compress remains as explicit command
    // All other input flows through the router
    const runtime = getAgentRuntime(mainWindow)
    const streamId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    try {
      const { classification, result } = await runtime.route(
        userContent, project, volume, chapter, level, config
      )

      if (result.pipeline === 'analysis') {
        // Analysis returns structured result — send as dialogue message
        const analysisMsg = formatAnalysisForDialogue(result.result)
        mainWindow.webContents.send('dialogue:chunk', { streamId, chunk: analysisMsg })
        mainWindow.webContents.send('dialogue:done', { streamId })
        return { streamId }
      }

      // writing or chat pipeline — streamId already active
      return { streamId }
    } catch (err: any) {
      console.error('[Dialogue] Router error:', err)
      // Fallback to original dialogue stream
      return startDialogueStream({
        config,
        mainWindow,
        level,
        project,
        volume,
        chapter,
        allVolumes,
        allChapters,
        aiConfig: resolveAIConfig(project),
        messages,
        contextConfig: getContextConfig()
      })
    }
```

- [ ] **Step 2: Add formatAnalysisForDialogue helper**

Add above the handler function:

```typescript
function formatAnalysisForDialogue(result: import('../../shared/types').AnalysisResult): string {
  const { score, summary } = result
  const lines = [
    `## 内容分析报告`,
    '',
    `**综合评分：${score.overall}/10**`,
    '',
    '| 维度 | 评分 |',
    '|------|------|',
    `| 结构完整性 | ${score.structure}/10 |`,
    `| 节奏 | ${score.pacing}/10 |`,
    `| 冲突强度 | ${score.conflict}/10 |`,
    `| 信息密度 | ${score.infoDensity}/10 |`,
    `| 文风一致性 | ${score.styleConsistency}/10 |`,
    ''
  ]

  if (score.issues.length > 0) {
    lines.push('### 发现的问题')
    score.issues.forEach(issue => lines.push(`- ${issue}`))
    lines.push('')
  }

  if (score.suggestions.length > 0) {
    lines.push('### 改进建议')
    score.suggestions.forEach(s => lines.push(`- ${s}`))
    lines.push('')
  }

  lines.push(`> ${summary}`)

  return lines.join('\n')
}
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: PASS

---

### Task 7: Update Agent IPC Handler

**Covers:** Simplify agent.ts to use router

**Files:**
- Modify: `src/main/ipc-handlers/agent.ts`

- [ ] **Step 1: Add route handler to agent.ts**

Add a new handler for the router-based entry:

```typescript
  ipcMain.handle('agent:route', async (_e, level: DialogueLevel, entityId: string, input: string) => {
    const projects = getProjects()
    const project = projects.find(p => {
      if (level === 'book') return p.id === entityId
      if (level === 'volume') {
        const volumes = getVolumes(p.id)
        return volumes.some(v => v.id === entityId)
      }
      const chapters = getChapters(p.id)
      return chapters.some(c => c.id === entityId)
    })
    if (!project) throw new Error('找不到对应的项目')

    const allVolumes = getVolumes(project.id)
    const allChapters = getChapters(project.id)

    let volume: Volume | null = null
    let chapter: Chapter | null = null

    if (level === 'volume') {
      volume = allVolumes.find(v => v.id === entityId) || null
    } else if (level === 'chapter') {
      chapter = allChapters.find(c => c.id === entityId) || null
      if (chapter && chapter.volumeId) {
        volume = allVolumes.find(v => v.id === chapter!.volumeId) || null
      }
    }

    const config = resolveFeatureConfig('dialogue')
    if (!config) throw new Error('对话功能未启用')
    if (!config.apiKey) throw new Error('请先配置 API Key')

    const { classification, result } = await runtime.route(input, project, volume, chapter, level, config)
    return { classification, result }
  })
```

- [ ] **Step 2: Update imports in agent.ts**

Add `resolveFeatureConfig` to the imports:

```typescript
import { getProjects, getVolumes, getChapters, resolveFeatureConfig } from '../store/db'
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: PASS

---

### Task 8: Update Types & Exports

**Covers:** IPCAPI type updates, barrel file updates

**Files:**
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/main/agent/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add agentRoute to IPCAPI**

In `ipc.ts`, add after `agentGetState`:

```typescript
  agentRoute: (level: DialogueLevel, entityId: string, input: string) => Promise<{ classification: any; result: any }>
```

- [ ] **Step 2: Update agent/index.ts exports**

Add to `index.ts`:

```typescript
export { classifyIntent } from './intent-classifier'
export { routeRequest } from './task-router'
export { executeAnalysisPipeline } from './analysis-pipeline'
```

- [ ] **Step 3: Add preload bridge for agentRoute**

In `preload/index.ts`, add after `agentGetState`:

```typescript
  agentRoute: (level: DialogueLevel, entityId: string, input: string) =>
    ipcRenderer.invoke('agent:route', level, entityId, input),
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit -p tsconfig.main.json`
Expected: PASS

---

### Task 9: Update Frontend — Remove /agent Command Check

**Covers:** Frontend no longer needs /agent prefix

**Files:**
- Modify: `src/renderer/src/components/dialogue-panel/DialoguePanel.tsx`

- [ ] **Step 1: Remove /agent command block**

In `DialoguePanel.tsx`, remove lines 229-236 (the `/agent` command detection block):

```typescript
      // /agent 命令 → 作为普通消息发送（后端识别前缀路由到 Agent 系统）
      if (command === '/agent') {
        const agentRequest = text.replace(/^\/agent\s*/, '')
        if (agentRequest) {
          sendDialogueMessage(text)
        }
        return
      }
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit -p tsconfig.renderer.json`
Expected: PASS

---

### Task 10: Update CLAUDE.md Documentation

**Covers:** Documentation updates

**Files:**
- Modify: `src/main/agent/CLAUDE.md`

- [ ] **Step 1: Update agent/CLAUDE.md**

Update the directory structure and core flow sections:

```markdown
# Agent 模块

## 概述
Intent-Driven Agent OS 核心模块。所有用户输入通过意图分类 → 任务路由 → 专用 Pipeline 处理。

## 目录结构

```
agent/
├── index.ts              # barrel file
├── intent-classifier.ts  # 意图分类器（规则 + LLM 回退）
├── task-router.ts        # 任务路由器（intent → pipeline 分发）
├── analysis-pipeline.ts  # 分析 Pipeline（Critic 评分 + 结构化报告）
├── wac.ts                # Writer Agent Controller（写作 Pipeline）
├── wac-critic-loop.ts    # Critic Loop 执行逻辑
├── wac-helpers.ts        # 辅助方法
├── runtime.ts            # Agent Runtime（统一管理，含 Router）
├── base-agent.ts         # LLM 调用基础
├── planner.ts            # Planner Agent
├── writer.ts             # Writer Agent
├── critic.ts             # Critic Agent
├── editor.ts             # Editor Agent
├── state-machine.ts      # 写作状态机
├── rewrite-strategy.ts   # 重写策略
├── score-trend.ts        # 评分趋势
├── task-executor.ts      # 任务图执行器
├── task-resolver.ts      # 依赖图解析
└── visualization.ts      # Agent 可视化
```

## 核心流程

```
用户输入 → Intent Classifier（规则优先，LLM 回退）
       → Task Router
       → Pipeline 分发：
          writing  → WAC（Planner → Writer → Critic Loop）
          analysis → Critic Agent → 结构化评分报告
          chat/tool → dialogue-stream（原有对话系统 + 工具）
```

## Pipeline 类型

| Pipeline | 触发条件 | 处理方式 |
|----------|----------|----------|
| writing | 创作/续写/修改/规划 | WAC + Critic Loop |
| analysis | 评价/打分/分析 | Critic Agent → AnalysisResult |
| chat | 闲聊/问答 | dialogue-stream |
| tool | 润色/摘要/翻译 | dialogue-stream |

## 常见任务

- **修改意图分类规则**：intent-classifier.ts 的 WRITING_PATTERNS 等
- **添加新 Pipeline**：创建 xxx-pipeline.ts，在 task-router.ts 添加 case
- **修改分析输出格式**：analysis-pipeline.ts 的 buildAnalysisSummary
- **修改路由逻辑**：task-router.ts 的 routeRequest
```

---

## Self-Review Checklist

- [ ] All `PipelineIntent` values used in router match classifier output
- [ ] `AnalysisResult` reuses existing `CriticScore` type (no duplication)
- [ ] `routeRequest` handles all 4 intents: writing, analysis, chat, tool
- [ ] Fallback to `startDialogueStream` on router error (graceful degradation)
- [ ] `/compress` command preserved in frontend
- [ ] No breaking changes to existing IPC events (agent:chunk, dialogue:chunk, etc.)
- [ ] Frontend `/agent` command removal doesn't break other commands
