import { useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { ContextMenu, RenameInput, BackButton } from './ContextMenu'
import type { MenuItem } from './ContextMenu'

export function VolumeLevel() {
  const { currentVolumeId, volumes, chapters, navTo, navBack, createChapter, deleteChapter, renameChapter, setEditingAIConfig, openDialogue, openOutline, refineVolumeSummaries, isRefining, refineProgress } = useAppStore()
  const [showNewChapter, setShowNewChapter] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [createError, setCreateError] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)

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

        {/* Batch refine summaries (not for unassigned) */}
        {!isUnassigned && volumeChapters.length > 0 && (
          <button
            onClick={refineVolumeSummaries}
            disabled={isRefining}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-orange-400 hover:bg-orange-500/10 transition-colors border-b border-[var(--nw-panel-border)] disabled:opacity-50"
          >
            <span className="text-[12px]">📝</span>
            <span>{isRefining && refineProgress ? `精炼中 ${refineProgress.current}/${refineProgress.total}` : '批量精炼总结'}</span>
          </button>
        )}

        {/* Chapters */}
        <div className="py-1">
          {volumeChapters.map(ch => (
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
                    className="truncate flex-1"
                    onClick={() => useAppStore.getState().selectChapter(ch)}
                  >
                    {ch.title}
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
          ))}
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
