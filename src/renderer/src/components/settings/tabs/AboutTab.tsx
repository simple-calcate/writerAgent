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
        <p className="text-xs text-[var(--nw-text-secondary)] mb-1">当前版本</p>
        <p className="text-sm text-[var(--nw-text-primary)]">v{appVersion || '...'}</p>
      </div>
      <div>
        <p className="text-xs text-[var(--nw-text-secondary)] mb-2">应用更新</p>
        <UpdateCheckButton />
      </div>
      <div className="border-t border-white/10/50 pt-4">
        <p className="text-xs text-[var(--nw-text-secondary)] mb-2">交流反馈</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 bg-[var(--nw-surface-2)]/30 rounded">
            <span className="text-sm">💬</span>
            <div>
              <p className="text-xs text-[var(--nw-text-secondary)]">QQ 群</p>
              <p className="text-[10px] text-[var(--nw-text-muted)]">892644653</p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText('892644653')}
              className="ml-auto px-2 py-0.5 text-[10px] bg-white/10 hover:bg-white/10 text-[var(--nw-text-secondary)] rounded transition-colors"
            >
              复制
            </button>
          </div>
          <div
            onClick={() => window.api.openExternal('https://github.com/simple-calcate/writerAgent/issues')}
            className="flex items-center gap-3 px-3 py-2 bg-[var(--nw-surface-2)]/30 rounded cursor-pointer hover:bg-[var(--nw-surface-2)]/50 transition-colors"
          >
            <span className="text-sm">🐛</span>
            <div>
              <p className="text-xs text-[var(--nw-text-secondary)]">GitHub Issues</p>
              <p className="text-[10px] text-[var(--nw-text-muted)]">提交 Bug 和功能建议</p>
            </div>
          </div>
          <div
            onClick={() => window.api.openExternal('https://gitee.com/simple-calcate/writerAgent/issues')}
            className="flex items-center gap-3 px-3 py-2 bg-[var(--nw-surface-2)]/30 rounded cursor-pointer hover:bg-[var(--nw-surface-2)]/50 transition-colors"
          >
            <span className="text-sm">📦</span>
            <div>
              <p className="text-xs text-[var(--nw-text-secondary)]">Gitee Issues</p>
              <p className="text-[10px] text-[var(--nw-text-muted)]">国内备用反馈渠道</p>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10/50 pt-4">
        <p className="text-[10px] text-[var(--nw-text-muted)] text-center">网文写作助手 — AI 深度整合的桌面端写作工具</p>
      </div>
    </div>
  )
}
