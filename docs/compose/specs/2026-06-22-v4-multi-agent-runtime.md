# v4 Multi-Agent Runtime — Design Spec

## [S1] Problem

v3 has a single-agent execution model. The project already has multi-agent concepts (`AgentRole`, `SubTask`, `WritingTask`) but the runtime and UI only visualize one agent's linear flow. There's no shared memory, no parallel execution lanes, no conflict tracking, and no replay capability.

## [S2] Solution Overview

Upgrade to a multi-agent runtime where:
- Each agent (planner/executor/critic/researcher) has its own execution graph
- Agents share a global memory (facts, decisions, conflicts)
- UI shows parallel execution lanes per agent
- Conflicts between agents are logged and displayed
- State supports running/paused/replaying/done

v4 types layer on top of v3 (reuse `ExecutionNode`, `ExecutionEdge`). Single-agent mode = `MultiAgentRun` with 1 `AgentInstance`.

## [S3] Data Model

### MultiAgentRun
```typescript
export type MultiAgentRunState = "running" | "paused" | "replaying" | "done"

export interface MultiAgentRun {
  id: string
  agents: AgentInstance[]
  sharedMemory: GlobalMemory
  timeline: ExecutionTimeline[]
  state: MultiAgentRunState
}
```

### AgentInstance
```typescript
export type AgentRole = "planner" | "executor" | "critic" | "researcher"
export type AgentStatus = "idle" | "active" | "blocked"

export interface AgentInstance {
  id: string
  role: AgentRole
  status: AgentStatus
  currentNodeId?: string
  graph: ExecutionGraph
}
```

### ExecutionGraph (reuses v3 types)
```typescript
export interface ExecutionGraph {
  nodes: ExecutionNode[]
  edges: ExecutionEdge[]
}
```

### GlobalMemory
```typescript
export interface GlobalMemory {
  facts: string[]
  decisions: string[]
  embeddings?: number[]
  conflictLog: string[]
}
```

### ExecutionTimeline
```typescript
export interface ExecutionTimeline {
  agentId: string
  nodes: ExecutionNode[]
  timestamp: number
}
```

## [S4] Runtime Engine

`MultiAgentRuntime` class manages `MultiAgentRun`:

```
dispatch(agentId, node)    → add node to agent's graph
updateMemory(fact)         → add to sharedMemory.facts
logDecision(decision)      → add to sharedMemory.decisions
logConflict(conflict)      → add to sharedMemory.conflictLog
pause() / resume()         → state toggle
replay(agentId)            → state = "replaying"
finish()                   → state = "done"
getAgent(id)               → specific agent instance
on(event, cb)              → subscribe
```

## [S5] UI Components

### MultiAgentCanvas
- Renders one `AgentLane` per agent
- Each lane shows agent role badge + horizontal node flow
- Active agent lane highlighted

### AgentSidebar
- Compact list of agents with status dots
- Click to focus/expand a specific agent

### MemoryGraphView
- Shows sharedMemory.facts, decisions, conflictLog
- Collapsible sections

### ConflictResolver
- Displays conflictLog entries
- Future: resolution UI

### ExecutionInspector
- System stats: agent count, state, memory size, total nodes

### CommandCenter (upgraded)
- Multi-agent state badge
- Pause/Resume/Replay controls

## [S6] File Plan

| Action | File | Purpose |
|--------|------|---------|
| EDIT | `src/shared/types/runtime.ts` | Add v4 types (keep v3) |
| CREATE | `src/renderer/src/runtime/MultiAgentRuntime.ts` | Multi-agent runtime |
| EDIT | `src/renderer/src/stores/slices/runtimeSlice.ts` | Add multi-agent state + actions |
| CREATE | `src/renderer/src/components/dialogue/MultiAgentCanvas.tsx` | Multi-lane canvas |
| CREATE | `src/renderer/src/components/dialogue/AgentSidebar.tsx` | Agent list |
| CREATE | `src/renderer/src/components/dialogue/MemoryGraphView.tsx` | Shared memory view |
| CREATE | `src/renderer/src/components/dialogue/ConflictResolver.tsx` | Conflict display |
| CREATE | `src/renderer/src/components/dialogue/ExecutionInspector.tsx` | System stats |
| EDIT | `src/renderer/src/components/dialogue/CommandCenter.tsx` | Multi-agent controls |
| EDIT | `src/renderer/src/components/dialogue-panel/DialoguePanel.tsx` | Integrate v4 |
| EDIT | `src/renderer/src/components/dialogue/index.ts` | Re-exports |
| EDIT | `docs/ui-design-system.md` | Update to v4 |
