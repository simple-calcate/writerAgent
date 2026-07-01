import type { LLMConfig, AIFeatureConfig, ThinkingDepth, ThinkingDepthPreset, ContinuationConfig, APIProfile, ContextConfig, AgentFeatureConfig, ApprovalMode } from '../../../../shared/types'
import { DEFAULT_CONTINUATION_CONFIG, DEFAULT_CONTEXT_CONFIG, DEFAULT_AGENT_FEATURE_CONFIG } from '../../../../shared/types'
import { FEATURE_LIST, THINKING_PRESETS } from '../Settings'
import ContextConfigSection from './ContextConfigSection'
import AgentConfigSection from './AgentConfigSection'

interface AIFeatureTabProps {
  form: LLMConfig
  setForm: React.Dispatch<React.SetStateAction<LLMConfig>>
  handleToggleFeature: (key: keyof AIFeatureConfig) => void
  handleBindProfile: (key: keyof AIFeatureConfig, profileId: string | null) => void
  getProfileName: (profileId: string | null) => string
}

export default function AIFeatureTab({
  form,
  setForm,
  handleToggleFeature,
  handleBindProfile,
  getProfileName
}: AIFeatureTabProps) {
  const approvalMode: ApprovalMode = form.approvalMode ?? 'smart'

  const setApprovalMode = (mode: ApprovalMode) => {
    setForm(prev => ({ ...prev, approvalMode: mode }))
  }

  return (
    <div className="space-y-3">
      {/* 工具确认模式 */}
      <div className="px-3 py-3 rounded-lg border border-white/15 bg-[var(--nw-surface-2)]/30">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-1 h-5 bg-amber-500 rounded-full" />
          <div>
            <p className="text-sm text-[var(--nw-text-primary)] font-medium">工具确认模式</p>
            <p className="text-[10px] text-[var(--nw-text-muted)] mt-0.5">控制 AI 调用工具时何时需要你手动确认</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setApprovalMode('smart')}
            className={`text-left px-3 py-2.5 rounded-md border transition-all duration-200 ${
              approvalMode === 'smart'
                ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]'
                : 'border-white/10 bg-[var(--nw-surface-2)]/50 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px] font-medium text-[var(--nw-text-primary)]">智能模式</span>
              {approvalMode === 'smart' && <span className="text-[9px] px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">默认</span>}
            </div>
            <p className="text-[10px] text-[var(--nw-text-muted)] leading-relaxed">仅写入/修改操作需确认，查看章节内容等只读操作自动放行，对话更流畅</p>
          </button>
          <button
            onClick={() => setApprovalMode('strict')}
            className={`text-left px-3 py-2.5 rounded-md border transition-all duration-200 ${
              approvalMode === 'strict'
                ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]'
                : 'border-white/10 bg-[var(--nw-surface-2)]/50 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px] font-medium text-[var(--nw-text-primary)]">严格模式</span>
              {approvalMode === 'strict' && <span className="text-[9px] px-1 py-0.5 bg-red-500/20 text-red-400 rounded-full">已启用</span>}
            </div>
            <p className="text-[10px] text-[var(--nw-text-muted)] leading-relaxed">所有标记工具（含查看章节内容）都需确认，每次操作完全可控</p>
          </button>
        </div>
      </div>

      {FEATURE_LIST.map(feat => {
        const entry = form.aiFeatures[feat.key]
        const isAgent = feat.key === 'agent'
        return (
          <div
            key={feat.key}
            className={`px-3 py-3 rounded-lg border transition-all duration-200 ${
              entry.enabled
                ? isAgent
                  ? 'border-blue-500/30 bg-gradient-to-br from-gray-800/80 to-gray-700/50 shadow-lg shadow-blue-500/5'
                  : 'border-white/15 bg-[var(--nw-surface-2)]/30'
                : 'border-white/10/50 bg-[var(--nw-surface-2)]/50 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isAgent && entry.enabled && (
                  <div className="w-1 h-8 bg-blue-500 rounded-full" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-[var(--nw-text-primary)] font-medium">{feat.label}</p>
                    {isAgent && entry.enabled && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded-full">高级</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--nw-text-muted)] mt-0.5">{feat.desc}</p>
                </div>
              </div>
              <div
                onClick={() => handleToggleFeature(feat.key)}
                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                  entry.enabled ? 'bg-blue-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    entry.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </div>
            {entry.enabled && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--nw-text-muted)] shrink-0 w-12">API</span>
                  <select
                    value={entry.profileId || ''}
                    onChange={e => handleBindProfile(feat.key, e.target.value || null)}
                    className="flex-1 bg-[var(--nw-surface-2)]/80 border border-white/15/50 rounded px-2 py-1.5 text-xs text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">默认 ({getProfileName(null)})</option>
                    {form.profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--nw-text-muted)] shrink-0 w-12">思考</span>
                  <select
                    value={entry.thinkingDepth?.preset || 'default'}
                    onChange={e => {
                      const val = e.target.value
                      if (val === 'default') {
                        const { thinkingDepth, ...rest } = entry
                        setForm({ ...form, aiFeatures: { ...form.aiFeatures, [feat.key]: rest } })
                      } else {
                        const td: ThinkingDepth = val === 'custom'
                          ? { preset: 'custom', budgetTokens: entry.thinkingDepth?.budgetTokens || 8192 }
                          : { preset: val as ThinkingDepthPreset }
                        setForm({ ...form, aiFeatures: { ...form.aiFeatures, [feat.key]: { ...entry, thinkingDepth: td } } })
                      }
                    }}
                    className="flex-1 bg-[var(--nw-surface-2)]/80 border border-white/15/50 rounded px-2 py-1.5 text-xs text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="default">跟随 API 配置</option>
                    {THINKING_PRESETS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                {entry.thinkingDepth?.preset === 'custom' && (
                  <div className="flex items-center gap-2 ml-12">
                    <span className="text-[10px] text-[var(--nw-text-muted)] shrink-0">预算</span>
                    <input
                      type="number"
                      value={entry.thinkingDepth?.budgetTokens || 8192}
                      onChange={e => setForm({
                        ...form,
                        aiFeatures: {
                          ...form.aiFeatures,
                          [feat.key]: { ...entry, thinkingDepth: { preset: 'custom', budgetTokens: Math.max(1024, parseInt(e.target.value) || 8192) } }
                        }
                      })}
                      min={1024}
                      step={1024}
                      className="w-24 bg-[var(--nw-surface-2)]/80 border border-white/15/50 rounded px-2 py-1.5 text-xs text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                    <span className="text-[10px] text-[var(--nw-text-muted)]">tokens</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--nw-text-muted)] shrink-0 w-12">输出</span>
                  <input
                    type="number"
                    min={1}
                    max={390}
                    value={entry.maxTokens ?? ''}
                    placeholder="不限"
                    onChange={e => {
                      const val = e.target.value ? Math.min(390, Math.max(1, parseInt(e.target.value))) : undefined
                      const { maxTokens, ...rest } = entry
                      if (val) {
                        setForm({ ...form, aiFeatures: { ...form.aiFeatures, [feat.key]: { ...entry, maxTokens: val } } })
                      } else {
                        setForm({ ...form, aiFeatures: { ...form.aiFeatures, [feat.key]: rest } })
                      }
                    }}
                    className="w-20 bg-[var(--nw-surface-2)]/80 border border-white/15/50 rounded px-2 py-1.5 text-xs text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                  <span className="text-[10px] text-[var(--nw-text-muted)]">k {entry.maxTokens ? `(${entry.maxTokens * 1000})` : '默认不限制'}</span>
                </div>

                {/* Context Config for Agent */}
                {isAgent && (
                  <ContextConfigSection
                    config={form.contextConfig || DEFAULT_CONTEXT_CONFIG}
                    onChange={config => setForm({ ...form, contextConfig: config })}
                  />
                )}

                {/* Agent Config */}
                {isAgent && (
                  <AgentConfigSection
                    config={form.agentConfig || DEFAULT_AGENT_FEATURE_CONFIG}
                    onChange={config => setForm({ ...form, agentConfig: config })}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* 智能续写配置 */}
      <div className="border-t border-white/10/50 pt-3 mt-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-green-500 rounded-full" />
          <div>
            <p className="text-xs text-[var(--nw-text-secondary)] font-medium">智能续写</p>
            <p className="text-[10px] text-[var(--nw-text-muted)] mt-0.5">需要至少有章纲、卷纲或书籍大纲才能触发</p>
          </div>
        </div>
        {(() => {
          const cfg = form.continuationConfig || DEFAULT_CONTINUATION_CONFIG
          const updateCfg = (patch: Partial<ContinuationConfig>) => {
            setForm(prev => ({
              ...prev,
              continuationConfig: { ...(prev.continuationConfig || DEFAULT_CONTINUATION_CONFIG), ...patch }
            }))
          }
          return (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--nw-text-primary)]">启用续写建议</p>
                  <p className="text-xs text-[var(--nw-text-muted)]">停笔后自动提供 AI 续写建议</p>
                </div>
                <div
                  onClick={() => updateCfg({ enabled: !cfg.enabled })}
                  className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${cfg.enabled ? 'bg-blue-600' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${cfg.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
              {cfg.enabled && (
                <>
                  <div>
                    <label className="block text-xs text-[var(--nw-text-secondary)] mb-1">正文触发延迟（秒）</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={Math.round(cfg.delayMs / 1000)}
                      onChange={e => updateCfg({ delayMs: Math.max(1, parseInt(e.target.value) || 10) * 1000 })}
                      className="w-24 bg-[var(--nw-surface-2)] border border-white/15 rounded px-2 py-1.5 text-xs text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--nw-text-secondary)] mb-1">注释触发延迟（秒）</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={Math.round(cfg.commentDelayMs / 1000)}
                      onChange={e => updateCfg({ commentDelayMs: Math.max(0, parseInt(e.target.value) || 2) * 1000 })}
                      className="w-24 bg-[var(--nw-surface-2)] border border-white/15 rounded px-2 py-1.5 text-xs text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-[var(--nw-text-muted)] mt-1">写 // 注释后触发，用于快速解答困惑</p>
                  </div>
                </>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
