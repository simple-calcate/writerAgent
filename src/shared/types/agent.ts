// ─── Writer Agent System Types ───

// 意图类型
export type AgentIntent =
  | 'write'          // 写作/生成内容
  | 'plan'           // 规划/大纲
  | 'critique'       // 评审/评分
  | 'edit'           // 编辑/润色
  | 'chat'           // 普通对话
  | 'research'       // 研究/检索
  | 'continue'       // 续写
  | 'summarize'      // 摘要
  | 'revise'         // 修改/重写

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

// 写作状态机状态
export type WritingPhase =
  | 'idle'           // 空闲
  | 'planning'       // 规划中
  | 'writing'        // 写作中
  | 'critic_check'   // 评审检查中
  | 'revision'       // 修改中
  | 'finalizing'     // 定稿中
  | 'memory_commit'  // 记忆提交中

// Agent 角色
export type AgentRole = 'planner' | 'writer' | 'critic' | 'editor' | 'researcher'

// Agent 执行结果
export interface AgentResult {
  agentRole: AgentRole
  success: boolean
  content: string
  metadata?: Record<string, unknown>
  error?: string
}

// Critic 评分结果
export interface CriticScore {
  overall: number           // 0-10
  structure: number         // 结构完整性 0-10
  pacing: number            // 节奏 0-10
  conflict: number          // 冲突强度 0-10
  infoDensity: number       // 信息密度 0-10
  styleConsistency: number  // 文风一致性 0-10
  issues: string[]          // 发现的问题
  suggestions: string[]     // 修改建议
  shouldRewrite: boolean    // 是否需要重写
  rewriteInstructions?: string  // 重写指令
}

// 任务拆解结果
export interface SubTask {
  id: string
  description: string
  agentRole: AgentRole
  priority: number
  dependsOn?: string[]      // 依赖的子任务 ID
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  result?: AgentResult
}

// 写作任务
export interface WritingTask {
  id: string
  intent: AgentIntent
  description: string
  subTasks: SubTask[]
  phase: WritingPhase
  context: TaskContext
  createdAt: string
  updatedAt: string
}

// 任务上下文
export interface TaskContext {
  projectId: string
  volumeId?: string
  chapterId?: string
  level: 'book' | 'volume' | 'chapter'
  userRequest: string
  currentContent?: string
  outline?: string
  previousSummaries?: string[]
  styleProfile?: string
}

// WAC 状态
export interface WACState {
  currentTask: WritingTask | null
  phase: WritingPhase
  taskHistory: WritingTask[]
}

// Agent 配置
export interface AgentConfig {
  role: AgentRole
  temperature?: number
  maxTokens?: number
  systemPromptOverride?: string
}

// Agent 执行上下文（传给每个 agent 的共享上下文）
export interface AgentExecutionContext {
  config: import('./api').LLMConfigSingle
  project: import('./models').Project
  volume?: import('./models').Volume | null
  chapter?: import('./models').Chapter | null
  outlines: import('./models').Outline[]
  skills: import('./models').WritingSkill[]
  taskContext: TaskContext
  mainWindow: import('electron').BrowserWindow
  signal: AbortSignal
}

// ─── IPC 事件类型 ───

export interface AgentPhaseChange {
  taskId: string
  phase: WritingPhase
  agentRole?: AgentRole
}

export interface AgentSubTaskUpdate {
  taskId: string
  subTaskId: string
  status: SubTask['status']
  result?: AgentResult
}

export interface AgentCriticResult {
  taskId: string
  score: CriticScore
}

export interface AgentTaskComplete {
  taskId: string
  result: string
  writingPhase: WritingPhase
}

// ─── Agent Visualization Types ───

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

// ─── Memory System Types ───

// 记忆层级
export type MemoryLayer = 'working' | 'episodic' | 'semantic' | 'style' | 'summary'

// 事件记忆条目（Episodic Memory）
export interface EpisodicMemoryEntry {
  id: string
  projectId: string
  chapterId: string
  chapterTitle: string
  events: PlotEvent[]
  summary: string
  emotionalTone: string
  keyDecisions: string[]
  createdAt: string
  updatedAt: string
}

export interface PlotEvent {
  id: string
  description: string
  characters: string[]
  location: string
  importance: 'low' | 'medium' | 'high' | 'critical'
  consequences: string[]
}

// 语义记忆条目（Semantic Memory - 世界观/设定）
export interface SemanticMemoryEntry {
  id: string
  projectId: string
  category: 'worldbuilding' | 'character' | 'setting' | 'rule' | 'lore'
  name: string
  content: string
  relations: SemanticRelation[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface SemanticRelation {
  targetId: string
  type: 'related_to' | 'part_of' | 'opposes' | 'supports' | 'depends_on'
  description: string
}

// 风格记忆条目（Style Memory）
export interface StyleMemoryEntry {
  id: string
  projectId: string
  aspect: 'tone' | 'vocabulary' | 'sentence_structure' | 'dialogue_style' | 'pacing' | 'custom'
  pattern: string
  examples: string[]
  confidence: number    // 0-1，置信度
  source: 'user_defined' | 'learned' | 'inferred'
  createdAt: string
  updatedAt: string
}

// 对话摘要条目（语义压缩产物）
export interface DialogueSummaryEntry {
  id: string
  projectId: string
  level: string
  entityId: string
  summary: string
  messageCount: number
  compressedAt: string
}

// 项目记忆集合
export interface ProjectMemory {
  projectId: string
  episodic: EpisodicMemoryEntry[]
  semantic: SemanticMemoryEntry[]
  style: StyleMemoryEntry[]
  dialogue: DialogueSummaryEntry[]
  lastUpdated: string
}

// agentRoute 返回的 result 联合类型（对应 task-router 三条 pipeline）
export type AgentRouteResult =
  | { pipeline: 'writing'; streamId: string }
  | { pipeline: 'analysis'; result: AnalysisResult }
  | { pipeline: 'chat'; streamId: string }

// agent:rewrite-approval 事件载荷
export interface AgentRewriteApprovalEvent {
  approvalId: string
  taskId: string
  score: CriticScore
  strategy: string
  instruction: string
  round: number
}
