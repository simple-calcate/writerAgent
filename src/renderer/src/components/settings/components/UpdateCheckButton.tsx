import { useState, useEffect } from 'react'
import type { UpdateStatus } from '../../../../../shared/types'

export default function UpdateCheckButton() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })
  const [giteeLoading, setGiteeLoading] = useState(false)

  useEffect(() => {
    const unsub = window.api.onUpdateStatus(setUpdateStatus)
    window.api.getUpdateStatus().then(setUpdateStatus)
    return unsub
  }, [])

  useEffect(() => {
    if (updateStatus.status === 'downloading' || updateStatus.status === 'downloaded' || updateStatus.status === 'error') {
      setGiteeLoading(false)
    }
  }, [updateStatus.status])

  const handleCheck = () => {
    setUpdateStatus({ status: 'checking' })
    window.api.checkForUpdates()
  }

  const handleDownload = () => {
    window.api.downloadUpdate()
  }

  const handleDownloadGitee = () => {
    setGiteeLoading(true)
    window.api.downloadFromGitee()
  }

  const handleInstall = () => {
    window.api.installUpdate()
  }

  const handleInstallGitee = () => {
    window.api.installGiteeUpdate()
  }

  const statusUI: Record<string, { text: string; color: string }> = {
    idle: { text: '尚未检查', color: 'text-[var(--nw-text-muted)]' },
    checking: { text: '正在检查更新...', color: 'text-blue-400' },
    available: { text: `发现新版本 v${updateStatus.version}`, color: 'text-blue-400' },
    downloading: { text: `正在下载 v${updateStatus.version}...`, color: 'text-amber-400' },
    downloaded: { text: `v${updateStatus.version} 已下载完成`, color: 'text-emerald-400' },
    'not-available': { text: '当前已是最新版本', color: 'text-[var(--nw-text-secondary)]' },
    error: { text: '检查失败', color: 'text-red-400' }
  }

  const current = statusUI[updateStatus.status] || statusUI.idle

  return (
    <div className="space-y-2">
      {/* Status line */}
      <div className="flex items-center gap-2">
        {updateStatus.status === 'checking' && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
        )}
        <span className={`text-[10px] ${current.color}`}>{current.text}</span>
      </div>

      {/* Download progress */}
      {updateStatus.status === 'downloading' && updateStatus.progress && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[var(--nw-surface-2)] rounded-full h-1.5">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${updateStatus.progress.percent}%` }}
            />
          </div>
          <span className="text-[10px] text-[var(--nw-text-muted)] shrink-0">
            {updateStatus.progress.percent}% · {(updateStatus.progress.transferred / 1024 / 1024).toFixed(1)}/{(updateStatus.progress.total / 1024 / 1024).toFixed(1)} MB
          </span>
        </div>
      )}

      {/* Error detail */}
      {updateStatus.status === 'error' && updateStatus.error && (
        <p className="text-[10px] text-red-400/70 break-all">{updateStatus.error}</p>
      )}

      {/* Release notes */}
      {updateStatus.status === 'available' && updateStatus.releaseNotes && (
        <div className="text-[11px] text-[var(--nw-text-secondary)] bg-[var(--nw-surface-2)]/50 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {updateStatus.releaseNotes}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {(updateStatus.status === 'idle' || updateStatus.status === 'not-available' || updateStatus.status === 'error') && (
          <button
            onClick={handleCheck}
            className="px-3 py-1.5 text-xs bg-[var(--nw-surface-2)] hover:bg-white/10 text-[var(--nw-text-secondary)] rounded transition-colors"
          >
            {updateStatus.status === 'error' ? '重新检查' : '检查更新'}
          </button>
        )}
        {(updateStatus.status === 'error' || updateStatus.status === 'available') && (
          <button
            onClick={handleDownloadGitee}
            disabled={giteeLoading}
            className="px-3 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors disabled:opacity-50"
          >
            {giteeLoading ? '连接中...' : '从 Gitee 下载'}
          </button>
        )}
        {updateStatus.status === 'available' && (
          <button onClick={handleDownload} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">
            从 GitHub 下载
          </button>
        )}
        {updateStatus.status === 'downloaded' && (
          <button onClick={updateStatus.giteeInstallerPath ? handleInstallGitee : handleInstall} className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors">
            退出并安装
          </button>
        )}
      </div>
    </div>
  )
}
