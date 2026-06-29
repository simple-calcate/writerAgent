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
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--nw-panel-border)]">
        <span className="text-[13px] font-semibold tracking-wide text-[var(--nw-text-primary)]">项目</span>
        <div className="flex gap-2">
          <button onClick={() => importBookPreview()} className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-1.5 py-0.5 rounded transition-colors">导入</button>
          <button onClick={() => setShowNew(!showNew)} className="text-[11px] text-[var(--nw-accent)] hover:text-[var(--nw-accent-hover)] hover:bg-[var(--nw-accent-glow)] px-1.5 py-0.5 rounded transition-colors">+ 新建</button>
        </div>
      </div>

        {showNew && (
        <div className="px-3.5 py-2.5 space-y-2 border-b border-[var(--nw-panel-border)]">
          <div className="flex gap-1.5">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="项目名称"
              className="flex-1 bg-[var(--nw-surface-1)] border border-white/12 rounded-md px-2.5 py-1.5 text-[12px] text-[var(--nw-text-primary)] focus:outline-none focus:border-[var(--nw-accent)] focus:ring-1 focus:ring-[var(--nw-accent-glow)]"
              autoFocus
            />
            <button onClick={handleCreate} className="text-[11px] bg-[var(--nw-accent)] hover:bg-[var(--nw-accent-hover)] text-white px-3 py-1.5 rounded-md transition-colors">OK</button>
          </div>
          <select
            value={newGenre || ''}
            onChange={e => setNewGenre(e.target.value || null)}
            className="w-full bg-[var(--nw-surface-1)] border border-white/12 rounded-md px-2.5 py-1.5 text-[12px] text-[var(--nw-text-primary)] focus:outline-none"
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
            className={`flex items-center justify-between px-3.5 py-2.5 text-[13px] cursor-pointer group transition-all ${
              currentProject?.id === p.id ? 'bg-[var(--nw-accent-glow)] text-[var(--nw-accent)] border-l-2 border-[var(--nw-accent)]' : 'hover:bg-[var(--nw-surface-1)] text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)] border-l-2 border-transparent'
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
                  className="opacity-0 group-hover:opacity-100 text-[11px] text-red-400 hover:text-red-300 ml-1.5 transition-colors"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
        {projects.length === 0 && (
          <p className="px-3.5 py-5 text-[11px] text-[var(--nw-text-muted)] text-center">暂无项目</p>
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
