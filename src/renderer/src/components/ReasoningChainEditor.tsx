import { useState } from 'react'
import type { ReasoningChain, ReasoningStep } from '../../../shared/types'

interface ReasoningChainEditorProps {
  chain?: ReasoningChain | null
  onSave: (chain: ReasoningChain) => void
  onCancel: () => void
  onDelete?: () => void
}

const emptyStep: ReasoningStep = {
  id: '',
  name: '',
  prompt: '',
  outputKey: ''
}

const emptyChain: ReasoningChain = {
  id: '',
  name: '',
  description: '',
  trigger: 'both',
  triggerKeywords: [],
  steps: [],
  includeInContext: false,
  builtin: false
}

export default function ReasoningChainEditor({ chain, onSave, onCancel, onDelete }: ReasoningChainEditorProps) {
  const [form, setForm] = useState<ReasoningChain>(chain || { ...emptyChain, id: crypto.randomUUID() })
  const [keywordsText, setKeywordsText] = useState(chain?.triggerKeywords?.join(', ') || '')

  const updateForm = (updates: Partial<ReasoningChain>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }

  const addStep = () => {
    const newStep: ReasoningStep = {
      ...emptyStep,
      id: `step-${Date.now()}`,
      outputKey: `step${form.steps.length + 1}`
    }
    updateForm({ steps: [...form.steps, newStep] })
  }

  const updateStep = (index: number, updates: Partial<ReasoningStep>) => {
    const newSteps = [...form.steps]
    newSteps[index] = { ...newSteps[index], ...updates }
    updateForm({ steps: newSteps })
  }

  const removeStep = (index: number) => {
    const newSteps = form.steps.filter((_, i) => i !== index)
    updateForm({ steps: newSteps })
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === form.steps.length - 1) return

    const newSteps = [...form.steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]
    updateForm({ steps: newSteps })
  }

  const handleSave = () => {
    // Parse keywords
    const keywords = keywordsText.split(',').map(k => k.trim()).filter(Boolean)
    const chainToSave = { ...form, triggerKeywords: keywords }

    // Validate
    if (!chainToSave.name.trim()) {
      alert('请输入推理链名称')
      return
    }
    if (chainToSave.steps.length === 0) {
      alert('请至少添加一个推理步骤')
      return
    }
    for (const step of chainToSave.steps) {
      if (!step.name.trim() || !step.prompt.trim()) {
        alert('请填写所有步骤的名称和提示词')
        return
      }
    }

    onSave(chainToSave)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]" onClick={onCancel}>
      <div className="bg-gray-800 rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl p-5" onClick={e => e.stopPropagation()}>
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-gray-300">{chain ? '编辑推理链' : '新建推理链'}</h3>
        <div className="flex gap-2">
          {onDelete && (
            <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-300">删除</button>
          )}
          <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-300">取消</button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">名称</label>
          <input
            value={form.name}
            onChange={e => updateForm({ name: e.target.value })}
            
            placeholder="如：章节创作推理"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-500 block mb-1">描述</label>
          <input
            value={form.description}
            onChange={e => updateForm({ description: e.target.value })}
            onMouseDown={e => e.currentTarget.focus()}
            placeholder="简要说明推理链的用途"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-500 block mb-1">触发方式</label>
          <div className="flex gap-2">
            {(['auto', 'manual', 'both'] as const).map(t => (
              <button
                key={t}
                onClick={() => updateForm({ trigger: t })}
                className={`px-3 py-1 text-[11px] rounded transition-colors ${
                  form.trigger === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:text-gray-300'
                }`}
              >
                {t === 'auto' ? '自动' : t === 'manual' ? '手动' : '自动/手动'}
              </button>
            ))}
          </div>
        </div>

        {(form.trigger === 'auto' || form.trigger === 'both') && (
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">触发关键词（逗号分隔）</label>
            <input
              value={keywordsText}
              onChange={e => setKeywordsText(e.target.value)}
              onMouseDown={e => e.currentTarget.focus()}
              placeholder="写这一章, 写章节, 创作正文"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-[10px] text-gray-500">推理结果纳入上下文</label>
          <div
            onClick={() => updateForm({ includeInContext: !form.includeInContext })}
            className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${
              form.includeInContext ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
              form.includeInContext ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400">推理步骤</label>
          <button
            onClick={addStep}
            className="text-[11px] text-blue-400 hover:text-blue-300"
          >
            + 添加步骤
          </button>
        </div>

        <div className="space-y-2">
          {form.steps.map((step, index) => (
            <div key={step.id} className="bg-gray-700/30 rounded p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-4">{index + 1}</span>
                <input
                  value={step.name}
                  onChange={e => updateStep(index, { name: e.target.value })}
                  onMouseDown={e => e.currentTarget.focus()}
                  placeholder="步骤名称"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                />
                <input
                  value={step.outputKey}
                  onChange={e => updateStep(index, { outputKey: e.target.value })}
                  onMouseDown={e => e.currentTarget.focus()}
                  placeholder="输出key"
                  className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => moveStep(index, 'up')}
                  disabled={index === 0}
                  className="text-gray-500 hover:text-gray-300 disabled:opacity-30 text-xs"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveStep(index, 'down')}
                  disabled={index === form.steps.length - 1}
                  className="text-gray-500 hover:text-gray-300 disabled:opacity-30 text-xs"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeStep(index)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={step.prompt}
                onChange={e => updateStep(index, { prompt: e.target.value })}
                onMouseDown={e => e.currentTarget.focus()}
                placeholder="该步骤的提示词..."
                rows={2}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          ))}
        </div>

        {form.steps.length === 0 && (
          <p className="text-[11px] text-gray-600 text-center py-4">暂无步骤，点击上方按钮添加</p>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-xs font-medium transition-colors"
      >
        保存
      </button>
    </div>
    </div>
    </div>
  )
}
