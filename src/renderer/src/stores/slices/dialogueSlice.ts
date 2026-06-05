import type { StateCreator } from 'zustand'
import type {
  ConversationMessage, Conversation, DialogueLevel,
  DialogueStreamChunk, DialogueStreamDone, DialogueStreamError,
  DialogueToolStart, DialogueToolDone, ToolCallInfo,
  DialogueToolApproval, DialogueToolApprovalResponse,
  DialogueThinkingChunk, DialogueThinkingDone
} from '../../../../shared/types'
import type { ProjectSlice } from './projectSlice'
import type { ChapterSlice } from './chapterSlice'
import type { UISlice } from './uiSlice'
import {
  createStreamChunkHandler,
  createToolStartHandler,
  createToolDoneHandler,
  createStreamDoneHandler,
  createStreamErrorHandler,
  createThinkingChunkHandler,
  createThinkingDoneHandler,
  createToolApprovalHandler,
  type DialogueSliceWithHandlers
} from './dialogueStreamHandlers'

export interface DialogueSlice {
  // State
  dialogueLevel: DialogueLevel | null
  dialogueEntityId: string | null
  dialogueMessages: ConversationMessage[]
  isStreaming: boolean
  streamingText: string
  activeStreamId: string | null
  dialogueError: string | null
  streamingToolCalls: ToolCallInfo[]
  isThinking: boolean
  thinkingText: string
  planModeActive: boolean
  pendingApprovals: DialogueToolApproval[]

  // Actions
  openDialogue: (level: DialogueLevel) => Promise<void>
  closeDialogue: () => void
  sendDialogueMessage: (content: string, reasoningChainIds?: string[], reasoningChainNames?: string[]) => Promise<void>
  cancelDialogueStream: () => void
  clearDialogue: () => Promise<void>
  approveTool: (approvalId: string, approved: boolean, refreshCache?: boolean) => void
  deleteMessage: (messageId: string) => Promise<void>

  // Internal handlers
  _handleStreamChunk: (data: DialogueStreamChunk) => void
  _handleStreamDone: (data: DialogueStreamDone) => void
  _handleStreamError: (data: DialogueStreamError) => void
  _handleToolStart: (data: DialogueToolStart) => void
  _handleToolDone: (data: DialogueToolDone) => void
  _handleToolApproval: (data: DialogueToolApproval) => void
  _handleThinkingChunk: (data: DialogueThinkingChunk) => void
  _handleThinkingDone: (data: DialogueThinkingDone) => void
}

// Unsubscribe functions stored outside the store
let _unsubscribeChunk: (() => void) | null = null
let _unsubscribeDone: (() => void) | null = null
let _unsubscribeError: (() => void) | null = null
let _unsubscribeToolStart: (() => void) | null = null
let _unsubscribeToolDone: (() => void) | null = null
let _unsubscribeToolApproval: (() => void) | null = null
let _unsubscribeThinkingChunk: (() => void) | null = null
let _unsubscribeThinkingDone: (() => void) | null = null

export const createDialogueSlice: StateCreator<
  DialogueSlice & ProjectSlice & ChapterSlice & UISlice,
  [],
  [],
  DialogueSlice
> = (set, get) => ({
  dialogueLevel: null,
  dialogueEntityId: null,
  dialogueMessages: [],
  isStreaming: false,
  streamingText: '',
  activeStreamId: null,
  dialogueError: null,
  streamingToolCalls: [],
  isThinking: false,
  thinkingText: '',
  pendingApprovals: [],
  planModeActive: false,

  openDialogue: async (level) => {
    const state = get()
    let entityId: string | null = null
    if (level === 'book') {
      entityId = state.currentProject?.id || null
    } else if (level === 'volume') {
      entityId = (state as any).currentVolumeId || null
    } else if (level === 'chapter') {
      entityId = state.currentChapter?.id || null
    }
    if (!entityId) return

    // Clean up previous listeners
    _unsubscribeChunk?.()
    _unsubscribeDone?.()
    _unsubscribeError?.()
    _unsubscribeToolStart?.()
    _unsubscribeToolDone?.()
    _unsubscribeToolApproval?.()
    _unsubscribeThinkingChunk?.()
    _unsubscribeThinkingDone?.()

    const conversation = await window.api.getConversation(level, entityId)

    // Register stream listeners
    _unsubscribeChunk = window.api.onDialogueChunk((data) => get()._handleStreamChunk(data))
    _unsubscribeDone = window.api.onDialogueDone((data) => get()._handleStreamDone(data))
    _unsubscribeError = window.api.onDialogueError((data) => get()._handleStreamError(data))
    _unsubscribeToolStart = window.api.onDialogueToolStart((data) => get()._handleToolStart(data))
    _unsubscribeToolDone = window.api.onDialogueToolDone((data) => get()._handleToolDone(data))
    _unsubscribeToolApproval = window.api.onDialogueToolApproval((data) => get()._handleToolApproval(data))
    _unsubscribeThinkingChunk = window.api.onDialogueThinkingChunk((data) => get()._handleThinkingChunk(data))
    _unsubscribeThinkingDone = window.api.onDialogueThinkingDone((data) => get()._handleThinkingDone(data))

    set({
      dialogueLevel: level,
      dialogueEntityId: entityId,
      dialogueMessages: conversation?.messages || [],
      isStreaming: false,
      streamingText: '',
      activeStreamId: null,
      dialogueError: null,
      streamingToolCalls: [],
      isThinking: false,
      thinkingText: '',
      pendingApprovals: [],
      rightPanel: 'dialogue'
    } as any)
  },

  closeDialogue: () => {
    _unsubscribeChunk?.()
    _unsubscribeDone?.()
    _unsubscribeError?.()
    _unsubscribeToolStart?.()
    _unsubscribeToolDone?.()
    _unsubscribeToolApproval?.()
    _unsubscribeThinkingChunk?.()
    _unsubscribeThinkingDone?.()
    _unsubscribeChunk = null
    _unsubscribeDone = null
    _unsubscribeError = null
    _unsubscribeToolStart = null
    _unsubscribeToolDone = null
    _unsubscribeToolApproval = null
    _unsubscribeThinkingChunk = null
    _unsubscribeThinkingDone = null

    set({
      dialogueLevel: null,
      dialogueEntityId: null,
      dialogueMessages: [],
      isStreaming: false,
      streamingText: '',
      activeStreamId: null,
      dialogueError: null,
      streamingToolCalls: [],
      isThinking: false,
      thinkingText: '',
      pendingApprovals: [],
      planModeActive: false
    })
  },

  sendDialogueMessage: async (content, reasoningChainIds?, reasoningChainNames?) => {
    const { dialogueLevel, dialogueEntityId, dialogueMessages } = get()
    if (!dialogueLevel || !dialogueEntityId) return

    const PLAN_TRIGGERS = ['规划', '计划', '大纲', '接下来怎么写', '剧情走向', '后续发展', '/plan']
    const isPlanMode = PLAN_TRIGGERS.some(k => content.includes(k))

    const userMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      reasoningChainIds,
      reasoningChainNames
    }

    const updatedMessages = [...dialogueMessages, userMsg]
    set({
      dialogueMessages: updatedMessages,
      isStreaming: true,
      streamingText: '',
      isThinking: false,
      thinkingText: '',
      dialogueError: null,
      streamingToolCalls: [],
      pendingApprovals: [],
      planModeActive: isPlanMode
    })

    try {
      // Build API message with reasoning chain tags for backend processing
      let messageForApi = content
      if (reasoningChainIds && reasoningChainIds.length > 0) {
        const chainTags = reasoningChainIds.map(id => `[reasoning:${id}]`).join('')
        messageForApi = `${chainTags} ${content}`
      }

      // 过滤掉已删除的消息，并将最后一条用户消息替换为带标签的版本
      const filteredMessages = updatedMessages.filter(m => !m.deleted)
      const lastUserMsgIndex = filteredMessages.length - 1
      const apiMessages = filteredMessages.map((m, i) => {
        // Use the tagged message for the last user message
        if (i === lastUserMsgIndex && m.role === 'user') {
          return { role: m.role, content: messageForApi }
        }
        return { role: m.role, content: m.content }
      })
      const { streamId } = await window.api.dialogueSend(dialogueLevel, dialogueEntityId, apiMessages)
      set({ activeStreamId: streamId })
    } catch (err: any) {
      set({ isStreaming: false, dialogueError: err.message })
    }
  },

  cancelDialogueStream: () => {
    const { activeStreamId } = get()
    if (activeStreamId) {
      window.api.dialogueCancel(activeStreamId)
      set({ isStreaming: false, activeStreamId: null })
    }
  },

  clearDialogue: async () => {
    const { dialogueLevel, dialogueEntityId } = get()
    if (dialogueLevel && dialogueEntityId) {
      await window.api.deleteConversation(dialogueLevel, dialogueEntityId)
    }
    set({ dialogueMessages: [], streamingText: '', dialogueError: null })
  },

  // Stream handlers - delegated to separate module
  _handleStreamChunk: createStreamChunkHandler(set, get as () => DialogueSliceWithHandlers),
  _handleToolStart: createToolStartHandler(set, get as () => DialogueSliceWithHandlers),
  _handleToolDone: createToolDoneHandler(set, get as () => DialogueSliceWithHandlers),
  _handleStreamDone: createStreamDoneHandler(set, get as () => DialogueSliceWithHandlers),
  _handleStreamError: createStreamErrorHandler(set, get as () => DialogueSliceWithHandlers),
  _handleThinkingChunk: createThinkingChunkHandler(set, get as () => DialogueSliceWithHandlers),
  _handleThinkingDone: createThinkingDoneHandler(set, get as () => DialogueSliceWithHandlers),
  _handleToolApproval: createToolApprovalHandler(set),

  approveTool: (approvalId, approved, refreshCache) => {
    window.api.dialogueApproveTool({ approvalId, approved, refreshCache })
    set((s: DialogueSlice) => ({ pendingApprovals: s.pendingApprovals.filter(a => a.approvalId !== approvalId) }))
  },

  deleteMessage: async (messageId) => {
    const { dialogueLevel, dialogueEntityId, dialogueMessages } = get()
    if (!dialogueLevel || !dialogueEntityId) return

    const updatedMessages = dialogueMessages.map(msg =>
      msg.id === messageId ? { ...msg, deleted: true } : msg
    )

    set({ dialogueMessages: updatedMessages })

    // 保存到数据库
    const conversation: Conversation = {
      id: `${dialogueLevel}-${dialogueEntityId}`,
      projectId: dialogueLevel === 'book' ? dialogueEntityId : null,
      volumeId: dialogueLevel === 'volume' ? dialogueEntityId : null,
      chapterId: dialogueLevel === 'chapter' ? dialogueEntityId : null,
      level: dialogueLevel,
      messages: updatedMessages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await window.api.saveConversation(conversation)
  }
})
