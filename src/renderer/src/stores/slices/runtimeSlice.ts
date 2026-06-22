import type { StateCreator } from 'zustand'
import type {
  AgentRun, ExecutionNode, ExecutionEdge, MemoryState, ContextState,
  MultiAgentRun, MARole, AgentStatus, ExecutionTimeline
} from '../../../../shared/types'
import { AgentRuntime } from '../../runtime/AgentRuntime'
import { MultiAgentRuntime } from '../../runtime/MultiAgentRuntime'
import type { AppState } from '../useAppStore'

export interface RuntimeSlice {
  // v3 single-agent
  runtime: AgentRuntime
  currentRun: AgentRun | null

  runtimeStart: (input: string) => void
  runtimeUpdateNode: (nodeId: string, patch: Partial<ExecutionNode>) => void
  runtimeAddNode: (node: ExecutionNode) => void
  runtimeAddEdge: (edge: ExecutionEdge) => void
  runtimeRemoveNode: (nodeId: string) => void
  runtimeUpdateMemory: (patch: Partial<MemoryState>) => void
  runtimeUpdateContext: (patch: Partial<ContextState>) => void
  runtimePause: () => void
  runtimeResume: () => void
  runtimeFinish: (result: string) => void
  runtimeError: (message: string) => void
  runtimeReset: () => void

  // v4 multi-agent
  maRuntime: MultiAgentRuntime
  maRun: MultiAgentRun | null

  maStart: (roles?: MARole[]) => void
  maDispatch: (agentId: string, node: ExecutionNode) => void
  maUpdateNode: (agentId: string, nodeId: string, patch: Partial<ExecutionNode>) => void
  maAddEdge: (agentId: string, edge: ExecutionEdge) => void
  maSetAgentStatus: (agentId: string, status: AgentStatus) => void
  maUpdateMemory: (fact: string) => void
  maLogDecision: (decision: string) => void
  maLogConflict: (conflict: string) => void
  maPause: () => void
  maResume: () => void
  maReplay: (agentId?: string) => void
  maFinish: () => void
  maReset: () => void
}

export const createRuntimeSlice: StateCreator<AppState, [], [], RuntimeSlice> = (set, _get) => {
  // v3
  const runtime = new AgentRuntime()
  const sync = () => set({ currentRun: { ...runtime.getRun() } })
  runtime.on('start', sync)
  runtime.on('update', sync)
  runtime.on('pause', sync)
  runtime.on('resume', sync)
  runtime.on('finish', sync)
  runtime.on('error', sync)

  // v4
  const maRuntime = new MultiAgentRuntime()
  const maSync = () => set({ maRun: { ...maRuntime.getRun() } })
  maRuntime.on('dispatch', maSync)
  maRuntime.on('memory_update', maSync)
  maRuntime.on('conflict', maSync)
  maRuntime.on('pause', maSync)
  maRuntime.on('resume', maSync)
  maRuntime.on('replay', maSync)
  maRuntime.on('finish', maSync)
  maRuntime.on('update', maSync)

  return {
    // v3
    runtime,
    currentRun: null,

    runtimeStart: (input) => { runtime.start(input); sync() },
    runtimeUpdateNode: (nodeId, patch) => { runtime.updateNode(nodeId, patch); sync() },
    runtimeAddNode: (node) => { runtime.addNode(node); sync() },
    runtimeAddEdge: (edge) => { runtime.addEdge(edge); sync() },
    runtimeRemoveNode: (nodeId) => { runtime.removeNode(nodeId); sync() },
    runtimeUpdateMemory: (patch) => { runtime.updateMemory(patch); sync() },
    runtimeUpdateContext: (patch) => { runtime.updateContext(patch); sync() },
    runtimePause: () => { runtime.pause(); sync() },
    runtimeResume: () => { runtime.resume(); sync() },
    runtimeFinish: (result) => { runtime.finish(result); sync() },
    runtimeError: (message) => { runtime.error(message); sync() },
    runtimeReset: () => { runtime.reset(); sync() },

    // v4
    maRuntime,
    maRun: null,

    maStart: (roles) => { maRuntime.start(roles); maSync() },
    maDispatch: (agentId, node) => { maRuntime.dispatch(agentId, node); maSync() },
    maUpdateNode: (agentId, nodeId, patch) => { maRuntime.updateNode(agentId, nodeId, patch); maSync() },
    maAddEdge: (agentId, edge) => { maRuntime.addEdge(agentId, edge); maSync() },
    maSetAgentStatus: (agentId, status) => { maRuntime.setAgentStatus(agentId, status); maSync() },
    maUpdateMemory: (fact) => { maRuntime.updateMemory(fact); maSync() },
    maLogDecision: (decision) => { maRuntime.logDecision(decision); maSync() },
    maLogConflict: (conflict) => { maRuntime.logConflict(conflict); maSync() },
    maPause: () => { maRuntime.pause(); maSync() },
    maResume: () => { maRuntime.resume(); maSync() },
    maReplay: (agentId) => { maRuntime.replay(agentId); maSync() },
    maFinish: () => { maRuntime.finish(); maSync() },
    maReset: () => { maRuntime.start(); maSync() }
  }
}
