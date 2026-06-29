import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import type { FeatureSkillIds, ReasoningChain, ProjectReasoningConfig, AIFeatureAdvancedConfig } from '../../../../shared/types'
import { DEFAULT_FEATURE_SKILL_IDS, SKILL_CATEGORIES } from '../../../../shared/types'
import { BackButton } from './ContextMenu'

export function AIConfigLevel() {
  const {
    currentProject, skills,
    updateProjectFeatureSkillIds, updateProjectReasoningConfig, loadSkills, navBack, saveBookAIConfig
  } = useAppStore()

  const [featureSkillIds, setFeatureSkillIds] = useState<FeatureSkillIds>(
    currentProject?.featureSkillIds || { ...DEFAULT_FEATURE_SKILL_IDS }
  )
  const [reasoningConfig, setReasoningConfig] = useState<ProjectReasoningConfig>(
    currentProject?.reasoningConfig || {
      enabled: true,
      autoTrigger: true,
      defaultChainId: null,
      includeInContextByDefault: false,
      toolChainBindings: {}
    }
  )
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null)
  const [expandedAdvanced, setExpandedAdvanced] = useState<string | null>(null)
  const [chains, setChains] = useState<ReasoningChain[]>([])

  // 高级配置状态
  const [advancedConfigs, setAdvancedConfigs] = useState<Record<string, AIFeatureAdvancedConfig>>({
    dialogue: currentProject?.aiConfig?.dialogueAdvanced || {},
    polish: currentProject?.aiConfig?.polishAdvanced || {},
    summary: currentProject?.aiConfig?.summaryAdvanced || {},
    continuation: currentProject?.aiConfig?.continuationAdvanced || {},
    refineSummary: currentProject?.aiConfig?.refineSummaryAdvanced || {},
    outline: currentProject?.aiConfig?.outlineAdvanced || {},
    chapterContent: currentProject?.aiConfig?.chapterContentAdvanced || {}
  })

  useEffect(() => {
    loadSkills()
    window.api.getReasoningChains().then(setChains)
  }, [loadSkills])

  useEffect(() => {
    setFeatureSkillIds(currentProject?.featureSkillIds || { ...DEFAULT_FEATURE_SKILL_IDS })
    setReasoningConfig(currentProject?.reasoningConfig || {
      enabled: true,
      autoTrigger: true,
      defaultChainId: null,
      includeInContextByDefault: false,
      toolChainBindings: {}
    })
  }, [currentProject?.featureSkillIds, currentProject?.reasoningConfig])

  const handleSave = async () => {
    if (currentProject) {
      await updateProjectFeatureSkillIds(featureSkillIds)
      await updateProjectReasoningConfig(reasoningConfig)
      // 保存高级配置
      await saveBookAIConfig({
        dialogueAdvanced: advancedConfigs.dialogue,
        polishAdvanced: advancedConfigs.polish,
        summaryAdvanced: advancedConfigs.summary,
        continuationAdvanced: advancedConfigs.continuation,
        refineSummaryAdvanced: advancedConfigs.refineSummary,
        outlineAdvanced: advancedConfigs.outline,
        chapterContentAdvanced: advancedConfigs.chapterContent
      })
    }
    navBack()
  }

  const toggleSkill = (feature: keyof FeatureSkillIds, skillId: string) => {
    setFeatureSkillIds(prev => {
      const current = prev[feature] || []
      const next = current.includes(skillId)
        ? current.filter(id => id !== skillId)
        : [...current, skillId]
      return { ...prev, [feature]: next }
    })
  }

  const setAllForFeature = (feature: keyof FeatureSkillIds, enable: boolean) => {
    setFeatureSkillIds(prev => ({
      ...prev,
      [feature]: enable ? skills.map(s => s.id) : []
    }))
  }

  const bindToolChain = (toolName: string, chainId: string) => {
    setReasoningConfig(prev => {
      const newBindings = { ...prev.toolChainBindings }
      if (chainId) {
        newBindings[toolName] = chainId
      } else {
        delete newBindings[toolName]
      }
      return { ...prev, toolChainBindings: newBindings }
    })
  }

  const FEATURES: { key: keyof FeatureSkillIds; advancedKey: string; icon: string; label: string; desc: string; color: string; defaultTemp: number }[] = [
    { key: 'dialogue', advancedKey: 'dialogue', icon: '💬', label: 'AI 对话', desc: '对话系统中使用的技能', color: 'from-blue-500/20 to-blue-600/5 border-blue-500/30', defaultTemp: 0.7 },
    { key: 'polish', advancedKey: 'polish', icon: '✨', label: '智能润色', desc: '润色功能中使用的技能', color: 'from-amber-500/20 to-amber-600/5 border-amber-500/30', defaultTemp: 0.7 },
    { key: 'summary', advancedKey: 'summary', icon: '📋', label: '章节摘要', desc: '摘要功能中使用的技能', color: 'from-green-500/20 to-green-600/5 border-green-500/30', defaultTemp: 0.3 },
    { key: 'continuation', advancedKey: 'continuation', icon: '⚡', label: '智能续写', desc: '续写功能中使用的技能', color: 'from-purple-500/20 to-purple-600/5 border-purple-500/30', defaultTemp: 0.7 },
    { key: 'outline', advancedKey: 'outline', icon: '📝', label: '大纲撰写', desc: '撰写大纲时使用的技能', color: 'from-teal-500/20 to-teal-600/5 border-teal-500/30', defaultTemp: 0.7 },
    { key: 'chapterContent', advancedKey: 'chapterContent', icon: '📖', label: '正文撰写', desc: '撰写正文时使用的技能', color: 'from-rose-500/20 to-rose-600/5 border-rose-500/30', defaultTemp: 0.7 }
  ]

  const updateAdvancedConfig = (key: string, updates: Partial<AIFeatureAdvancedConfig>) => {
    setAdvancedConfigs(prev => ({
      ...prev,
      [key]: { ...prev[key], ...updates }
    }))
  }

  // 功能 → 默认内置技能名称映射
  const FEATURE_DEFAULT_SKILL_NAMES: Record<string, string> = {
    polish: '智能润色指导',
    summary: '结构化摘要指导',
    continuation: '智能续写指导',
    outline: '大纲撰写指导',
    chapterContent: '正文撰写指导'
  }

  const getDefaultSystemPrompt = (featureKey: string): string => {
    const skillName = FEATURE_DEFAULT_SKILL_NAMES[featureKey]
    if (!skillName) return ''
    const skill = skills.find(s => s.name === skillName && s.builtin)
    return skill?.content || ''
  }

  const TOOL_OPTIONS = [
    { value: 'write_chapter_content', label: '撰写章节内容' },
    { value: 'write_chapter_outline', label: '撰写章纲' },
    { value: 'write_volume_outline', label: '撰写卷纲' },
    { value: 'write_outline', label: '撰写书籍大纲' }
  ]

  return (
    <div className="flex flex-col h-full">
      <BackButton label="书籍 AI 配置" onClick={navBack} />

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <p className="text-[11px] text-[var(--nw-text-muted)]">
          配置技能搭载和推理链绑定，影响所有卷和章节
        </p>

        {/* Skill Assignment */}
        {skills.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-[10px] text-[var(--nw-text-muted)] font-medium tracking-wider uppercase">技能搭载</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {FEATURES.map(feat => {
              const assigned = featureSkillIds[feat.key] || []
              const isExpanded = expandedFeature === feat.key
              return (
                <div key={feat.key} className={`rounded-xl border overflow-hidden transition-all ${feat.color}`}>
                  <button
                    onClick={() => setExpandedFeature(isExpanded ? null : feat.key)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-3 transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="text-base">{feat.icon}</span>
                    <div className="flex-1 text-left">
                      <p className="text-[12px] text-[var(--nw-text-primary)] font-medium">{feat.label}</p>
                      <p className="text-[10px] text-[var(--nw-text-muted)]">{feat.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assigned.length > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[var(--nw-text-secondary)]">
                          {assigned.length} 技能
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--nw-text-muted)]">未配置</span>
                      )}
                      <span className="text-[10px] text-[var(--nw-text-muted)]">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 border-t border-white/10">
                      <div className="flex items-center justify-between pt-2.5 pb-1.5">
                        <span className="text-[10px] text-[var(--nw-text-muted)]">选择此功能使用的技能</span>
                        <button
                          onClick={() => setAllForFeature(feat.key, assigned.length < skills.length)}
                          className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {assigned.length < skills.length ? '全选' : '全不选'}
                        </button>
                      </div>
                      <div className="space-y-0.5 max-h-44 overflow-y-auto">
                        {skills.map(skill => {
                          const meta = SKILL_CATEGORIES[skill.category] || { icon: '📌', label: skill.category }
                          const isEnabled = assigned.includes(skill.id)
                          return (
                            <label key={skill.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={() => toggleSkill(feat.key, skill.id)}
                                className="accent-blue-500 w-3.5 h-3.5"
                              />
                              <span className="text-[11px]">{meta.icon}</span>
                              <span className="text-[12px] text-[var(--nw-text-secondary)] truncate flex-1">{skill.name}</span>
                              {skill.builtin && <span className="text-[9px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">内置</span>}
                            </label>
                          )
                        })}
                      </div>

                      {/* 高级选项 */}
                      <div className="mt-3 pt-2.5 border-t border-white/5">
                        <button
                          onClick={() => setExpandedAdvanced(expandedAdvanced === feat.advancedKey ? null : feat.advancedKey)}
                          className="flex items-center gap-1.5 text-[11px] text-[var(--nw-text-muted)] hover:text-[var(--nw-text-secondary)] transition-colors"
                        >
                          <span>{expandedAdvanced === feat.advancedKey ? '▼' : '▶'}</span>
                          <span>高级选项</span>
                          {advancedConfigs[feat.advancedKey]?.temperature !== undefined && (
                            <span className="text-blue-400 ml-1">·</span>
                          )}
                        </button>

                        {expandedAdvanced === feat.advancedKey && (
                          <div className="mt-3 space-y-4">
                            {/* 温度滑块 */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] text-[var(--nw-text-muted)]">温度 (Temperature)</label>
                                <span className="text-[11px] text-[var(--nw-text-secondary)] font-mono">
                                  {advancedConfigs[feat.advancedKey]?.temperature?.toFixed(1) ?? `${feat.defaultTemp} (默认)`}
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={advancedConfigs[feat.advancedKey]?.temperature ?? feat.defaultTemp}
                                onChange={e => updateAdvancedConfig(feat.advancedKey, { temperature: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                              <div className="flex justify-between text-[9px] text-[var(--nw-text-muted)] mt-1">
                                <span>精确 (0)</span>
                                <span>默认 ({feat.defaultTemp})</span>
                                <span>随机 (2)</span>
                              </div>
                              {advancedConfigs[feat.advancedKey]?.temperature !== undefined && (
                                <button
                                  onClick={() => updateAdvancedConfig(feat.advancedKey, { temperature: undefined })}
                                  className="text-[10px] text-[var(--nw-text-muted)] hover:text-[var(--nw-text-secondary)] mt-1.5 transition-colors"
                                >
                                  恢复默认
                                </button>
                              )}
                            </div>

                            {/* 自定义系统提示词 */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] text-[var(--nw-text-muted)]">自定义系统提示词</label>
                                {advancedConfigs[feat.advancedKey]?.systemPrompt !== undefined &&
                                  advancedConfigs[feat.advancedKey]?.systemPrompt !== getDefaultSystemPrompt(feat.advancedKey) && (
                                  <button
                                    onClick={() => updateAdvancedConfig(feat.advancedKey, { systemPrompt: undefined })}
                                    className="text-[10px] text-[var(--nw-text-muted)] hover:text-[var(--nw-text-secondary)] transition-colors"
                                  >
                                    恢复默认
                                  </button>
                                )}
                              </div>
                              <textarea
                                value={advancedConfigs[feat.advancedKey]?.systemPrompt ?? getDefaultSystemPrompt(feat.advancedKey)}
                                onChange={e => updateAdvancedConfig(feat.advancedKey, { systemPrompt: e.target.value })}
                                rows={3}
                                className="w-full bg-[var(--nw-surface-2)] border border-white/10 rounded-xl px-3 py-2 text-[11px] text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500/50 resize-none"
                              />
                              <p className="text-[9px] text-[var(--nw-text-muted)] mt-1.5">
                                修改后将覆盖内置技能的提示词
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Reasoning Chain Bindings */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="text-[10px] text-[var(--nw-text-muted)] font-medium tracking-wider uppercase">推理链绑定</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
          <p className="text-[10px] text-[var(--nw-text-muted)]">绑定推理链后，执行工具前会自动执行推理分析</p>

          {TOOL_OPTIONS.map(tool => {
            const boundChainId = reasoningConfig.toolChainBindings?.[tool.value]
            const boundChain = chains.find(c => c.id === boundChainId)
            return (
              <div key={tool.value} className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] text-[var(--nw-text-secondary)]">{tool.label}</span>
                </div>
                <select
                  value={boundChainId || ''}
                  onChange={e => bindToolChain(tool.value, e.target.value)}
                  className="w-full bg-[var(--nw-surface-2)] border border-white/10 rounded-xl px-3 py-2 text-[12px] text-[var(--nw-text-primary)] focus:outline-none focus:border-blue-500/50 transition-all"
                >
                  <option value="">不绑定</option>
                  {chains.map(chain => (
                    <option key={chain.id} value={chain.id}>{chain.name}</option>
                  ))}
                </select>
                {boundChain && (
                  <p className="text-[11px] text-[var(--nw-text-muted)] mt-2">
                    已绑定：{boundChain.name}（{boundChain.steps.length} 步）
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-3.5 border-t border-white/5 shrink-0 bg-white/[0.03]">
        <button onClick={handleSave} className="w-full bg-amber-600/90 hover:bg-amber-500 text-white py-2.5 rounded-xl text-[12px] font-medium transition-all shadow-sm shadow-amber-500/20">
          保存
        </button>
      </div>
    </div>
  )
}
