import { useState, useEffect } from 'react'
import UpdateCheckButton from '../components/UpdateCheckButton'

export default function AboutTab() {
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.api.getAppVersion().then(setAppVersion)
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-400 mb-1">当前版本</p>
        <p className="text-sm text-gray-200">v{appVersion || '...'}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-2">应用更新</p>
        <UpdateCheckButton />
      </div>
      <div className="border-t border-gray-700/50 pt-4">
        <p className="text-xs text-gray-400 mb-2">交流反馈</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-700/30 rounded">
            <span className="text-sm">💬</span>
            <div>
              <p className="text-xs text-gray-300">QQ 群</p>
              <p className="text-[10px] text-gray-500">892644653</p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText('892644653')}
              className="ml-auto px-2 py-0.5 text-[10px] bg-gray-600 hover:bg-gray-500 text-gray-300 rounded transition-colors"
            >
              复制
            </button>
          </div>
          <div
            onClick={() => window.api.openExternal('https://github.com/simple-calcate/writerAgent/issues')}
            className="flex items-center gap-3 px-3 py-2 bg-gray-700/30 rounded cursor-pointer hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-sm">🐛</span>
            <div>
              <p className="text-xs text-gray-300">GitHub Issues</p>
              <p className="text-[10px] text-gray-500">提交 Bug 和功能建议</p>
            </div>
          </div>
          <div
            onClick={() => window.api.openExternal('https://gitee.com/simple-calcate/writerAgent/issues')}
            className="flex items-center gap-3 px-3 py-2 bg-gray-700/30 rounded cursor-pointer hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-sm">📦</span>
            <div>
              <p className="text-xs text-gray-300">Gitee Issues</p>
              <p className="text-[10px] text-gray-500">国内备用反馈渠道</p>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-700/50 pt-4">
        <p className="text-[10px] text-gray-600 text-center">网文写作助手 — AI 深度整合的桌面端写作工具</p>
      </div>
    </div>
  )
}
