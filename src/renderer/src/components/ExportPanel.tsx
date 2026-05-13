import { useState } from 'react'
import { useAppStore } from '../stores/useAppStore'

export default function ExportPanel() {
  const { showExport, toggleExport, currentProject, chapters, exportProject } = useAppStore()
  const [format, setFormat] = useState<'txt' | 'md'>('txt')
  const [mode, setMode] = useState<'separate' | 'merged'>('merged')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  if (!showExport || !currentProject) return null

  const sortedChapters = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex)

  // Init selected on first render
  if (selected.size === 0 && sortedChapters.length > 0) {
    setSelected(new Set(sortedChapters.map(ch => ch.id)))
  }

  const toggleChapter = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === sortedChapters.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sortedChapters.map(ch => ch.id)))
    }
  }

  const handleExport = async () => {
    const exportChapters = sortedChapters
      .filter(ch => selected.has(ch.id))
      .map(ch => ({ title: ch.title, content: ch.content }))

    if (exportChapters.length === 0) return

    setExporting(true)
    try {
      await exportProject({
        projectName: currentProject.name,
        chapters: exportChapters,
        format,
        mode
      })
      toggleExport()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={toggleExport}>
      <div className="bg-gray-800 rounded-lg shadow-2xl w-[480px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h3 className="text-base font-medium text-gray-200">批量导出</h3>
          <button onClick={toggleExport} className="text-gray-500 hover:text-gray-300 text-lg leading-none">&times;</button>
        </div>

        {/* Project tree */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
              <span className="text-yellow-400">📁</span>
              <span className="font-medium">{currentProject.name}</span>
              <span className="text-gray-500 text-xs">({sortedChapters.length} 章)</span>
            </div>

            {/* Select all */}
            <label className="flex items-center gap-2 px-2 py-1 text-xs text-gray-400 hover:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.size === sortedChapters.length && sortedChapters.length > 0}
                onChange={toggleAll}
                className="rounded accent-blue-500"
              />
              全选/取消
            </label>
          </div>

          {/* Chapter tree */}
          <div className="bg-gray-900/50 rounded-lg p-3 space-y-0.5">
            {sortedChapters.map((ch, i) => {
              const isLast = i === sortedChapters.length - 1
              const prefix = isLast ? '└── ' : '├── '
              const wordCount = ch.content.replace(/\s/g, '').length
              return (
                <label
                  key={ch.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-700/50 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(ch.id)}
                    onChange={() => toggleChapter(ch.id)}
                    className="accent-blue-500"
                  />
                  <span className="text-gray-600 text-xs font-mono shrink-0">{prefix}</span>
                  <span className="text-sm text-gray-300 group-hover:text-white truncate flex-1">
                    {ch.title || '未命名章节'}
                  </span>
                  <span className="text-[11px] text-gray-600 shrink-0">{wordCount} 字</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Footer options */}
        <div className="px-5 py-4 border-t border-gray-700 space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">格式</span>
              <select
                value={format}
                onChange={e => setFormat(e.target.value as 'txt' | 'md')}
                className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
              >
                <option value="txt">TXT</option>
                <option value="md">Markdown</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">方式</span>
              <select
                value={mode}
                onChange={e => setMode(e.target.value as 'separate' | 'merged')}
                className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
              >
                <option value="merged">合并为单个文件</option>
                <option value="separate">每章一个文件</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              已选 {selected.size} / {sortedChapters.length} 章
            </span>
            <button
              onClick={handleExport}
              disabled={selected.size === 0 || exporting}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting ? '导出中...' : '导出'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
