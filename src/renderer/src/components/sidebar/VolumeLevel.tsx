import { useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { ContextMenu, RenameInput, BackButton } from './ContextMenu'
import type { MenuItem } from './ContextMenu'
import { getSummaryStatus } from '../../../../shared/utils/contentHash'

type BatchRange = 'volume' | 'all'

export function VolumeLevel() {
  const { currentVolumeId, volumes, chapters, navTo, navBack, createChapter, deleteChapter, renameChapter, setEditingAIConfig, openDialogue, openOutline, refineVolumeSummaries, isRefining, refineProgress,
    isBatchSummarizing, batchProgress, batchResult, batchError, summarizeBatch, cancelBatchSummarize, clearBatchResult,
    isBatchRefining, batchRefineProgress, batchRefineResult, batchRefineError, refineBatch, cancelBatchRefine, clearBatchRefineResult } = useAppStore()
  const [showNewChapter, setShowNewChapter] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [createError, setCreateError] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)

  // 批量摘要范围选择
  const [showBatchPanel, setShowBatchPanel] = useState(false)
  const [batchRange, setBatchRange] = useState<BatchRange>('volume')
  const [skipFresh, setSkipFresh] = useState(true)

  // 批量精炼范围选择（独立状态，和批量摘要分开）
  const [showRefinePanel, setShowRefinePanel] = useState(false)
  const [refineRange, setRefineRange] = useState<BatchRange>('volume')
  const [refineSkipFresh, setRefineSkipFresh] = useState(true)

  const isUnassigned = currentVolumeId === '__unassigned__'
  const volume = isUnassigned ? null : volumes.find(v => v.id === currentVolumeId)
  const volumeChapters = isUnassigned
    ? chapters.filter(c => !c.volumeId)
    : chapters.filter(c => c.volumeId === currentVolumeId)

  const handleCreate = () => {
    if (!newTitle.trim()) return
    setCreateError('')
    const duplicate = volumeChapters.some(c => c.title === newTitle.trim())
    if (duplicate) {
      setCreateError('该卷下已存在同名章节')
      return
    }
    createChapter(newTitle.trim(), isUnassigned ? null : currentVolumeId)
    setNewTitle('')
    setShowNewChapter(false)
  }

  const label = isUnassigned ? '未分卷章节' : volume?.name || '卷'

  // 启动批量摘要
  const handleStartBatch = () => {
    const targetChapters = batchRange === 'volume' ? volumeChapters : chapters
    const ids = targetChapters.map(c => c.id)
    if (ids.length === 0) return
    setShowBatchPanel(false)
    void summarizeBatch(ids, { skipFresh })
  }

  // 启动批量精炼
  const handleStartRefine = () => {
    const targetChapters = refineRange === 'volume' ? volumeChapters : chapters
    const ids = targetChapters.map(c => c.id)
    if (ids.length === 0) return
    setShowRefinePanel(false)
    void refineBatch(ids, { skipFresh: refineSkipFresh })
  }

  // 批量摘要的统计预览（仅用于面板提示）
  const batchPreview = (() => {
    const targetChapters = batchRange === 'volume' ? volumeChapters : chapters
    if (targetChapters.length === 0) return { total: 0, toGen: 0, skip: 0 }
    const toGen = skipFresh
      ? targetChapters.filter(c => c.content.trim() && getSummaryStatus(c) !== 'fresh').length
      : targetChapters.filter(c => c.content.trim()).length
    return {
      total: targetChapters.length,
      toGen,
      skip: targetChapters.length - toGen
    }
  })()

  // 批量精炼的统计预览
  const refinePreview = (() => {
    const targetChapters = refineRange === 'volume' ? volumeChapters : chapters
    if (targetChapters.length === 0) return { total: 0, toGen: 0, skip: 0 }
    const toGen = refineSkipFresh
      ? targetChapters.filter(c => c.content.trim() && getSummaryStatus(c) !== 'fresh').length
      : targetChapters.filter(c => c.content.trim()).length
    return {
      total: targetChapters.length,
      toGen,
      skip: targetChapters.length - toGen
    }
  })()

  return (
    <div className="flex flex-col h-full">
      <BackButton label={label} onClick={navBack} />

      <div className="flex-1 overflow-y-auto">
        {/* Volume dialogue */}
        <button
          onClick={() => openDialogue('volume')}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-blue-400 hover:bg-blue-500/10 transition-colors border-b border-[var(--nw-panel-border)]"
        >
          <span className="text-[12px]">💬</span>
          <span>AI 对话</span>
        </button>

        {/* Volume outline (not for unassigned) */}
        {!isUnassigned && volume && (
          <button
            onClick={() => openOutline('volume', volume.id)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-emerald-400 hover:bg-emerald-500/10 transition-colors border-b border-[var(--nw-panel-border)]"
          >
            <span className="text-[12px]">📋</span>
            <span>卷纲</span>
          </button>
        )}

        {/* Batch summarize (生成摘要) */}
        {volumeChapters.length > 0 && (
          <div className="border-b border-[var(--nw-panel-border)]">
            {isBatchSummarizing ? (
              <BatchProgressItem
                progress={batchProgress}
                onCancel={cancelBatchSummarize}
                mode="summary"
              />
            ) : batchResult ? (
              <BatchResultItem
                result={batchResult}
                error={batchError}
                onDismiss={clearBatchResult}
                mode="summary"
              />
            ) : showBatchPanel ? (
              <div className="px-3.5 py-3 space-y-2.5">
                <div className="text-[11px] text-[var(--nw-text-secondary)] font-medium">批量生成摘要</div>

                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-[11px] text-[var(--nw-text-secondary)] cursor-pointer">
                    <input
                      type="radio"
                      checked={batchRange === 'volume'}
                      onChange={() => setBatchRange('volume')}
                      className="accent-[var(--nw-accent)]"
                    />
                    <span>当前卷（{volumeChapters.length} 章）</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--nw-text-secondary)] cursor-pointer">
                    <input
                      type="radio"
                      checked={batchRange === 'all'}
                      onChange={() => setBatchRange('all')}
                      className="accent-[var(--nw-accent)]"
                    />
                    <span>全部章节（{chapters.length} 章）</span>
                  </label>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-[var(--nw-text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipFresh}
                    onChange={e => setSkipFresh(e.target.checked)}
                    className="accent-[var(--nw-accent)]"
                  />
                  <span>跳过摘要仍最新的章节</span>
                </label>

                <div className="text-[10px] text-[var(--nw-text-muted)] leading-relaxed">
                  {batchPreview.total === 0
                    ? '当前范围无章节'
                    : `将生成 ${batchPreview.toGen} 章${
                        batchPreview.skip > 0 ? `（跳过 ${batchPreview.skip} 章已最新或空）` : ''
                      }`}
                </div>

                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={handleStartBatch}
                    disabled={batchPreview.toGen === 0}
                    className="flex-1 text-[11px] bg-[var(--nw-accent)] hover:bg-[var(--nw-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white px-2 py-1.5 rounded-md transition-colors"
                  >
                    开始生成
                  </button>
                  <button
                    onClick={() => setShowBatchPanel(false)}
                    className="text-[11px] text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)] px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowBatchPanel(true)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-purple-400 hover:bg-purple-500/10 transition-colors"
              >
                <span className="text-[12px]">◉</span>
                <span>批量生成摘要</span>
              </button>
            )}
          </div>
        )}

        {/* Batch refine summaries (精炼总结) */}
        {volumeChapters.length > 0 && (
          <div className="border-b border-[var(--nw-panel-border)]">
            {isBatchRefining ? (
              <BatchProgressItem
                progress={batchRefineProgress}
                onCancel={cancelBatchRefine}
                mode="refine"
              />
            ) : batchRefineResult ? (
              <BatchResultItem
                result={batchRefineResult}
                error={batchRefineError}
                onDismiss={clearBatchRefineResult}
                mode="refine"
              />
            ) : showRefinePanel ? (
              <div className="px-3.5 py-3 space-y-2.5">
                <div className="text-[11px] text-[var(--nw-text-secondary)] font-medium">批量精炼总结</div>

                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-[11px] text-[var(--nw-text-secondary)] cursor-pointer">
                    <input
                      type="radio"
                      checked={refineRange === 'volume'}
                      onChange={() => setRefineRange('volume')}
                      className="accent-orange-400"
                    />
                    <span>当前卷（{volumeChapters.length} 章）</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--nw-text-secondary)] cursor-pointer">
                    <input
                      type="radio"
                      checked={refineRange === 'all'}
                      onChange={() => setRefineRange('all')}
                      className="accent-orange-400"
                    />
                    <span>全部章节（{chapters.length} 章）</span>
                  </label>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-[var(--nw-text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={refineSkipFresh}
                    onChange={e => setRefineSkipFresh(e.target.checked)}
                    className="accent-orange-400"
                  />
                  <span>跳过摘要仍最新的章节</span>
                </label>

                <div className="text-[10px] text-[var(--nw-text-muted)] leading-relaxed">
                  {refinePreview.total === 0
                    ? '当前范围无章节'
                    : `将精炼 ${refinePreview.toGen} 章${
                        refinePreview.skip > 0 ? `（跳过 ${refinePreview.skip} 章已最新或空）` : ''
                      }`}
                </div>

                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={handleStartRefine}
                    disabled={refinePreview.toGen === 0}
                    className="flex-1 text-[11px] bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2 py-1.5 rounded-md transition-colors"
                  >
                    开始精炼
                  </button>
                  <button
                    onClick={() => setShowRefinePanel(false)}
                    className="text-[11px] text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)] px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowRefinePanel(true)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-orange-400 hover:bg-orange-500/10 transition-colors"
              >
                <span className="text-[12px]">📝</span>
                <span>批量精炼总结</span>
              </button>
            )}
          </div>
        )}

        {/* Chapters */}
        <div className="py-1">
          {volumeChapters.map(ch => {
            const status = getSummaryStatus(ch)
            return (
              <div
                key={ch.id}
                className="flex items-center justify-between px-3.5 py-2.5 text-[13px] cursor-pointer group hover:bg-[var(--nw-surface-1)] text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)] transition-colors"
                onContextMenu={e => {
                  e.preventDefault()
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    items: [
                      { label: '重命名', action: () => setRenamingId(ch.id) },
                      { label: '删除', action: () => deleteChapter(ch.id), danger: true }
                    ]
                  })
                }}
              >
                {renamingId === ch.id ? (
                  <RenameInput
                    value={ch.title}
                    onConfirm={v => { if (v) renameChapter(ch.id, v); setRenamingId(null) }}
                    onCancel={() => setRenamingId(null)}
                  />
                ) : (
                  <>
                    <span
                      className="truncate flex-1 flex items-center gap-1.5"
                      onClick={() => useAppStore.getState().selectChapter(ch)}
                    >
                      {/* 摘要状态徽章 */}
                      <SummaryStatusDot status={status} />
                      <span className="truncate">{ch.title}</span>
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteChapter(ch.id) }}
                      className="opacity-0 group-hover:opacity-100 text-[11px] text-red-400 hover:text-red-300 ml-1.5 transition-colors"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            )
          })}
          {volumeChapters.length === 0 && (
            <p className="px-3.5 py-5 text-[11px] text-[var(--nw-text-muted)] text-center">暂无章节</p>
          )}
        </div>

        {/* New chapter */}
        <div className="border-t border-[var(--nw-panel-border)]">
          {showNewChapter ? (
            <div className="px-3.5 py-2">
              <div className="flex gap-1.5">
                <input
                  value={newTitle}
                  onChange={e => { setNewTitle(e.target.value); setCreateError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="章节标题"
                  className="flex-1 bg-[var(--nw-surface-1)] border border-white/12 rounded-md px-2.5 py-1.5 text-[12px] text-[var(--nw-text-primary)] focus:outline-none focus:border-[var(--nw-accent)]"
                  autoFocus
                />
                <button onClick={handleCreate} className="text-[11px] bg-[var(--nw-accent)] hover:bg-[var(--nw-accent-hover)] text-white px-3 py-1.5 rounded-md transition-colors">OK</button>
              </div>
              {createError && (
                <p className="text-[10px] text-red-400 mt-1">{createError}</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowNewChapter(true)}
              className="w-full text-left px-3.5 py-2.5 text-[12px] text-[var(--nw-text-muted)] hover:text-[var(--nw-accent)] hover:bg-[var(--nw-accent-glow)] transition-colors"
            >
              + 新建章节
            </button>
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

/** 摘要状态小圆点徽章 */
function SummaryStatusDot({ status }: { status: 'none' | 'stale' | 'fresh' }) {
  const config = {
    none: { color: 'bg-[var(--nw-text-muted)]', title: '未生成摘要' },
    stale: { color: 'bg-orange-400', title: '摘要已过期（内容已修改）' },
    fresh: { color: 'bg-emerald-400', title: '摘要最新' }
  }[status]
  return (
    <span
      className={`shrink-0 w-1.5 h-1.5 rounded-full ${config.color}`}
      title={config.title}
    />
  )
}

/** 批量进度展示（通用：摘要/精炼） */
function BatchProgressItem({
  progress,
  onCancel,
  mode
}: {
  progress: { current: number; total: number; chapterTitle: string; succeeded: number; failed: number } | null
  onCancel: () => void
  mode: 'summary' | 'refine'
}) {
  const current = progress?.current ?? 0
  const total = progress?.total ?? 0
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  const title = progress?.chapterTitle || '准备中...'
  const label = mode === 'summary' ? '批量生成摘要' : '批量精炼总结'
  const accentText = mode === 'summary' ? 'text-purple-300' : 'text-orange-300'
  const accentBar = mode === 'summary' ? 'bg-purple-400' : 'bg-orange-400'

  return (
    <div className="px-3.5 py-3 space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className={`${accentText} font-medium`}>{label}</span>
        <span className="text-[var(--nw-text-muted)]">{current}/{total}</span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${accentBar} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate flex-1 text-[10px] text-[var(--nw-text-muted)]" title={title}>
          {current > 0 ? `正在处理：${title}` : '正在启动...'}
        </span>
        <button
          onClick={onCancel}
          className="shrink-0 text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
        >
          停止
        </button>
      </div>
      {progress && (progress.succeeded > 0 || progress.failed > 0) && (
        <div className="flex gap-3 text-[10px] text-[var(--nw-text-muted)]">
          <span className="text-emerald-400">✓ {progress.succeeded}</span>
          {progress.failed > 0 && <span className="text-red-400">✗ {progress.failed}</span>}
        </div>
      )}
    </div>
  )
}

/** 批量完成结果展示（通用：摘要/精炼） */
function BatchResultItem({
  result,
  error,
  onDismiss,
  mode
}: {
  result: { succeeded: number; failed: number; skipped: number; cancelled: boolean }
  error?: string | null
  onDismiss: () => void
  mode: 'summary' | 'refine'
}) {
  const hasFailure = result.failed > 0
  const tone = result.cancelled
    ? 'text-orange-300'
    : hasFailure
      ? 'text-amber-300'
      : 'text-emerald-300'
  const actionLabel = mode === 'summary' ? '批量生成' : '批量精炼'

  return (
    <div className="px-3.5 py-3 space-y-2">
      <div className={`text-[11px] font-medium ${tone}`}>
        {result.cancelled ? `已停止${actionLabel}` : `${actionLabel}完成`}
      </div>
      <div className="flex gap-3 text-[10px] text-[var(--nw-text-secondary)]">
        <span>成功 {result.succeeded}</span>
        {result.failed > 0 && <span className="text-red-400">失败 {result.failed}</span>}
        {result.skipped > 0 && <span className="text-[var(--nw-text-muted)]">跳过 {result.skipped}</span>}
      </div>
      {error && (
        <div className="text-[10px] text-red-400 leading-relaxed break-all">{error}</div>
      )}
      <button
        onClick={onDismiss}
        className="text-[10px] text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)] px-2 py-1 rounded hover:bg-white/5 transition-colors"
      >
        知道了
      </button>
    </div>
  )
}
