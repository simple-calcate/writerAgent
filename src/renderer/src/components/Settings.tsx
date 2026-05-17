import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import type { APIProfile, AIFeatureConfig, ThinkingDepth, ThinkingDepthPreset, KeyBindings, ContinuationConfig } from '../../../shared/types'
import { DEFAULT_KEY_BINDINGS, DEFAULT_CONTINUATION_CONFIG } from '../../../shared/types'

type TabKey = 'api' | 'ai' | 'keys' | 'data'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'api', label: 'API 配置' },
  { key: 'ai', label: 'AI 功能' },
  { key: 'keys', label: '快捷键' },
  { key: 'data', label: '数据存储' }
]

const KEY_BINDING_ITEMS: { key: keyof KeyBindings; label: string; desc: string }[] = [
  { key: 'undo', label: '撤销', desc: '撤销上一步操作' },
  { key: 'acceptContinuation', label: '接受续写', desc: '接受 AI 续写建议' },
  { key: 'dismissContinuation', label: '取消续写', desc: '取消当前续写建议' },
  { key: 'save', label: '保存', desc: '手动保存当前章节' }
]

const FEATURE_LIST: { key: keyof AIFeatureConfig; label: string; desc: string }[] = [
  { key: 'polish', label: '润色优化', desc: '自动检测并优化薄弱片段' },
  { key: 'summary', label: '章节摘要', desc: '生成章节结构化摘要（人物、事件、伏笔）' },
  { key: 'refineSummary', label: '精炼总结', desc: '用一段话精炼概括章节核心情节' },
  { key: 'dialogue', label: 'AI 对话', desc: '与 AI 进行创作对话、剧情规划' }
]

const THINKING_PRESETS: { value: ThinkingDepthPreset | 'custom'; label: string; desc: string }[] = [
  { value: 'off', label: '关闭', desc: '不使用深度思考，响应更快' },
  { value: 'low', label: '低', desc: '轻度推理，适合简单对话' },
  { value: 'medium', label: '中', desc: '平衡推理深度和速度' },
  { value: 'high', label: '高', desc: '深度推理，适合复杂剧情规划' },
  { value: 'custom', label: '自定义', desc: '手动设置 token 预算' }
]

const DEFAULT_THINKING: ThinkingDepth = { preset: 'off' }

export default function Settings() {
  const { llmConfig, saveLLMConfig, toggleSettings } = useAppStore()
  const [form, setForm] = useState(llmConfig)
  const [activeTab, setActiveTab] = useState<TabKey>('api')
  const [dataPath, setDataPath] = useState('')
  const [defaultPath, setDefaultPath] = useState('')
  const [customPath, setCustomPath] = useState('')
  const [recordingKey, setRecordingKey] = useState<keyof KeyBindings | null>(null)

  // API profile editing state
  const [editingProfile, setEditingProfile] = useState<APIProfile | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    setForm(llmConfig)
    window.api.getDataPath().then(setDataPath)
    window.api.getDataPathDefault().then(setDefaultPath)
  }, [llmConfig])

  const handleSave = () => {
    saveLLMConfig(form)
  }

  const handleOpenFolder = () => {
    window.api.openDataFolder()
  }

  const handleChangePath = async () => {
    if (!customPath.trim()) return
    const confirmed = window.confirm(
      `确认将数据存储位置更改为：\n${customPath.trim()}\n\n数据将被复制到新位置，但旧位置的数据不会自动删除。请在确认迁移成功后手动清理旧数据。`
    )
    if (!confirmed) return
    try {
      await window.api.setDataPath(customPath.trim())
      const newPath = await window.api.getDataPath()
      setDataPath(newPath)
      setCustomPath('')
    } catch (e: any) {
      alert('路径无效: ' + e.message)
    }
  }

  const handleResetPath = async () => {
    const confirmed = window.confirm(
      `确认将数据存储位置恢复为默认路径：\n${defaultPath}\n\n数据将被复制到默认位置，但当前自定义位置的数据不会自动删除。`
    )
    if (!confirmed) return
    await window.api.setDataPath(defaultPath)
    setDataPath(defaultPath)
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
    // Clear profile bindings that reference deleted profile
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={toggleSettings}>
      <div className="bg-gray-800 rounded-lg w-full max-w-lg shadow-xl flex overflow-hidden" onClick={e => e.stopPropagation()} style={{ height: 480 }}>
        {/* Left sidebar */}
        <div className="w-36 bg-gray-900/60 border-r border-gray-700 flex flex-col py-3 shrink-0">
          <div className="px-4 mb-3">
            <h2 className="text-sm font-semibold text-gray-300">设置</h2>
          </div>
          <nav className="flex-1 space-y-0.5 px-2">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeTab === 'api' && (
              <>
                {editingProfile ? (
                  /* Profile edit form */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm text-gray-300">{isAdding ? '添加 API 配置' : '编辑 API 配置'}</h3>
                      <button onClick={() => { setEditingProfile(null); setIsAdding(false) }} className="text-xs text-gray-500 hover:text-gray-300">取消</button>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">配置名称</label>
                      <input
                        type="text"
                        value={editingProfile.name}
                        onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })}
                        placeholder="如 OpenAI、本地 Ollama..."
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">API Key</label>
                      <input
                        type="password"
                        value={editingProfile.apiKey}
                        onChange={e => setEditingProfile({ ...editingProfile, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Base URL</label>
                      <input
                        type="text"
                        value={editingProfile.baseUrl}
                        onChange={e => setEditingProfile({ ...editingProfile, baseUrl: e.target.value })}
                        placeholder="https://api.openai.com/v1"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">模型</label>
                      <input
                        type="text"
                        value={editingProfile.model}
                        onChange={e => setEditingProfile({ ...editingProfile, model: e.target.value })}
                        placeholder="gpt-4o-mini"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">思考深度</label>
                      <select
                        value={editingProfile.thinkingDepth?.preset || 'off'}
                        onChange={e => {
                          const preset = e.target.value as ThinkingDepthPreset | 'custom'
                          const td: ThinkingDepth = preset === 'custom'
                            ? { preset: 'custom', budgetTokens: editingProfile.thinkingDepth?.budgetTokens || 8192 }
                            : { preset }
                          setEditingProfile({ ...editingProfile, thinkingDepth: td })
                        }}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      >
                        {THINKING_PRESETS.map(p => (
                          <option key={p.value} value={p.value}>{p.label} — {p.desc}</option>
                        ))}
                      </select>
                      {(editingProfile.thinkingDepth?.preset || 'off') !== 'off' && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          适用于 DeepSeek / OpenAI o1/o3 / Claude 等支持推理的模型
                        </p>
                      )}
                      {editingProfile.thinkingDepth?.preset === 'custom' && (
                        <div className="mt-2">
                          <label className="block text-xs text-gray-400 mb-1">Token 预算</label>
                          <input
                            type="number"
                            value={editingProfile.thinkingDepth?.budgetTokens || 8192}
                            onChange={e => setEditingProfile({
                              ...editingProfile,
                              thinkingDepth: { preset: 'custom', budgetTokens: Math.max(1024, parseInt(e.target.value) || 8192) }
                            })}
                            min={1024}
                            step={1024}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">
                            建议值：2048（轻量）/ 8192（平衡）/ 32768（深度推理）
                          </p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleSaveProfile}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium transition-colors"
                    >
                      保存配置
                    </button>
                  </div>
                ) : (
                  /* Profile list */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm text-gray-300">API 配置列表</h3>
                      <button onClick={handleAddProfile} className="text-xs text-blue-400 hover:text-blue-300">+ 添加</button>
                    </div>
                    {form.profiles.map(profile => (
                      <div
                        key={profile.id}
                        className={`px-3 py-2.5 rounded border transition-colors ${
                          form.defaultProfileId === profile.id
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : 'border-gray-700 bg-gray-700/30 hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              onClick={() => handleSetDefault(profile.id)}
                              title={form.defaultProfileId === profile.id ? '默认配置' : '设为默认'}
                              className={`shrink-0 text-sm ${form.defaultProfileId === profile.id ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                            >
                              {form.defaultProfileId === profile.id ? '★' : '☆'}
                            </button>
                            <span className="text-sm text-gray-200 truncate">{profile.name}</span>
                            <span className="text-[10px] text-gray-500 truncate">{profile.model}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setEditingProfile(profile)}
                              className="text-[10px] text-gray-500 hover:text-blue-400 px-1.5 py-0.5"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteProfile(profile.id)}
                              className="text-[10px] text-gray-500 hover:text-red-400 px-1.5 py-0.5"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 ml-6">
                          <span className="text-[10px] text-gray-500 truncate">{profile.baseUrl}</span>
                          <span className="text-[10px] text-gray-600">{'*'.repeat(Math.min(profile.apiKey.length, 8))}</span>
                          {(profile.thinkingDepth?.preset || 'off') !== 'off' && (
                            <span className="text-[10px] text-purple-400 shrink-0">
                              思考:{profile.thinkingDepth?.preset === 'custom' ? `${profile.thinkingDepth.budgetTokens}tok` : profile.thinkingDepth?.preset}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-2">
                {FEATURE_LIST.map(feat => {
                  const entry = form.aiFeatures[feat.key]
                  return (
                    <div
                      key={feat.key}
                      className={`px-3 py-3 rounded border transition-colors ${
                        entry.enabled
                          ? 'border-gray-600 bg-gray-700/30'
                          : 'border-gray-700/50 bg-gray-800/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-200">{feat.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{feat.desc}</p>
                        </div>
                        <div
                          onClick={() => handleToggleFeature(feat.key)}
                          className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                            entry.enabled ? 'bg-blue-600' : 'bg-gray-600'
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
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 shrink-0">API:</span>
                          <select
                            value={entry.profileId || ''}
                            onChange={e => handleBindProfile(feat.key, e.target.value || null)}
                            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                          >
                            <option value="">默认 ({getProfileName(null)})</option>
                            {form.profiles.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* 智能续写配置 */}
                <div className="border-t border-gray-700/50 pt-3 mt-3 space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">智能续写</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">需要至少有章纲、卷纲或书籍大纲才能触发</p>
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
                            <p className="text-sm text-gray-200">启用续写建议</p>
                            <p className="text-xs text-gray-500">停笔后自动提供 AI 续写建议</p>
                          </div>
                          <div
                            onClick={() => updateCfg({ enabled: !cfg.enabled })}
                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${cfg.enabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${cfg.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </div>
                        </div>
                        {cfg.enabled && (
                          <>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">正文触发延迟（秒）</label>
                              <input
                                type="number"
                                min={1}
                                max={60}
                                value={Math.round(cfg.delayMs / 1000)}
                                onChange={e => updateCfg({ delayMs: Math.max(1, parseInt(e.target.value) || 10) * 1000 })}
                                className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">注释触发延迟（秒）</label>
                              <input
                                type="number"
                                min={0}
                                max={30}
                                value={Math.round(cfg.commentDelayMs / 1000)}
                                onChange={e => updateCfg({ commentDelayMs: Math.max(0, parseInt(e.target.value) || 2) * 1000 })}
                                className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                              />
                              <p className="text-[10px] text-gray-500 mt-1">写 // 注释后触发，用于快速解答困惑</p>
                            </div>
                          </>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            )}

            {activeTab === 'keys' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">配置编辑器中的快捷键。点击"录制"后按下新的快捷键组合。</p>
                {(form.keyBindings || DEFAULT_KEY_BINDINGS) && KEY_BINDING_ITEMS.map(item => {
                  const bindings = form.keyBindings || DEFAULT_KEY_BINDINGS
                  const value = bindings[item.key]
                  const isRecording = recordingKey === item.key

                  return (
                    <div key={item.key} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-gray-300">{item.label}</p>
                        <p className="text-[10px] text-gray-500">{item.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={isRecording ? '按下快捷键...' : value || '未设置'}
                          className={`w-32 bg-gray-700 border rounded px-2 py-1.5 text-xs text-center focus:outline-none ${
                            isRecording ? 'border-blue-500 text-blue-400' : 'border-gray-600 text-gray-300'
                          }`}
                          onKeyDown={e => {
                            if (!isRecording) return
                            e.preventDefault()
                            e.stopPropagation()

                            if (e.key === 'Escape') {
                              setRecordingKey(null)
                              return
                            }

                            // 构建快捷键字符串
                            const parts: string[] = []
                            if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
                            if (e.altKey) parts.push('Alt')
                            if (e.shiftKey) parts.push('Shift')

                            const key = e.key
                            if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
                              // Tab 特殊处理
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
                          className={`px-2 py-1.5 text-xs rounded transition-colors ${
                            isRecording
                              ? 'bg-red-600/80 hover:bg-red-600 text-white'
                              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
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
                            className="px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-400 rounded transition-colors"
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

            {activeTab === 'data' && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">当前存储位置</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-300 bg-gray-900 rounded px-3 py-2 font-mono break-all flex-1">
                      {dataPath || '加载中...'}
                    </p>
                    <button
                      onClick={handleOpenFolder}
                      className="shrink-0 px-3 py-2 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                      title="在文件管理器中打开"
                    >
                      打开
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">修改存储位置</p>
                  <div className="flex gap-2">
                    <input
                      value={customPath}
                      onChange={e => setCustomPath(e.target.value)}
                      placeholder="输入新路径..."
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleChangePath}
                      disabled={!customPath.trim()}
                      className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
                    >
                      修改
                    </button>
                  </div>
                  {dataPath !== defaultPath && (
                    <button
                      onClick={handleResetPath}
                      className="mt-2 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                      恢复默认路径
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 border-t border-gray-700">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium transition-colors"
            >
              保存
            </button>
            <button
              onClick={toggleSettings}
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
