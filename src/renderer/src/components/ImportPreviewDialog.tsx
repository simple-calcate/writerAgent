import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'

export default function ImportPreviewDialog() {
  const { importPreview, showImportPreview, importBookConfirm, closeImportPreview, importProgress, setImportProgress } = useAppStore()
  const [bookName, setBookName] = useState(importPreview?.bookName || '')
  const [importing, setImporting] = useState(false)

  // 监听导入进度事件
  useEffect(() => {
    if (!importing) return
    const unsubscribe = window.api.onImportBookProgress((progress) => {
      setImportProgress(progress)
    })
    return unsubscribe
  }, [importing, setImportProgress])

  if (!showImportPreview || !importPreview) return null

  const handleConfirm = async () => {
    if (!bookName.trim() || importing) return
    setImporting(true)
    try {
      await importBookConfirm(bookName.trim(), importPreview.chapters)
    } catch (e) {
      alert('导入失败：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setImporting(false)
    }
  }

  // 章节数过多时给出提示
  const isLargeBook = importPreview.chapters.length > 500
  // 预览列表只显示前 200 章，避免渲染几千个 DOM 节点卡顿
  const previewLimit = 200
  const previewChapters = importPreview.chapters.slice(0, previewLimit)
  const hiddenCount = importPreview.chapters.length - previewChapters.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={importing ? undefined : closeImportPreview}>
      <div
        className="bg-[var(--nw-surface-2)] border border-white/15 rounded-lg shadow-2xl w-[480px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-medium text-[var(--nw-text-primary)]">导入预览</h2>
          <button
            onClick={closeImportPreview}
            disabled={importing}
            className="text-[var(--nw-text-muted)] hover:text-[var(--nw-text-secondary)] text-xs disabled:opacity-40"
          >✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Book name */}
          <div>
            <label className="block text-xs text-[var(--nw-text-secondary)] mb-1">书名</label>
            <input
              value={bookName}
              onChange={e => setBookName(e.target.value)}
              disabled={importing}
              className="w-full bg-[var(--nw-surface-2)]/50 border border-white/10 rounded px-3 py-2 text-xs text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-xs text-[var(--nw-text-secondary)]">
            <span>识别章节：<strong className="text-[var(--nw-text-primary)]">{importPreview.chapters.length}</strong> 章</span>
            <span>总字数：<strong className="text-[var(--nw-text-primary)]">{importPreview.totalChars.toLocaleString()}</strong> 字</span>
          </div>

          {/* 大书提示 */}
          {isLargeBook && !importing && (
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300">
              ⚠️ 章节数较多（{importPreview.chapters.length} 章），导入需要一些时间，请耐心等待。导入过程中会显示进度。
            </div>
          )}

          {/* 导入进度条 */}
          {importing && importProgress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[var(--nw-text-secondary)]">
                <span>正在导入...</span>
                <span>{importProgress.imported} / {importProgress.total}（{importProgress.percent}%）</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-150"
                  style={{ width: `${importProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Chapter list */}
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-[var(--nw-surface-2)]/30 text-xs text-[var(--nw-text-secondary)] font-medium">
              章节列表{hiddenCount > 0 ? `（仅显示前 ${previewLimit} 章）` : ''}
            </div>
            <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-700/50">
              {previewChapters.map((ch, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-[var(--nw-text-secondary)] truncate flex-1">{i + 1}. {ch.title}</span>
                  <span className="text-[var(--nw-text-muted)] ml-2 shrink-0">{ch.content.length.toLocaleString()} 字</span>
                </div>
              ))}
              {hiddenCount > 0 && (
                <div className="px-3 py-2 text-xs text-[var(--nw-text-muted)] text-center">
                  ... 还有 {hiddenCount} 章未显示
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/10">
          <button
            onClick={closeImportPreview}
            disabled={importing}
            className="px-4 py-1.5 text-xs text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)] hover:bg-[var(--nw-surface-2)] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!bookName.trim() || importing}
            className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {importing ? `导入中... ${importProgress?.percent ?? 0}%` : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
