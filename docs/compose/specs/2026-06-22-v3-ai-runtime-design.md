# v3 AI Runtime Visualization System — Design Spec

## [S1] Problem

The current UI is a "data display" — it renders messages and tool calls as flat lists. There is no unified runtime model, no event-driven state management, and no graph-based visualization of AI execution. The UI directly reads Zustand state without an intermediary runtime layer.

## [S2] Solution Overview

Introduce a 3-layer v3 architecture:

```
Data Model (types) → Runtime Controller (AgentRuntime) → UI Components (React)
```

- **Data Model**: `AgentRun`, `ExecutionNode`, `ExecutionEdge`, `MemoryState`, `ContextState` in `src/shared/types/runtime.ts`
- **Runtime**: `AgentRuntime` class in renderer that manages state transitions and emits events
- **UI**: DAG-based `ExecutionGraphView`, `MemoryPanel`, `InspectorPanel`, `CommandCenter` replacing/enhancing existing DialoguePanel sections

## [S3] Data Model

### AgentRun
```typescript
export type AgentRunState = "idle" | "running" | "paused" | "done" | "error"

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
```

### ExecutionNode
```typescript
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
  metadata?: { tokens?: number; cost?: number }
}
```

### ExecutionEdge
```typescript
export interface ExecutionEdge {
  from: string
  to: string
}
```

### MemoryState
```typescript
export interface MemoryState {
  shortTerm: string[]
  longTerm: string[]
  embeddings?: number[]
}
```

### ContextState
```typescript
export interface ContextState {
  windowSize: number
  usedTokens: number
  compressionRatio: number
}
```

## [S4] Runtime Controller

`AgentRuntime` class manages an `AgentRun` instance and emits events to the UI store.

```
Methods:
  start(input)           → create run, state = "running"
  updateNode(id, patch)  → merge node fields, emit "update"
  addNode(node)          → append to nodes, emit "update"
  addEdge(edge)          → append to edges, emit "update"
  pause() / resume()     → state toggle
  finish(result)         → state = "done"
  error(message)         → state = "error"
  getRun()               → current AgentRun snapshot
  on(event, cb)          → subscribe to events
  off(event, cb)         → unsubscribe
```

Integration: `runtimeSlice` in Zustand holds the current `AgentRun`. Streaming handlers from `dialogueSlice` feed `AgentRuntime.updateNode()`.

## [S5] UI Components

### ExecutionGraphView
- Renders nodes as cards in a vertical DAG layout
- Each node shows: StatusDot + label + output preview
- Edges rendered as vertical connectors between nodes
- Running node gets `scale-[1.02]` + pulse animation
- Replaces the flat `ExecutionTimeline` in DialoguePanel

### MemoryPanel
- Shows short-term memory (recent context items)
- Shows long-term memory (persistent knowledge)
- Collapsible sections
- Located in System Inspector area

### InspectorPanel
- Shows: state, node count, tokens used, context window usage
- Replaces/enhances existing `ContextUsageBar` + `SystemInspector`

### CommandCenter
- Enhanced `InputDock` with run state awareness
- Shows current run state badge
- Pause/Resume controls when run is active

### OutputStream
- Existing streaming message area (no structural change)
- Feeds from `AgentRun.result` when complete

## [S6] File Plan

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `src/shared/types/runtime.ts` | v3 types |
| EDIT | `src/shared/types/index.ts` | re-export runtime.ts |
| CREATE | `src/renderer/src/runtime/AgentRuntime.ts` | Runtime controller |
| CREATE | `src/renderer/src/stores/slices/runtimeSlice.ts` | Zustand slice |
| EDIT | `src/renderer/src/stores/useAppStore.ts` | integrate runtimeSlice |
| CREATE | `src/renderer/src/components/dialogue/ExecutionGraphView.tsx` | DAG visualization |
| CREATE | `src/renderer/src/components/dialogue/MemoryPanel.tsx` | Memory display |
| CREATE | `src/renderer/src/components/dialogue/InspectorPanel.tsx` | System inspector |
| EDIT | `src/renderer/src/components/dialogue/CommandCenter.tsx` | Enhanced input (or modify InputDock) |
| EDIT | `src/renderer/src/components/dialogue-panel/DialoguePanel.tsx` | Integrate new components |
| EDIT | `src/renderer/src/components/dialogue/index.ts` | re-export new components |
| EDIT | `docs/ui-design-system.md` | update to v3 |

## [S7] Non-Goals

- No changes to main process / IPC handlers
- No changes to data persistence (store.json)
- No new npm dependencies
- No changes to the editor or sidebar components
