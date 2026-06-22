// ─── v3 AI Runtime Types ───

export type AgentRunState = "idle" | "running" | "paused" | "done" | "error"

export type ExecutionNodeType = "tool" | "thinking" | "retrieval" | "rewrite"

export type ExecutionNodeStatus = "pending" | "running" | "done" | "error"

export interface ExecutionNode {
  id: string
  type: ExecutionNodeType
  label: string
  status: ExecutionNodeStatus
  input?: unknown
  output?: unknown
  startTime?: number
  endTime?: number
  metadata?: {
    tokens?: number
    cost?: number
  }
}

export interface ExecutionEdge {
  from: string
  to: string
}

export interface MemoryState {
  shortTerm: string[]
  longTerm: string[]
  embeddings?: number[]
}

export interface ContextState {
  windowSize: number
  usedTokens: number
  compressionRatio: number
}

export interface AgentRun {
  id: string
  input: string
  state: AgentRunState
  nodes: ExecutionNode[]
  edges: ExecutionEdge[]
  memory: MemoryState
  context: ContextState
  result?: string
}

// ─── v4 Multi-Agent Runtime Types ───

export type MultiAgentRunState = "running" | "paused" | "replaying" | "done"

export type MARole = "planner" | "executor" | "critic" | "researcher"

export type AgentStatus = "idle" | "active" | "blocked"

export interface ExecutionGraph {
  nodes: ExecutionNode[]
  edges: ExecutionEdge[]
}

export interface AgentInstance {
  id: string
  role: MARole
  status: AgentStatus
  currentNodeId?: string
  graph: ExecutionGraph
}

export interface GlobalMemory {
  facts: string[]
  decisions: string[]
  embeddings?: number[]
  conflictLog: string[]
}

export interface ExecutionTimeline {
  agentId: string
  nodes: ExecutionNode[]
  timestamp: number
}

export interface MultiAgentRun {
  id: string
  agents: AgentInstance[]
  sharedMemory: GlobalMemory
  timeline: ExecutionTimeline[]
  state: MultiAgentRunState
}
