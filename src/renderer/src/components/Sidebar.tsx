import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { getGenreList } from '../../../shared/novel-knowledge'
import type { BookAIConfig, WritingGuidance } from '../../../shared/types'
import { DEFAULT_BOOK_AI_CONFIG, DEFAULT_WRITING_GUIDANCE } from '../../../shared/types'

// ─── Context Menu ───

interface MenuItem {
  label: string
  action: () => void
  danger?: boolean
}

function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[100px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); onClose() }}
          className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
            item.danger
              ? 'text-red-400 hover:bg-red-600/20'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ─── Rename Input ───

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
      className="flex-1 bg-gray-700 border border-blue-500 rounded px-2 py-1 text-xs focus:outline-none"
      autoFocus
      onClick={e => e.stopPropagation()}
    />
  )
}

// ─── Back Button ───

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors w-full text-left border-b border-gray-700/50"
    >
      <span className="text-[10px]">◀</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

// ─── Slide Panel Wrapper ───

function SlidePanel({ active, direction, children }: { active: boolean; direction: 'left' | 'right'; children: React.ReactNode }) {
  const translateClass = active
    ? 'translate-x-0'
    : direction === 'left'
      ? '-translate-x-full'
      : 'translate-x-full'

  return (
    <div className={`absolute inset-0 transition-transform duration-200 ease-in-out ${translateClass} flex flex-col bg-gray-800`}>
      {children}
    </div>
  )
}

// ─── Level 1: Projects ───

function ProjectsLevel() {
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

// ─── Level 2: Project Contents ───

function ProjectLevel() {
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

// ─── Level 3: Volume Contents ───

function VolumeLevel() {
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
        {/* Volume AI config (not for unassigned) */}
        {!isUnassigned && volume && (
          <button
            onClick={() => setEditingAIConfig('volume', volume.id)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-amber-400 hover:bg-amber-600/10 transition-colors border-b border-gray-700/50"
          >
            <span className="text-[11px]">⚙</span>
            <span>卷 AI 配置</span>
          </button>
        )}

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

// ─── Level 4: Chapter ───

function ChapterLevel() {
  const { currentChapter, navBack, setRightPanel, autoAnalyze, summarizeChapter, refineSummary, isAnalyzing, isSummarizing, isRefining, llmConfig, openDialogue, openOutline } = useAppStore()

  if (!currentChapter) return null

  const marksCount = currentChapter.polishingMarks?.length || 0
  const hasSummary = !!currentChapter.summaryResult
  const features = llmConfig.aiFeatures

  return (
    <div className="flex flex-col h-full">
      <BackButton label={currentChapter.title} onClick={navBack} />

      <div className="flex-1 overflow-y-auto py-1">
        {/* AI results */}
        {marksCount > 0 && (
          <button
            onClick={() => setRightPanel('polish')}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-blue-300 hover:bg-blue-600/10 transition-colors"
          >
            <span className="text-[11px]">◎</span>
            <span>润色标记</span>
            <span className="ml-auto text-gray-500">{marksCount}</span>
          </button>
        )}
        {hasSummary && (
          <button
            onClick={() => setRightPanel('summary')}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-purple-300 hover:bg-purple-600/10 transition-colors"
          >
            <span className="text-[11px]">◉</span>
            <span>章节摘要</span>
          </button>
        )}

        {/* AI actions */}
        <div className="border-t border-gray-700/50 mt-1 pt-1">
          {features.polish.enabled && (
            <button
              onClick={autoAnalyze}
              disabled={isAnalyzing}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-blue-400 hover:bg-blue-600/10 transition-colors disabled:opacity-50"
            >
              <span className="text-[11px]">◎</span>
              <span>{isAnalyzing ? '正在润色...' : '开始润色'}</span>
            </button>
          )}
          {features.summary.enabled && (
            <button
              onClick={summarizeChapter}
              disabled={isSummarizing}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-purple-400 hover:bg-purple-600/10 transition-colors disabled:opacity-50"
            >
              <span className="text-[11px]">◉</span>
              <span>{isSummarizing ? '正在生成...' : '生成摘要'}</span>
            </button>
          )}
          {features.summary.enabled && (
            <button
              onClick={refineSummary}
              disabled={isRefining}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-orange-400 hover:bg-orange-600/10 transition-colors disabled:opacity-50"
            >
              <span className="text-[11px]">📝</span>
              <span>{isRefining ? '正在精炼...' : '精炼总结'}</span>
            </button>
          )}
          {features.dialogue.enabled && (
            <button
              onClick={() => openDialogue('chapter')}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-green-400 hover:bg-green-600/10 transition-colors"
            >
              <span className="text-[11px]">💬</span>
              <span>AI 对话</span>
            </button>
          )}
          <button
            onClick={() => openOutline('chapter', currentChapter.id)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-emerald-400 hover:bg-emerald-600/10 transition-colors"
          >
            <span className="text-[11px]">📋</span>
            <span>章纲</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Level 5: AI Config ───

function AIConfigLevel() {
  const {
    editingAIConfig, editingVolumeId,
    currentProject, volumes,
    saveBookAIConfig, saveVolumeAIConfig, navBack
  } = useAppStore()

  const isBookLevel = editingAIConfig === 'book'

  const existingConfig = isBookLevel
    ? (currentProject?.aiConfig || DEFAULT_BOOK_AI_CONFIG)
    : (volumes.find(v => v.id === editingVolumeId)?.aiConfig || {})

  const [polishStandard, setPolishStandard] = useState(existingConfig.polishStandard || '')
  const [summaryStandard, setSummaryStandard] = useState(existingConfig.summaryStandard || '')
  const [customPrompt, setCustomPrompt] = useState(existingConfig.customPrompt || '')
  const [writingGuidance, setWritingGuidance] = useState<WritingGuidance>(
    existingConfig.writingGuidance || { ...DEFAULT_WRITING_GUIDANCE }
  )
  const [showWritingGuidance, setShowWritingGuidance] = useState(true)

  useEffect(() => {
    setPolishStandard(existingConfig.polishStandard || '')
    setSummaryStandard(existingConfig.summaryStandard || '')
    setCustomPrompt(existingConfig.customPrompt || '')
    setWritingGuidance(existingConfig.writingGuidance || { ...DEFAULT_WRITING_GUIDANCE })
  }, [isBookLevel, editingVolumeId])

  const updateGuidance = (key: keyof WritingGuidance, value: string) => {
    setWritingGuidance(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    const config: Partial<BookAIConfig> = {
      polishStandard: polishStandard.trim(),
      summaryStandard: summaryStandard.trim(),
      customPrompt: customPrompt.trim(),
      writingGuidance: {
        dialogue: writingGuidance.dialogue.trim(),
        scene: writingGuidance.scene.trim(),
        emotion: writingGuidance.emotion.trim(),
        action: writingGuidance.action.trim(),
        pacing: writingGuidance.pacing.trim(),
        custom: writingGuidance.custom.trim()
      }
    }
    if (isBookLevel) {
      await saveBookAIConfig(config)
    } else if (editingVolumeId) {
      await saveVolumeAIConfig(editingVolumeId, config)
    }
    navBack()
  }

  const title = isBookLevel ? '书籍 AI 配置' : '卷 AI 配置'

  return (
    <div className="flex flex-col h-full">
      <BackButton label={title} onClick={navBack} />

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <p className="text-[10px] text-gray-500">
          {isBookLevel ? '以下配置将作为所有卷和章节的默认值' : '以下配置将覆盖书籍级配置，仅对本卷生效'}
        </p>
        <div>
          <label className="block text-xs text-gray-400 mb-1">润色标准</label>
          <textarea
            value={polishStandard}
            onChange={e => setPolishStandard(e.target.value)}
            placeholder="描述你期望的润色风格和标准..."
            className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-amber-500 resize-none h-20"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">摘要标准</label>
          <textarea
            value={summaryStandard}
            onChange={e => setSummaryStandard(e.target.value)}
            placeholder="描述你期望的摘要关注点..."
            className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-amber-500 resize-none h-20"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">自定义补充指令</label>
          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            placeholder="其他对 AI 的补充要求..."
            className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-amber-500 resize-none h-20"
          />
        </div>

        {/* Writing Guidance */}
        {isBookLevel && (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowWritingGuidance(!showWritingGuidance)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-amber-400 hover:bg-gray-700/30 transition-colors"
            >
              <span className="font-medium">写作指导意见</span>
              <span className="text-[10px] text-gray-500">{showWritingGuidance ? '▼' : '▶'}</span>
            </button>
            {showWritingGuidance && (
              <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50">
                <p className="text-[10px] text-gray-500 pt-2">
                  指导 AI 在撰写内容时的描写风格和技巧要求
                </p>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">对话风格</label>
                  <textarea
                    value={writingGuidance.dialogue}
                    onChange={e => updateGuidance('dialogue', e.target.value)}
                    placeholder="例如：对话要口语化、符合角色性格，避免书面语..."
                    className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-amber-500 resize-none h-16"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">场景描写</label>
                  <textarea
                    value={writingGuidance.scene}
                    onChange={e => updateGuidance('scene', e.target.value)}
                    placeholder="例如：注重感官细节，营造画面感，避免过度描写..."
                    className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-amber-500 resize-none h-16"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">情感描写</label>
                  <textarea
                    value={writingGuidance.emotion}
                    onChange={e => updateGuidance('emotion', e.target.value)}
                    placeholder="例如：通过动作和细节传达情感，避免直白陈述..."
                    className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-amber-500 resize-none h-16"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">动作描写</label>
                  <textarea
                    value={writingGuidance.action}
                    onChange={e => updateGuidance('action', e.target.value)}
                    placeholder="例如：动作场景要有节奏感，用短句增加紧张感..."
                    className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-amber-500 resize-none h-16"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">节奏把控</label>
                  <textarea
                    value={writingGuidance.pacing}
                    onChange={e => updateGuidance('pacing', e.target.value)}
                    placeholder="例如：每章结尾留悬念，高潮与过渡交替..."
                    className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-amber-500 resize-none h-16"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">其他要求</label>
                  <textarea
                    value={writingGuidance.custom}
                    onChange={e => updateGuidance('custom', e.target.value)}
                    placeholder="其他写作要求..."
                    className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-amber-500 resize-none h-16"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-700/50 shrink-0">
        <button onClick={handleSave} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded text-xs font-medium transition-colors">
          保存
        </button>
      </div>
    </div>
  )
}

// ─── Main Sidebar ───

export default function Sidebar({ width }: { width?: number }) {
  const { navLevel } = useAppStore()
  const prevLevel = useRef(navLevel)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right')

  // Determine slide direction based on level hierarchy
  const levelOrder = ['projects', 'project', 'volume', 'chapter', 'ai-config']
  useEffect(() => {
    const prevIdx = levelOrder.indexOf(prevLevel.current)
    const nextIdx = levelOrder.indexOf(navLevel)
    setSlideDirection(nextIdx >= prevIdx ? 'left' : 'right')
    prevLevel.current = navLevel
  }, [navLevel])

  // Which panels should be visible (active or transitioning out)
  const panels: { key: string; level: string; component: React.ReactNode }[] = [
    { key: 'projects', level: 'projects', component: <ProjectsLevel /> },
    { key: 'project', level: 'project', component: <ProjectLevel /> },
    { key: 'volume', level: 'volume', component: <VolumeLevel /> },
    { key: 'chapter', level: 'chapter', component: <ChapterLevel /> },
    { key: 'ai-config', level: 'ai-config', component: <AIConfigLevel /> }
  ]

  return (
    <div className="bg-gray-800 border-r border-gray-700 flex flex-col h-full select-none shrink-0 relative overflow-hidden" style={{ width: width ?? 256 }}>
      {panels.map(p => (
        <SlidePanel key={p.key} active={navLevel === p.level} direction={slideDirection}>
          {p.component}
        </SlidePanel>
      ))}
    </div>
  )
}
