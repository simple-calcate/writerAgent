// Memory module barrel file
export { recordMemory, getMemoryContext, commitMemory, getMemorySummary, clearMemory, buildMemorySystemPrompt, getDialogueSummaries } from './manager'
export type { MemoryEvent, MemoryContext } from './manager'

export { getEpisodicMemories, getEpisodicByChapter, extractEpisodicMemory, getEpisodicContext } from './episodic'
export { getSemanticMemories, getSemanticByCategory, extractSemanticMemory, getSemanticContext, upsertSemanticMemory } from './semantic'
export { getStyleMemories, analyzeStyle, getStyleContext, setUserStylePreference, upsertStyleMemory } from './style'
