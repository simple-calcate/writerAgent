import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'

export default function Settings() {
  const { llmConfig, saveLLMConfig, toggleSettings } = useAppStore()
  const [form, setForm] = useState(llmConfig)
  const [dataPath, setDataPath] = useState('')

  useEffect(() => {
    setForm(llmConfig)
    window.api.getDataPath().then(setDataPath)
  }, [llmConfig])

  const handleSave = () => {
    saveLLMConfig(form)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-semibold mb-4">设置</h2>

        <div className="space-y-4">
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

          {/* Data path info */}
          <div className="border-t border-gray-700 pt-4 mt-4">
            <p className="text-xs text-gray-500 mb-1">本地数据存储位置</p>
            <p className="text-xs text-gray-300 bg-gray-900 rounded px-3 py-2 font-mono break-all">
              {dataPath || '加载中...'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              配置和版本历史保存在此目录下的 data/store.json
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
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
  )
}
