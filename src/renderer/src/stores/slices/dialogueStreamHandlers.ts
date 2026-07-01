import type { StateCreator } from 'zustand'
import type {
  ConversationMessage, Conversation,
  DialogueStreamChunk, DialogueStreamDone, DialogueStreamError,
  DialogueToolStart, DialogueToolDone, ToolCallInfo,
  DialogueToolApproval
} from '../../../../shared/types'
import type { ProjectSlice } from './projectSlice'
import type { ChapterSlice } from './chapterSlice'
import type { UISlice } from './uiSlice'
import type { DialogueSlice } from './dialogueSlice'

export type DialogueSliceWithHandlers = DialogueSlice & ProjectSlice & ChapterSlice & UISlice

export const createStreamChunkHandler = (set: any, get: () => DialogueSliceWithHandlers) => (data: DialogueStreamChunk) => {
  const { activeStreamId } = get()
  if (data.streamId !== activeStreamId) return
  set((s: DialogueSlice) => ({
    streamingText: s.streamingText + data.chunk,
    ...(s.isThinking ? { isThinking: false } : {})
  }))
}

export const createToolStartHandler = (set: any, get: () => DialogueSliceWithHandlers) => (data: DialogueToolStart) => {
  const { activeStreamId } = get()
  if (data.streamId !== activeStreamId) return

  const TOOL_DISPLAY: Record<string, string> = {
    summarize_chapter: '章节摘要',
    refine_summary: '精炼总结',
    polish_text: '文本润色',
    create_chapter: '创建章节',
    rename_chapter: '重命名章节',
    write_outline: '撰写书籍大纲',
    write_volume_outline: '撰写卷纲',
    write_chapter_outline: '撰写章纲',
    read_chapter_content: '查看章节内容',
    write_chapter_content: '撰写章节内容'
  }

  const newTool: ToolCallInfo = {
    id: data.toolCallId,
    toolName: data.toolName,
    displayName: TOOL_DISPLAY[data.toolName] || data.toolName,
    args: data.args,
    status: 'running'
  }

  set((s: DialogueSlice) => ({ streamingToolCalls: [...s.streamingToolCalls, newTool] }))
}

export const createToolDoneHandler = (set: any, get: () => DialogueSliceWithHandlers) => (data: DialogueToolDone) => {
  const { activeStreamId, currentProject } = get()
  if (data.streamId !== activeStreamId) return

  const toolCall = get().streamingToolCalls.find((tc: ToolCallInfo) => tc.id === data.toolCallId)
  const toolName = toolCall?.toolName

  set((s: DialogueSlice) => ({
    streamingToolCalls: s.streamingToolCalls.map((tc: ToolCallInfo) =>
      tc.id === data.toolCallId
        ? { ...tc, status: 'done' as const, result: data.result }
        : tc
    )
  }))

  if (currentProject && data.result && !data.result.startsWith('错误')) {
    if (toolName === 'create_chapter' || toolName === 'rename_chapter' || toolName === 'write_chapter_content') {
      get().loadChapters(currentProject.id)
    }
    if (toolName === 'create_volume' || toolName === 'write_volume_outline') {
      get().loadVolumes(currentProject.id)
    }
  }
}

export const createStreamDoneHandler = (set: any, get: () => DialogueSliceWithHandlers) => async (data: DialogueStreamDone) => {
  const { activeStreamId, dialogueMessages, dialogueLevel, dialogueEntityId, streamingText, streamingToolCalls, thinkingText } = get()
  if (data.streamId !== activeStreamId) return

  // 任务被取消：重置 streaming 状态，但不保存空消息
  if (data.cancelled) {
    set({
      isStreaming: false,
      streamingText: '',
      isThinking: false,
      thinkingText: '',
      activeStreamId: null,
      streamingToolCalls: [],
      planModeActive: false
    })
    return
  }

  const assistantMsg: ConversationMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: data.fullText || streamingText,
    timestamp: new Date().toISOString(),
    toolCalls: streamingToolCalls.length > 0 ? [...streamingToolCalls] : undefined,
    thinkingContent: thinkingText || undefined,
    reasoningContext: data.reasoningContext || undefined
  }

  const allMessages = [...dialogueMessages, assistantMsg]

  set({
    dialogueMessages: allMessages,
    isStreaming: false,
    streamingText: '',
    isThinking: false,
    thinkingText: '',
    activeStreamId: null,
    streamingToolCalls: [],
    planModeActive: false
  })

  if (dialogueLevel && dialogueEntityId) {
    const conversation: Conversation = {
      id: `${dialogueLevel}-${dialogueEntityId}`,
      projectId: dialogueLevel === 'book' ? dialogueEntityId : null,
      volumeId: dialogueLevel === 'volume' ? dialogueEntityId : null,
      chapterId: dialogueLevel === 'chapter' ? dialogueEntityId : null,
      level: dialogueLevel,
      messages: allMessages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await window.api.saveConversation(conversation)
  }
}

export const createStreamErrorHandler = (set: any, get: () => DialogueSliceWithHandlers) => (data: DialogueStreamError) => {
  const { activeStreamId } = get()
  if (data.streamId !== activeStreamId) return
  set({
    isStreaming: false,
    isThinking: false,
    thinkingText: '',
    dialogueError: data.error,
    activeStreamId: null,
    planModeActive: false
  })
}

export const createThinkingChunkHandler = (set: any, get: () => DialogueSliceWithHandlers) => (data: { streamId: string; chunk: string }) => {
  const { activeStreamId } = get()
  if (data.streamId !== activeStreamId) return
  set((s: DialogueSlice) => ({
    isThinking: true,
    thinkingText: s.thinkingText + data.chunk
  }))
}

export const createThinkingDoneHandler = (set: any, get: () => DialogueSliceWithHandlers) => (data: { streamId: string }) => {
  const { activeStreamId } = get()
  if (data.streamId !== activeStreamId) return
  set({ isThinking: false })
}

export const createToolApprovalHandler = (set: any) => (data: DialogueToolApproval) => {
  set((s: DialogueSlice) => ({ pendingApprovals: [...s.pendingApprovals, data] }))
}
