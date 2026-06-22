import { create } from 'zustand'
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice'
import { createChapterSlice, type ChapterSlice } from './slices/chapterSlice'
import { createVersionSlice, type VersionSlice } from './slices/versionSlice'
import { createUISlice, type UISlice } from './slices/uiSlice'
import { createPolishSlice, type PolishSlice } from './slices/polishSlice'
import { createSummarySlice, type SummarySlice } from './slices/summarySlice'
import { createDialogueSlice, type DialogueSlice } from './slices/dialogueSlice'
import { createContinuationSlice, type ContinuationSlice } from './slices/continuationSlice'
import { createSkillSlice, type SkillSlice } from './slices/skillSlice'
import { createReasoningSlice, type ReasoningSlice } from './slices/reasoningSlice'
import { createOutlineSlice, type OutlineSlice } from './slices/outlineSlice'
import { createImportSlice, type ImportSlice } from './slices/importSlice'
import { createRuntimeSlice, type RuntimeSlice } from './slices/runtimeSlice'

export type AppState = ProjectSlice &
  ChapterSlice &
  VersionSlice &
  UISlice &
  PolishSlice &
  SummarySlice &
  DialogueSlice &
  ContinuationSlice &
  SkillSlice &
  ReasoningSlice &
  OutlineSlice &
  ImportSlice &
  RuntimeSlice

export const useAppStore = create<AppState>()((...a) => ({
  ...createProjectSlice(...a),
  ...createChapterSlice(...a),
  ...createVersionSlice(...a),
  ...createUISlice(...a),
  ...createPolishSlice(...a),
  ...createSummarySlice(...a),
  ...createDialogueSlice(...a),
  ...createContinuationSlice(...a),
  ...createSkillSlice(...a),
  ...createReasoningSlice(...a),
  ...createOutlineSlice(...a),
  ...createImportSlice(...a),
  ...createRuntimeSlice(...a)
}))
