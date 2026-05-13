import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'

type TabKey = 'api' | 'ai' | 'data'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'api', label: 'API 配置' },
  { key: 'ai', label: 'AI 功能' },
  { key: 'data', label: '数据存储' }
]

export default function Settings() {
  const { llmConfig, saveLLMConfig, toggleSettings } = useAppStore()
  const [form, setForm] = useState(llmConfig)
  const [activeTab, setActiveTab] = useState<TabKey>('api')
  const [dataPath, setDataPath] = useState('')
  const [defaultPath, setDefaultPath] = useState('')
  const [customPath, setCustomPath] = useState('')

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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={toggleSettings}>
      <div className="bg-gray-800 rounded-lg w-full max-w-lg shadow-xl flex overflow-hidden" onClick={e => e.stopPropagation()} style={{ height: 420 }}>
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
                <div>
                  <label className="block text-sm text-gray-400 mb-1">API Key</label>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={e => setForm({ ...form, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={form.baseUrl}
                    onChange={e => setForm({ ...form, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">模型</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={e => setForm({ ...form, model: e.target.value })}
                    placeholder="gpt-4o-mini"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-2">
                {[
                  { key: 'polish', label: '润色优化', desc: '自动检测并优化薄弱片段' },
                  { key: 'summary', label: '章节摘要', desc: '生成章节结构化摘要（人物、事件、伏笔）' }
                ].map(feat => (
                  <label
                    key={feat.key}
                    className="flex items-center justify-between px-3 py-3 bg-gray-700/50 rounded cursor-pointer hover:bg-gray-700 transition-colors"
                  >
                    <div>
                      <p className="text-sm text-gray-200">{feat.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{feat.desc}</p>
                    </div>
                    <div
                      onClick={() =>
                        setForm({
                          ...form,
                          aiFeatures: { ...form.aiFeatures, [feat.key]: !form.aiFeatures[feat.key] }
                        })
                      }
                      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                        form.aiFeatures[feat.key] ? 'bg-blue-600' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          form.aiFeatures[feat.key] ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                  </label>
                ))}
                <p className="text-[11px] text-gray-600 px-1 pt-1">后续功能将在此处添加</p>
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
