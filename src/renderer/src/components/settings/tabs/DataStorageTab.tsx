import { useState, useEffect } from 'react'

export default function DataStorageTab() {
  const [dataPath, setDataPath] = useState('')
  const [defaultPath, setDefaultPath] = useState('')
  const [customPath, setCustomPath] = useState('')

  useEffect(() => {
    window.api.getDataPath().then(setDataPath)
    window.api.getDataPathDefault().then(setDefaultPath)
  }, [])

  const handleOpenFolder = () => {
    window.api.openDataFolder()
  }

  const handleChangePath = async () => {
    if (!customPath.trim()) return
    const confirmed = window.confirm(
      `确认将数据存储位置更改为：\n${customPath.trim()}\n\n数据将被复制到新位置，但旧位置的数据不会自动删除。请在确认迁移成功后手动清理旧数据。`
    )
    if (!confirmed) return
    try {
      await window.api.setDataPath(customPath.trim())
      const newPath = await window.api.getDataPath()
      setDataPath(newPath)
      setCustomPath('')
    } catch (e) {
      alert('路径无效: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const handleResetPath = async () => {
    const confirmed = window.confirm(
      `确认将数据存储位置恢复为默认路径：\n${defaultPath}\n\n数据将被复制到默认位置，但当前自定义位置的数据不会自动删除。`
    )
    if (!confirmed) return
    await window.api.setDataPath(defaultPath)
    setDataPath(defaultPath)
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-[var(--nw-text-muted)] mb-1">当前存储位置</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-[var(--nw-text-secondary)] bg-[var(--nw-surface-2)] rounded px-3 py-2 font-mono break-all flex-1">
            {dataPath || '加载中...'}
          </p>
          <button
            onClick={handleOpenFolder}
            className="shrink-0 px-3 py-2 text-xs bg-[var(--nw-surface-2)] hover:bg-white/10 rounded transition-colors"
            title="在文件管理器中打开"
          >
            打开
          </button>
        </div>
      </div>
      <div>
        <p className="text-xs text-[var(--nw-text-muted)] mb-1">修改存储位置</p>
        <div className="flex gap-2">
          <input
            value={customPath}
            onChange={e => setCustomPath(e.target.value)}
            placeholder="输入新路径..."
            className="flex-1 bg-[var(--nw-surface-2)] border border-white/15 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleChangePath}
            disabled={!customPath.trim()}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-white/10 disabled:cursor-not-allowed rounded transition-colors"
          >
            修改
          </button>
        </div>
        {dataPath !== defaultPath && (
          <button
            onClick={handleResetPath}
            className="mt-2 px-3 py-1.5 text-xs bg-[var(--nw-surface-2)] hover:bg-white/10 rounded transition-colors"
          >
            恢复默认路径
          </button>
        )}
      </div>
    </div>
  )
}
