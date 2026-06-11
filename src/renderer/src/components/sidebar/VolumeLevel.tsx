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
          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-blue-400 hover:bg-blue-600/10 transition-colors border-b border-gray-700/50"
        >
          <span className="text-[11px]">💬</span>
          <span>AI 对话</span>
        </button>

        {/* Volume outline (not for unassigned) */}
        {!isUnassigned && volume && (
          <button
            onClick={() => openOutline('volume', volume.id)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-emerald-400 hover:bg-emerald-600/10 transition-colors border-b border-gray-700/50"
          >
            <span className="text-[11px]">📋</span>
            <span>卷纲</span>
          </button>
        )}

        {/* Batch refine summaries (not for unassigned) */}
        {!isUnassigned && volumeChapters.length > 0 && (
          <button
            onClick={refineVolumeSummaries}
            disabled={isRefining}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-orange-400 hover:bg-orange-600/10 transition-colors border-b border-gray-700/50 disabled:opacity-50"
          >
            <span className="text-[11px]">📝</span>
            <span>{isRefining && refineProgress ? `精炼中 ${refineProgress.current}/${refineProgress.total}` : '批量精炼总结'}</span>
          </button>
        )}

        {/* Chapters */}
        <div className="py-1">
          {volumeChapters.map(ch => (
            <div
              key={ch.id}
              className="flex items-center justify-between px-3 py-2 text-sm cursor-pointer group hover:bg-gray-700/50 text-gray-300 transition-colors"
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
                    className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 ml-1"
                  >
                    x
                  </button>
                </>
              )}
            </div>
          ))}
          {volumeChapters.length === 0 && (
            <p className="px-3 py-4 text-xs text-gray-600 text-center">暂无章节</p>
          )}
        </div>

        {/* New chapter */}
        <div className="border-t border-gray-700/50">
          {showNewChapter ? (
            <div className="px-3 py-2">
              <div className="flex gap-1">
                <input
                  value={newTitle}
                  onChange={e => { setNewTitle(e.target.value); setCreateError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="章节标题"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button onClick={handleCreate} className="text-xs bg-blue-600 px-2 py-1 rounded">OK</button>
              </div>
              {createError && (
                <p className="text-[10px] text-red-400 mt-1">{createError}</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowNewChapter(true)}
              className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:text-blue-400 transition-colors"
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
