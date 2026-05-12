import { useAppStore } from '../stores/useAppStore'

export default function HistoryPanel() {
  const { versions, showHistory, toggleHistory, currentChapter, updateChapterContent } = useAppStore()

  if (!showHistory) return null

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const handleRestore = (version: typeof versions[0]) => {
    if (!currentChapter) return
    updateChapterContent(version.content)
  }

  const handleDelete = async (index: number) => {
    if (!currentChapter) return
    await window.api.deleteVersion(currentChapter.id, index)
    // Reload versions
    const updated = await window.api.getVersions(currentChapter.id)
    useAppStore.setState({ versions: updated })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg max-h-[70vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-sm font-medium text-gray-200">版本历史</h2>
          <button onClick={toggleHistory} className="text-gray-500 hover:text-gray-300 text-sm">x</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {versions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">暂无历史版本</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v, i) => (
                <div key={i} className="bg-gray-750 border border-gray-700 rounded p-3 group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">{formatTime(v.timestamp)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{v.content.replace(/\s/g, '').length} 字</span>
                      <button
                        onClick={() => handleRestore(v)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        恢复
                      </button>
                      <button
                        onClick={() => handleDelete(i)}
                        className="text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
                    {v.content.slice(0, 200) || '(空)'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
