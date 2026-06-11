import { useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { getGenreList } from '../../../../shared/novel-knowledge'
import { ContextMenu, RenameInput } from './ContextMenu'
import type { MenuItem } from './ContextMenu'

export function ProjectsLevel() {
  const { projects, currentProject, selectProject, createProject, deleteProject, renameProject, navTo, importBookPreview } = useAppStore()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGenre, setNewGenre] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const genreList = getGenreList()

  const handleCreate = () => {
    if (!newName.trim()) return
    createProject(newName.trim(), newGenre)
    setNewName('')
    setNewGenre(null)
    setShowNew(false)
  }

  const handleContextMenu = (e: React.MouseEvent, p: { id: string; name: string }) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: '重命名', action: () => setRenamingId(p.id) },
        { label: '删除', action: () => deleteProject(p.id), danger: true }
      ]
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50">
        <span className="text-sm font-medium text-gray-300">项目</span>
        <div className="flex gap-2">
          <button onClick={() => importBookPreview()} className="text-xs text-green-400 hover:text-green-300">导入</button>
          <button onClick={() => setShowNew(!showNew)} className="text-xs text-blue-400 hover:text-blue-300">+ 新建</button>
        </div>
      </div>

      {showNew && (
        <div className="px-3 py-2 space-y-1 border-b border-gray-700/50">
          <div className="flex gap-1">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="项目名称"
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button onClick={handleCreate} className="text-xs bg-blue-600 px-2 py-1 rounded">OK</button>
          </div>
          <select
            value={newGenre || ''}
            onChange={e => setNewGenre(e.target.value || null)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none"
          >
            <option value="">选择类型（可选）</option>
            {genreList.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {projects.map(p => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer group transition-colors ${
              currentProject?.id === p.id ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-gray-700/50 text-gray-300'
            }`}
            onContextMenu={e => handleContextMenu(e, p)}
          >
            {renamingId === p.id ? (
              <RenameInput
                value={p.name}
                onConfirm={v => { if (v) renameProject(p.id, v); setRenamingId(null) }}
                onCancel={() => setRenamingId(null)}
              />
            ) : (
              <>
                <span
                  className="truncate flex-1"
                  onClick={() => selectProject(p)}
                >
                  {p.name}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); deleteProject(p.id) }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 ml-1"
                >
                  x
                </button>
              </>
            )}
          </div>
        ))}
        {projects.length === 0 && (
          <p className="px-3 py-4 text-xs text-gray-600 text-center">暂无项目</p>
        )}
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
