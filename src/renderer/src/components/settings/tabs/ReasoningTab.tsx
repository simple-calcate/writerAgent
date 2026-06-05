import { useState, useEffect } from 'react'
import ReasoningChainEditor from '../../ReasoningChainEditor'
import type { ReasoningChain } from '../../../../../shared/types'

function DeleteConfirmButton({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="text-[10px] text-red-400 hover:text-red-300 px-1"
        >
          确定
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(false) }}
          className="text-[10px] text-gray-500 hover:text-gray-400 px-1"
        >
          取消
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
      className="text-[10px] text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      删除
    </button>
  )
}

export default function ReasoningTab() {
  const [chains, setChains] = useState<ReasoningChain[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'edit' | 'add'>('list')
  const [editingChain, setEditingChain] = useState<ReasoningChain | null>(null)

  useEffect(() => {
    loadChains()
  }, [])

  const loadChains = async () => {
    const loaded = await window.api.getReasoningChains()
    setChains(loaded)
  }

  const [addKey, setAddKey] = useState(0)

  const handleAdd = () => {
    setEditingChain(null)
    setViewMode('add')
    setAddKey(k => k + 1)
  }

  const handleEdit = (chain: ReasoningChain) => {
    setEditingChain(chain)
    setViewMode('edit')
  }

  const handleSave = async (chain: ReasoningChain) => {
    await window.api.saveReasoningChain(chain)
    await loadChains()
    setViewMode('list')
    setEditingChain(null)
  }

  const handleDelete = async (id: string) => {
    await window.api.deleteReasoningChain(id)
    await loadChains()
    setViewMode('list')
    setEditingChain(null)
  }

  // Edit/Add Form
  if (viewMode === 'edit' || viewMode === 'add') {
    return (
      <ReasoningChainEditor
        key={editingChain?.id || `add-${addKey}`}
        chain={editingChain}
        onSave={handleSave}
        onCancel={() => { setViewMode('list'); setEditingChain(null) }}
        onDelete={editingChain && !editingChain.builtin ? () => handleDelete(editingChain.id) : undefined}
      />
    )
  }

  // List View
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-300">🧠 {chains.length} 个推理链</span>
        <button onClick={handleAdd} className="bg-blue-600/80 hover:bg-blue-600 text-white px-2 py-1 rounded text-[11px] transition-colors">
          + 添加
        </button>
      </div>

      {chains.length === 0 && (
        <div className="text-center text-gray-600 py-8">
          <p className="text-sm mb-2">🧠</p>
          <p className="text-xs mb-2">还没有推理链</p>
          <p className="text-[10px] text-gray-700">推理链帮助 AI 在执行任务时进行系统性思考</p>
        </div>
      )}

      <div className="space-y-2">
        {chains.map(chain => (
          <div
            key={chain.id}
            className="bg-gray-700/30 rounded p-3 hover:bg-gray-700/50 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 cursor-pointer flex-1 min-w-0" onClick={() => handleEdit(chain)}>
                <span className="text-xs text-gray-300">{chain.name}</span>
                {chain.builtin && <span className="text-[9px] text-blue-400 bg-blue-900/30 px-1 rounded">内置</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600">{chain.steps.length} 步</span>
                {!chain.builtin && (
                  <DeleteConfirmButton onDelete={() => handleDelete(chain.id)} />
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-500 truncate cursor-pointer" onClick={() => handleEdit(chain)}>{chain.description}</p>
            <div className="flex items-center gap-2 mt-1 cursor-pointer" onClick={() => handleEdit(chain)}>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                chain.trigger === 'auto' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
              }`}>
                {chain.trigger === 'auto' ? '自动' : '手动'}
              </span>
              {chain.includeInContext && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">纳入上下文</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
