import { useEffect, useState, useRef } from 'react'
import type { UpdateStatus } from '../../../shared/types'

export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus>({ status: 'idle' })
  const [expanded, setExpanded] = useState(false)
  const [giteeLoading, setGiteeLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = window.api.onUpdateStatus(setStatus)
    return unsub
  }, [])

  // Click outside to close
  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  const handleCheck = () => {
    setStatus({ status: 'checking' })
    window.api.checkForUpdates()
  }

  const handleDownload = () => {
    window.api.downloadUpdate()
  }

  const handleDownloadGitee = () => {
    setGiteeLoading(true)
    window.api.downloadFromGitee()
  }

  // Reset giteeLoading when status changes
  useEffect(() => {
    if (status.status === 'downloading' || status.status === 'downloaded' || status.status === 'error') {
      setGiteeLoading(false)
    }
  }, [status.status])

  const handleInstall = () => {
    window.api.installUpdate()
  }

  const handleInstallGitee = () => {
    window.api.installGiteeUpdate()
  }

  // Don't show anything during idle or checking
  if (status.status === 'idle' || status.status === 'checking') return null
  // Don't show error for "no update available" on auto-check
  if (status.status === 'not-available') return null

  return (
    <div className="relative" ref={panelRef}>
      {/* Indicator button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded transition-colors ${
          status.status === 'error'
            ? 'text-red-400 hover:bg-red-900/30'
            : status.status === 'downloaded'
            ? 'text-emerald-400 hover:bg-emerald-900/30'
            : 'text-blue-400 hover:bg-blue-900/30'
        }`}
      >
        {status.status === 'available' && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>有新版本 v{status.version}</span>
          </>
        )}
        {status.status === 'downloading' && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>下载中 {status.progress?.percent ?? 0}%</span>
          </>
        )}
        {status.status === 'downloaded' && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>更新已就绪</span>
          </>
        )}
        {status.status === 'error' && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span>更新检查失败</span>
          </>
        )}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
          <div className="p-4">
            {/* Available */}
            {status.status === 'available' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-200">发现新版本 v{status.version}</h3>
                  <button onClick={() => setExpanded(false)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
                </div>
                {status.releaseNotes && (
                  <div className="text-xs text-gray-400 bg-gray-900/50 rounded p-2 mb-3 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {status.releaseNotes}
                  </div>
                )}
                <button
                  onClick={handleDownload}
                  className="w-full py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                >
                  从 GitHub 下载
                </button>
                <button
                  onClick={handleDownloadGitee}
                  disabled={giteeLoading}
                  className="w-full py-1.5 text-xs font-medium text-gray-400 bg-gray-700 hover:bg-gray-600 rounded transition-colors mt-1 disabled:opacity-50"
                >
                  {giteeLoading ? '正在连接 Gitee...' : '从 Gitee 下载（国内更快）'}
                </button>
              </>
            )}

            {/* Downloading */}
            {status.status === 'downloading' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-200">正在下载 v{status.version}</h3>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${status.progress?.percent ?? 0}%` }}
                  />
                </div>
                <div className="text-[10px] text-gray-500 text-right">
                  {status.progress ? `${(status.progress.transferred / 1024 / 1024).toFixed(1)} MB / ${(status.progress.total / 1024 / 1024).toFixed(1)} MB` : ''}
                </div>
              </>
            )}

            {/* Downloaded */}
            {status.status === 'downloaded' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-200">更新已下载</h3>
                  <button onClick={() => setExpanded(false)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
                </div>
                <p className="text-xs text-gray-400 mb-3">v{status.version} 已准备好安装，重启后生效。</p>
                <button
                  onClick={status.giteeInstallerPath ? handleInstallGitee : handleInstall}
                  className="w-full py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
                >
                  重启安装
                </button>
              </>
            )}

            {/* Error */}
            {status.status === 'error' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-200">更新检查失败</h3>
                  <button onClick={() => setExpanded(false)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
                </div>
                <p className="text-xs text-gray-400 mb-3">{status.error || '网络连接失败，请稍后重试。'}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCheck}
                    className="flex-1 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    重试
                  </button>
                  <button
                    onClick={handleDownloadGitee}
                    disabled={giteeLoading}
                    className="flex-1 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded transition-colors disabled:opacity-50"
                  >
                    {giteeLoading ? '连接中...' : '从 Gitee 下载'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
