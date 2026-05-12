import { useState } from 'react'
import { useAppStore } from '../stores/useAppStore'

function RenameInput({ value, onConfirm, onCancel }: { value: string; onConfirm: (v: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(value)
  return (
    <input
      value={text}
      onChange={e => setText(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onConfirm(text.trim())
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={() => onConfirm(text.trim())}
      className="flex-1 bg-gray-700 border border-blue-500 rounded px-2 py-0.5 text-xs focus:outline-none"
      autoFocus
      onClick={e => e.stopPropagation()}
    />
  )
}

export default function Sidebar() {
  const {
    projects, currentProject, chapters, currentChapter,
    createProject, selectProject, deleteProject, renameProject,
    createChapter, selectChapter, deleteChapter, renameChapter
  } = useAppStore()

  const [newProjectName, setNewProjectName] = useState('')
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [showNewChapter, setShowNewChapter] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return
    createProject(newProjectName.trim())
    setNewProjectName('')
    setShowNewProject(false)
  }

  const handleCreateChapter = () => {
    if (!newChapterTitle.trim()) return
    createChapter(newChapterTitle.trim())
    setNewChapterTitle('')
    setShowNewChapter(false)
  }

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col h-full select-none">
      {/* Projects header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">项目</span>
          <button
            onClick={() => setShowNewProject(!showNewProject)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            + 新建
          </button>
        </div>

        {showNewProject && (
          <div className="flex gap-1 mb-2">
            <input
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
              placeholder="项目名称"
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button onClick={handleCreateProject} className="text-xs bg-blue-600 px-2 py-1 rounded">OK</button>
          </div>
        )}

        <div className="space-y-1 max-h-40 overflow-y-auto">
          {projects.map(p => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer group ${
                currentProject?.id === p.id ? 'bg-blue-600/30 text-blue-300' : 'hover:bg-gray-700 text-gray-300'
              }`}
            >
              {renamingId === p.id ? (
                <RenameInput
                  value={p.name}
                  onConfirm={(v) => { if (v) renameProject(p.id, v); setRenamingId(null) }}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <>
                  <span
                    className="truncate flex-1"
                    onClick={() => selectProject(p)}
                    onDoubleClick={() => setRenamingId(p.id)}
                  >
                    {p.name}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProject(p.id) }}
                    className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 ml-1"
                  >
                    x
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chapters */}
      {currentProject && (
        <div className="flex-1 p-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">章节</span>
            <button
              onClick={() => setShowNewChapter(!showNewChapter)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              + 新建
            </button>
          </div>

          {showNewChapter && (
            <div className="flex gap-1 mb-2">
              <input
                value={newChapterTitle}
                onChange={e => setNewChapterTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateChapter()}
                placeholder="章节标题"
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <button onClick={handleCreateChapter} className="text-xs bg-blue-600 px-2 py-1 rounded">OK</button>
            </div>
          )}

          <div className="space-y-1">
            {chapters.map(ch => (
              <div
                key={ch.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer group ${
                  currentChapter?.id === ch.id ? 'bg-blue-600/30 text-blue-300' : 'hover:bg-gray-700 text-gray-300'
                }`}
              >
                {renamingId === ch.id ? (
                  <RenameInput
                    value={ch.title}
                    onConfirm={(v) => { if (v) renameChapter(ch.id, v); setRenamingId(null) }}
                    onCancel={() => setRenamingId(null)}
                  />
                ) : (
                  <>
                    <span
                      className="truncate flex-1"
                      onClick={() => selectChapter(ch)}
                      onDoubleClick={() => setRenamingId(ch.id)}
                    >
                      {ch.title}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteChapter(ch.id) }}
                      className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 ml-1"
                    >
                      x
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
