import { useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { ContextMenu, RenameInput, BackButton } from './ContextMenu'
import type { MenuItem } from './ContextMenu'

export function ProjectLevel() {
  const { currentProject, volumes, chapters, navTo, navBack, createVolume, deleteVolume, renameVolume, setEditingAIConfig, openDialogue, openOutline } = useAppStore()
  const [showNewVolume, setShowNewVolume] = useState(false)
  const [newVolumeName, setNewVolumeName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)

  const unassignedChapters = chapters.filter(c => !c.volumeId)

  const handleCreateVolume = () => {
    if (!newVolumeName.trim()) return
    createVolume(newVolumeName.trim())
    setNewVolumeName('')
    setShowNewVolume(false)
  }

  if (!currentProject) return null

  return (
    <div className="flex flex-col h-full">
      <BackButton label={currentProject.name} onClick={navBack} />

      <div className="flex-1 overflow-y-auto">
        {/* Book-level AI config */}
        <button
          onClick={() => setEditingAIConfig('book')}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-amber-400 hover:bg-amber-600/10 transition-colors border-b border-gray-700/50"
        >
          <span className="text-[11px]">⚙</span>
          <span>书籍 AI 配置</span>
        </button>

        {/* Book-level dialogue */}
        <button
          onClick={() => openDialogue('book')}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-blue-400 hover:bg-blue-600/10 transition-colors border-b border-gray-700/50"
        >
          <span className="text-[11px]">💬</span>
          <span>AI 对话</span>
        </button>

        {/* Book outline */}
        {currentProject && (
          <button
            onClick={() => openOutline('book', currentProject.id)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-emerald-400 hover:bg-emerald-600/10 transition-colors border-b border-gray-700/50"
          >
            <span className="text-[11px]">📋</span>
            <span>书籍大纲</span>
          </button>
        )}

        {/* Volumes */}
        <div className="py-1">
          {volumes.map(vol => (
            <div
              key={vol.id}
              className="flex items-center justify-between px-3 py-2 text-sm cursor-pointer group hover:bg-gray-700/50 text-gray-300 transition-colors"
              onContextMenu={e => {
                e.preventDefault()
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  items: [
                    { label: '重命名', action: () => setRenamingId(vol.id) },
                    { label: '删除', action: () => deleteVolume(vol.id), danger: true }
                  ]
                })
              }}
            >
              {renamingId === vol.id ? (
                <RenameInput
                  value={vol.name}
                  onConfirm={v => { if (v) renameVolume(vol.id, v); setRenamingId(null) }}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <>
                  <span
                    className="truncate flex-1"
                    onClick={() => navTo('volume', vol.id)}
                  >
                    📖 {vol.name}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteVolume(vol.id) }}
                    className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 ml-1"
                  >
                    x
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Unassigned chapters */}
        {unassignedChapters.length > 0 && (
          <button
            onClick={() => navTo('volume', '__unassigned__')}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-400 hover:bg-gray-700/50 transition-colors border-t border-gray-700/50"
          >
            <span>未分卷章节</span>
            <span className="text-gray-600">{unassignedChapters.length}</span>
          </button>
        )}

        {/* New volume */}
        <div className="border-t border-gray-700/50">
          {showNewVolume ? (
            <div className="flex gap-1 px-3 py-2">
              <input
                value={newVolumeName}
                onChange={e => setNewVolumeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateVolume()}
                placeholder="卷名称"
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <button onClick={handleCreateVolume} className="text-xs bg-blue-600 px-2 py-1 rounded">OK</button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewVolume(true)}
              className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:text-blue-400 transition-colors"
            >
              + 新建卷
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
