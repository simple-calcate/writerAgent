import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import VisualEffectsTab from './VisualEffectsTab'
import SkillsTab from './settings/tabs/SkillsTab'
import ReasoningTab from './settings/tabs/ReasoningTab'
import DataStorageTab from './settings/tabs/DataStorageTab'
import AboutTab from './settings/tabs/AboutTab'
import ApiTab from './settings/ApiTab'
import AIFeatureTab from './settings/AIFeatureTab'
import type { APIProfile, AIFeatureConfig, ThinkingDepthPreset, KeyBindings } from '../../../shared/types'
import { DEFAULT_KEY_BINDINGS } from '../../../shared/types'

type TabKey = 'api' | 'ai' | 'keys' | 'data' | 'skills' | 'reasoning' | 'visual' | 'about'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'api', label: 'API 配置' },
  { key: 'ai', label: 'AI 功能' },
  { key: 'keys', label: '快捷键' },
  { key: 'data', label: '数据存储' },
  { key: 'skills', label: '技能库' },
  { key: 'reasoning', label: '推理链' },
  { key: 'visual', label: '视觉效果' },
  { key: 'about', label: '软件相关' }
]

const KEY_BINDING_ITEMS: { key: keyof KeyBindings; label: string; desc: string }[] = [
  { key: 'undo', label: '撤销', desc: '撤销上一步操作' },
  { key: 'acceptContinuation', label: '接受续写', desc: '接受 AI 续写建议' },
  { key: 'dismissContinuation', label: '取消续写', desc: '取消当前续写建议' },
  { key: 'save', label: '保存', desc: '手动保存当前章节' }
]

export const FEATURE_LIST: { key: keyof AIFeatureConfig; label: string; desc: string }[] = [
  { key: 'polish', label: '润色优化', desc: '自动检测并优化薄弱片段' },
  { key: 'summary', label: '章节摘要', desc: '生成章节结构化摘要（人物、事件、伏笔）' },
  { key: 'refineSummary', label: '精炼总结', desc: '用一段话精炼概括章节核心情节' },
  { key: 'agent', label: 'Agent 系统', desc: '意图驱动的多智能体系统（自动分类写作/分析/对话）' }
]

export const THINKING_PRESETS: { value: ThinkingDepthPreset | 'custom'; label: string; desc: string }[] = [
  { value: 'off', label: '关闭', desc: '不使用深度思考，响应更快' },
  { value: 'low', label: '低', desc: '轻度推理，适合简单对话' },
  { value: 'medium', label: '中', desc: '平衡推理深度和速度' },
  { value: 'high', label: '高', desc: '深度推理，适合复杂剧情规划' },
  { value: 'custom', label: '自定义', desc: '手动设置 token 预算' }
]

export interface ProviderPreset {
  value: string
  label: string
  baseUrl: string
  model: string
  rechargeUrl: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { value: '', label: '自定义', baseUrl: '', model: '', rechargeUrl: '' },
  { value: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat', rechargeUrl: 'https://openrouter.ai/settings/credits' },
  { value: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-pro', rechargeUrl: 'https://platform.deepseek.com/top_up' },
  { value: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', rechargeUrl: 'https://platform.openai.com/settings/organization/billing/overview' },
  { value: 'claude', label: 'Claude', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514', rechargeUrl: 'https://console.anthropic.com/settings/billing' },
  { value: 'qwen', label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', rechargeUrl: 'https://usercenter2.aliyun.com' },
  { value: 'moonshot', label: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', rechargeUrl: 'https://platform.moonshot.cn/console/account/billing' },
  { value: 'ollama', label: 'Ollama (本地)', baseUrl: 'http://localhost:11434/v1', model: 'llama3', rechargeUrl: '' },
]

export function detectPreset(baseUrl: string): string {
  for (const p of PROVIDER_PRESETS) {
    if (p.value && p.baseUrl && baseUrl === p.baseUrl) return p.value
  }
  return ''
}

export default function Settings() {
  const { llmConfig, saveLLMConfig, toggleSettings } = useAppStore()
  const [form, setForm] = useState(llmConfig)
  const [activeTab, setActiveTab] = useState<TabKey>('api')
  const [recordingKey, setRecordingKey] = useState<keyof KeyBindings | null>(null)

  // API profile editing state
  const [editingProfile, setEditingProfile] = useState<APIProfile | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    setForm(llmConfig)
  }, [llmConfig])

  const handleSave = () => {
    saveLLMConfig(form)
  }

  // Profile management
  const handleAddProfile = () => {
    const newProfile: APIProfile = {
      id: crypto.randomUUID(),
      name: '',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      thinkingDepth: { preset: 'off' }
    }
    setEditingProfile(newProfile)
    setIsAdding(true)
  }

  const handleSaveProfile = () => {
    if (!editingProfile) return
    if (!editingProfile.name.trim()) {
      alert('请输入配置名称')
      return
    }
    const profiles = isAdding
      ? [...form.profiles, editingProfile]
      : form.profiles.map(p => p.id === editingProfile.id ? editingProfile : p)
    const defaultProfileId = form.defaultProfileId || editingProfile.id
    setForm({ ...form, profiles, defaultProfileId })
    setEditingProfile(null)
    setIsAdding(false)
  }

  const handleDeleteProfile = (id: string) => {
    if (form.profiles.length <= 1) {
      alert('至少保留一套 API 配置')
      return
    }
    const profiles = form.profiles.filter(p => p.id !== id)
    const defaultProfileId = form.defaultProfileId === id ? profiles[0].id : form.defaultProfileId
    const aiFeatures = { ...form.aiFeatures }
    for (const key of Object.keys(aiFeatures) as (keyof AIFeatureConfig)[]) {
      if (aiFeatures[key].profileId === id) {
        aiFeatures[key] = { ...aiFeatures[key], profileId: null }
      }
    }
    setForm({ ...form, profiles, defaultProfileId, aiFeatures })
  }

  const handleSetDefault = (id: string) => {
    setForm({ ...form, defaultProfileId: id })
  }

  const handleToggleFeature = (key: keyof AIFeatureConfig) => {
    const current = form.aiFeatures[key]
    setForm({
      ...form,
      aiFeatures: {
        ...form.aiFeatures,
        [key]: { ...current, enabled: !current.enabled }
      }
    })
  }

  const handleBindProfile = (key: keyof AIFeatureConfig, profileId: string | null) => {
    const current = form.aiFeatures[key]
    setForm({
      ...form,
      aiFeatures: {
        ...form.aiFeatures,
        [key]: { ...current, profileId }
      }
    })
  }

  const getProfileName = (profileId: string | null) => {
    if (!profileId) return '默认'
    return form.profiles.find(p => p.id === profileId)?.name || '默认'
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={toggleSettings}>
      <div className="bg-[var(--nw-surface-1)] backdrop-blur-xl rounded-2xl w-full max-w-2xl shadow-2xl flex overflow-hidden border border-white/10" onClick={e => e.stopPropagation()} style={{ height: 520 }}>
        {/* Left sidebar */}
        <div className="w-40 bg-[var(--nw-surface-2)] border-r border-white/5 flex flex-col py-4 shrink-0">
          <div className="px-4 mb-4">
            <h2 className="text-sm font-semibold text-[var(--nw-text-primary)]">设置</h2>
          </div>
          <nav className="flex-1 space-y-1 px-2">
            {TABS.map(tab => {
              const needsAttention = tab.key === 'api' && !form.profiles.some(p => p.apiKey.trim())
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-[12px] transition-all border ${
                    activeTab === tab.key
                      ? 'bg-blue-500/15 text-blue-300 border-blue-500/20'
                      : 'border-transparent text-[var(--nw-text-muted)] hover:text-[var(--nw-text-secondary)] hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {tab.label}
                    {needsAttention && <span className="w-2 h-2 rounded-full bg-[var(--color-user)] animate-pulse shrink-0" />}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeTab === 'api' && (
              <ApiTab
                form={form}
                setForm={setForm}
                editingProfile={editingProfile}
                setEditingProfile={setEditingProfile}
                isAdding={isAdding}
                setIsAdding={setIsAdding}
                handleAddProfile={handleAddProfile}
                handleSaveProfile={handleSaveProfile}
                handleDeleteProfile={handleDeleteProfile}
                handleSetDefault={handleSetDefault}
              />
            )}

            {activeTab === 'ai' && (
              <AIFeatureTab
                form={form}
                setForm={setForm}
                handleToggleFeature={handleToggleFeature}
                handleBindProfile={handleBindProfile}
                getProfileName={getProfileName}
              />
            )}

            {activeTab === 'keys' && (
              <div className="space-y-4">
                <p className="text-[12px] text-[var(--nw-text-muted)]">配置编辑器中的快捷键。点击"录制"后按下新的快捷键组合。</p>
                {(form.keyBindings || DEFAULT_KEY_BINDINGS) && KEY_BINDING_ITEMS.map(item => {
                  const bindings = form.keyBindings || DEFAULT_KEY_BINDINGS
                  const value = bindings[item.key]
                  const isRecording = recordingKey === item.key

                  return (
                    <div key={item.key} className="flex items-center gap-3 py-1">
                      <div className="flex-1">
                        <p className="text-[12px] text-[var(--nw-text-secondary)]">{item.label}</p>
                        <p className="text-[11px] text-[var(--nw-text-muted)]">{item.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={isRecording ? '按下快捷键...' : value || '未设置'}
                          className={`w-36 bg-[var(--nw-surface-2)] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-center focus:outline-none transition-all ${
                            isRecording ? 'border-blue-500 text-blue-400' : 'text-[var(--nw-text-secondary)]'
                          }`}
                          onKeyDown={e => {
                            if (!isRecording) return
                            e.preventDefault()
                            e.stopPropagation()

                            if (e.key === 'Escape') {
                              setRecordingKey(null)
                              return
                            }

                            const parts: string[] = []
                            if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
                            if (e.altKey) parts.push('Alt')
                            if (e.shiftKey) parts.push('Shift')

                            const key = e.key
                            if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
                              if (key === 'Tab') {
                                parts.push('Tab')
                              } else if (key === ' ') {
                                parts.push('Space')
                              } else if (key === 'Escape') {
                                parts.push('Esc')
                              } else {
                                parts.push(key.length === 1 ? key.toUpperCase() : key)
                              }
                              const binding = parts.join('+')
                              setForm(prev => ({
                                ...prev,
                                keyBindings: { ...(prev.keyBindings || DEFAULT_KEY_BINDINGS), [item.key]: binding }
                              }))
                              setRecordingKey(null)
                            }
                          }}
                        />
                        <button
                          onClick={() => setRecordingKey(isRecording ? null : item.key)}
                          className={`px-3 py-2 text-[12px] rounded-lg transition-all ${
                            isRecording
                              ? 'bg-red-600/80 hover:bg-red-600 text-white'
                              : 'bg-white/5 hover:bg-white/10 text-[var(--nw-text-secondary)] border border-white/10'
                          }`}
                        >
                          {isRecording ? '取消' : '录制'}
                        </button>
                        {value && (
                          <button
                            onClick={() => setForm(prev => ({
                              ...prev,
                              keyBindings: { ...(prev.keyBindings || DEFAULT_KEY_BINDINGS), [item.key]: '' }
                            }))}
                            className="px-3 py-2 text-[12px] bg-white/5 hover:bg-white/10 text-[var(--nw-text-muted)] rounded-lg transition-all border border-white/5"
                          >
                            清除
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'data' && <DataStorageTab />}
            {activeTab === 'skills' && <SkillsTab />}
            {activeTab === 'reasoning' && <ReasoningTab />}
            {activeTab === 'visual' && <VisualEffectsTab />}
            {activeTab === 'about' && <AboutTab />}
          </div>

          {/* Footer - only show for config tabs */}
          {(activeTab === 'api' || activeTab === 'ai' || activeTab === 'keys') && (
            <div className="flex gap-3 px-5 py-4 border-t border-white/5 bg-white/[0.03]">
              <button
                onClick={handleSave}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-[13px] font-medium transition-all shadow-sm shadow-blue-500/20"
              >
                保存
              </button>
              <button
                onClick={toggleSettings}
                className="flex-1 bg-white/5 hover:bg-white/10 text-[var(--nw-text-secondary)] py-2.5 rounded-xl text-[13px] transition-all border border-white/5"
              >
                取消
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
