import type { StateCreator } from 'zustand'
import type { ReasoningStepResult } from '../../../../shared/types'

export interface ReasoningSlice {
  // State
  showReasoningPanel: boolean
  reasoningSessionId: string | null
  reasoningChainName: string
  reasoningSteps: { id: string; name: string }[]
  reasoningStepResults: Map<string, ReasoningStepResult>
  reasoningStatus: 'running' | 'completed' | 'error' | 'idle'
  reasoningIncludeInContext: boolean

  // Actions
  toggleReasoningPanel: () => void
  _handleReasoningStart: (data: any) => void
  _handleReasoningStepStart: (data: any) => void
  _handleReasoningStepDone: (data: any) => void
  _handleReasoningStepError: (data: any) => void
  _handleReasoningDone: (data: any) => void
}

export const createReasoningSlice: StateCreator<
  ReasoningSlice,
  [],
  [],
  ReasoningSlice
> = (set) => ({
  showReasoningPanel: false,
  reasoningSessionId: null,
  reasoningChainName: '',
  reasoningSteps: [],
  reasoningStepResults: new Map(),
  reasoningStatus: 'idle',
  reasoningIncludeInContext: false,

  toggleReasoningPanel: () => set(s => ({ showReasoningPanel: !s.showReasoningPanel })),

  _handleReasoningStart: (data) => {
    set({
      showReasoningPanel: true,
      reasoningSessionId: data.sessionId,
      reasoningChainName: data.chainName,
      reasoningSteps: data.steps,
      reasoningStepResults: new Map(),
      reasoningStatus: 'running',
      reasoningIncludeInContext: false
    })
  },

  _handleReasoningStepStart: (data) => {
    set(s => {
      const newResults = new Map(s.reasoningStepResults)
      newResults.set(data.stepId, {
        chainId: '',
        stepId: data.stepId,
        stepName: data.stepName,
        result: '',
        status: 'running'
      })
      return { reasoningStepResults: newResults }
    })
  },

  _handleReasoningStepDone: (data) => {
    set(s => {
      const newResults = new Map(s.reasoningStepResults)
      newResults.set(data.stepId, {
        chainId: '',
        stepId: data.stepId,
        stepName: data.stepName,
        result: data.result,
        status: 'done'
      })
      return { reasoningStepResults: newResults }
    })
  },

  _handleReasoningStepError: (data) => {
    set(s => {
      const newResults = new Map(s.reasoningStepResults)
      newResults.set(data.stepId, {
        chainId: '',
        stepId: data.stepId,
        stepName: data.stepName,
        result: `错误: ${data.error}`,
        status: 'error'
      })
      return { reasoningStepResults: newResults }
    })
  },

  _handleReasoningDone: (data) => {
    set({
      reasoningStatus: data.status,
      reasoningIncludeInContext: data.includeInContext
    })
  }
})
