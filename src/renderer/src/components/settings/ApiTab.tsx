import type { APIProfile, ThinkingDepth, ThinkingDepthPreset, LLMConfig } from '../../../../shared/types'
import LocalModelDiagnostics from './components/LocalModelDiag'
import { PROVIDER_PRESETS, THINKING_PRESETS, detectPreset } from '../Settings'

interface ApiTabProps {
  form: LLMConfig
  setForm: (form: LLMConfig) => void
  editingProfile: APIProfile | null
  setEditingProfile: (profile: APIProfile | null) => void
  isAdding: boolean
  setIsAdding: (value: boolean) => void
  handleAddProfile: () => void
  handleSaveProfile: () => void
  handleDeleteProfile: (id: string) => void
  handleSetDefault: (id: string) => void
}

export default function ApiTab({
  form,
  setForm,
  editingProfile,
  setEditingProfile,
  isAdding,
  setIsAdding,
  handleAddProfile,
  handleSaveProfile,
  handleDeleteProfile,
  handleSetDefault
}: ApiTabProps) {
  return (
    <>
      {/* 新手引导 */}
      {!form.profiles.some(p => p.apiKey.trim()) && !editingProfile && (
        <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-blue-300">欢迎使用网文写作助手</h3>
          <p className="text-xs text-gray-400">
            本软件需要接入 AI 才能使用。你只需要一个 <span className="text-blue-300">API Key</span> 就能开始。
          </p>
          <div className="space-y-2">
            <p className="text-xs text-gray-300 font-medium">什么是 API Key？</p>
            <p className="text-xs text-gray-500">
              API Key 相当于 AI 服务的"通行证"。你去 AI 平台注册账号，获取一个 Key，填到这里，软件就能调用 AI 帮你写作了。
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-gray-300 font-medium">推荐：DeepSeek（便宜好用）</p>
            <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
              <li>打开 <button onClick={() => window.api.openExternal('https://platform.deepseek.com')} className="text-blue-400 hover:underline">platform.deepseek.com</button> 注册账号</li>
              <li>充值几块钱（大概 1 块钱能用很久）</li>
              <li>在"API Keys"页面创建一个 Key</li>
              <li>复制 Key，粘贴到下面的配置里</li>
            </ol>
          </div>
          <button
            onClick={() => {
              const newProfile: APIProfile = {
                id: crypto.randomUUID(),
                name: 'DeepSeek',
                apiKey: '',
                baseUrl: 'https://api.deepseek.com',
                model: 'deepseek-v4-pro',
                thinkingDepth: { preset: 'off' }
              }
              setEditingProfile(newProfile)
              setIsAdding(true)
            }}
            className="w-full py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
          >
            一键配置 DeepSeek
          </button>
        </div>
      )}
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
            <label className="block text-xs text-gray-400 mb-1">提供商</label>
            <select
              value={detectPreset(editingProfile.baseUrl)}
              onChange={e => {
                const preset = PROVIDER_PRESETS.find(p => p.value === e.target.value)
                if (!preset) return
                const updates: Partial<APIProfile> = {}
                if (!editingProfile.name.trim() && preset.label !== '自定义') {
                  updates.name = preset.label
                }
                if (preset.baseUrl) updates.baseUrl = preset.baseUrl
                if (preset.model) updates.model = preset.model
                setEditingProfile({ ...editingProfile, ...updates })
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {PROVIDER_PRESETS.map(p => (
                <option key={p.value || '__custom__'} value={p.value}>{p.label}</option>
              ))}
            </select>
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
            {(() => {
              const preset = PROVIDER_PRESETS.find(p => p.value === detectPreset(editingProfile.baseUrl))
              if (preset?.rechargeUrl) {
                return (
                  <button
                    type="button"
                    onClick={() => window.api.openExternal(preset.rechargeUrl)}
                    className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    在 {preset.label} 充值 Token
                  </button>
                )
              }
              return null
            })()}
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
          <div>
            <label className="block text-xs text-gray-400 mb-1">上下文窗口大小</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editingProfile.contextWindow || ''}
                onChange={e => {
                  const val = e.target.value ? Math.max(1024, parseInt(e.target.value) || 0) : undefined
                  setEditingProfile({ ...editingProfile, contextWindow: val })
                }}
                placeholder="留空则根据模型自动推测"
                min={1024}
                step={1024}
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-gray-500 shrink-0">tokens</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              留空自动推测。常见值：DeepSeek 64k / GPT-4o 128k / Claude 200k
            </p>
          </div>
          <button
            onClick={handleSaveProfile}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium transition-colors"
          >
            保存配置
          </button>
          {editingProfile.baseUrl.includes('localhost:11434') && (
            <LocalModelDiagnostics config={{
              apiKey: editingProfile.apiKey,
              baseUrl: editingProfile.baseUrl,
              model: editingProfile.model,
              thinkingDepth: editingProfile.thinkingDepth
            }} />
          )}
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
                {profile.contextWindow && (
                  <span className="text-[10px] text-blue-400 shrink-0">
                    上下文:{profile.contextWindow >= 1000 ? `${Math.round(profile.contextWindow / 1000)}k` : profile.contextWindow}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 第三方服务 */}
      <div className="mt-6 pt-4 border-t border-gray-700/40">
        <h3 className="text-sm font-medium text-gray-300 mb-3">第三方服务</h3>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Brave Search API Key</label>
          <input
            type="password"
            value={form.braveSearchApiKey || ''}
            onChange={e => setForm({ ...form, braveSearchApiKey: e.target.value })}
            placeholder="输入 Brave Search API Key（可选）"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          />
          <p className="text-[10px] text-gray-600 mt-1">
            用于 AI 对话联网搜索。免费申请：<button onClick={() => window.api.openExternal('https://brave.com/search/api/')} className="text-blue-400 hover:underline">brave.com/search/api</button>
          </p>
        </div>
      </div>
    </>
  )
}
