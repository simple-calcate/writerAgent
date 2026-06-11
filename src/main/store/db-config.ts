import type { LLMConfig, LLMConfigSingle, APIProfile, AIFeatureConfig, Conversation, DialogueLevel, Outline, WritingSkill, ReasoningChain, ContextConfig } from '../../shared/types'
import { DEFAULT_CONTEXT_CONFIG } from '../../shared/types'
import { getStore, save } from './db-core'
import { guessContextWindow } from '../llm/token-counter'

// ─── LLM Config ───

export function getLLMConfig(): LLMConfig {
  return { ...getStore().llmConfig }
}

export function saveLLMConfig(config: LLMConfig): void {
  getStore().llmConfig = config
  save()
}

export function getContextConfig(): ContextConfig {
  return getStore().llmConfig.contextConfig || DEFAULT_CONTEXT_CONFIG
}

export function getDefaultProfile(): APIProfile | null {
  const { profiles, defaultProfileId } = getStore().llmConfig
  return profiles.find(p => p.id === defaultProfileId) || profiles[0] || null
}

export function resolveFeatureConfig(feature: keyof AIFeatureConfig): LLMConfigSingle | null {
  const { profiles, defaultProfileId, aiFeatures } = getStore().llmConfig
  const featureConf = aiFeatures[feature]
  if (!featureConf || !featureConf.enabled) return null
  const profileId = featureConf.profileId || defaultProfileId
  const profile = profiles.find(p => p.id === profileId) || profiles[0]
  if (!profile) return null
  const thinkingDepth = featureConf.thinkingDepth || profile.thinkingDepth
  const maxTokens = featureConf.maxTokens && featureConf.maxTokens > 0
    ? Math.min(featureConf.maxTokens * 1000, 390000)
    : undefined
  // contextWindow 优先级：功能级 > profile 级 > 模型推测
  const contextWindow = featureConf.contextWindow || profile.contextWindow || guessContextWindow(profile.model)
  return { apiKey: profile.apiKey, baseUrl: profile.baseUrl, model: profile.model, thinkingDepth, maxTokens, contextWindow }
}

// ─── Conversations ───

function getEntityIdField(level: DialogueLevel): 'projectId' | 'volumeId' | 'chapterId' {
  if (level === 'book') return 'projectId'
  if (level === 'volume') return 'volumeId'
  return 'chapterId'
}

export function getConversation(level: DialogueLevel, entityId: string): Conversation | undefined {
  const field = getEntityIdField(level)
  return getStore().conversations.find(c => c.level === level && c[field] === entityId)
}

export function saveConversation(conversation: Conversation): void {
  const store = getStore()
  const idx = store.conversations.findIndex(c => c.id === conversation.id)
  if (idx >= 0) {
    store.conversations[idx] = conversation
  } else {
    store.conversations.push(conversation)
  }
  save()
}

export function deleteConversation(level: DialogueLevel, entityId: string): void {
  const store = getStore()
  const field = getEntityIdField(level)
  store.conversations = store.conversations.filter(
    c => !(c.level === level && c[field] === entityId)
  )
  save()
}

// ─── Outlines ───

export function getOutline(level: DialogueLevel, entityId: string): Outline | undefined {
  const field = getEntityIdField(level)
  return getStore().outlines.find(o => o.level === level && o[field] === entityId)
}

export function saveOutline(outline: Outline): void {
  const store = getStore()
  const idx = store.outlines.findIndex(o => o.id === outline.id)
  if (idx >= 0) {
    store.outlines[idx] = outline
  } else {
    store.outlines.push(outline)
  }
  save()
}

export function deleteOutline(level: DialogueLevel, entityId: string): void {
  const store = getStore()
  const field = getEntityIdField(level)
  store.outlines = store.outlines.filter(
    o => !(o.level === level && o[field] === entityId)
  )
  save()
}

// ─── Skills ───

export function getSkills(): WritingSkill[] {
  return [...getStore().skills].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveSkill(skill: WritingSkill): void {
  const store = getStore()
  const idx = store.skills.findIndex(s => s.id === skill.id)
  if (idx >= 0) {
    store.skills[idx] = skill
  } else {
    store.skills.push(skill)
  }
  save()
}

export function deleteSkill(id: string): void {
  const store = getStore()
  store.skills = store.skills.filter(s => s.id !== id)
  // Remove from all projects' enabledSkillIds
  for (const p of store.projects) {
    if (p.enabledSkillIds) {
      p.enabledSkillIds = p.enabledSkillIds.filter(sid => sid !== id)
    }
  }
  save()
}

export function saveSkills(skills: WritingSkill[]): void {
  const store = getStore()
  for (const skill of skills) {
    const idx = store.skills.findIndex(s => s.id === skill.id)
    if (idx >= 0) {
      store.skills[idx] = skill
    } else {
      store.skills.push(skill)
    }
  }
  save()
}

// ─── Reasoning Chains ───

export function getReasoningChains(): ReasoningChain[] {
  return [...getStore().reasoningChains]
}

export function saveReasoningChain(chain: ReasoningChain): void {
  const store = getStore()
  const idx = store.reasoningChains.findIndex(c => c.id === chain.id)
  if (idx >= 0) {
    store.reasoningChains[idx] = chain
  } else {
    store.reasoningChains.push(chain)
  }
  save()
}

export function deleteReasoningChain(id: string): void {
  getStore().reasoningChains = getStore().reasoningChains.filter(c => c.id !== id)
  save()
}
