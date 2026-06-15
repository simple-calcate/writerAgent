import { useState, useMemo } from 'react'
import type { ReasoningChain, ReasoningStep, ReasoningContextConfig } from '../../../shared/types'
import { DEFAULT_REASONING_CONTEXT_CONFIG } from '../../../shared/types'

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
  outputKey: '',
  dependsOn: []
}

const emptyChain: ReasoningChain = {
  id: '',
  name: '',
  description: '',
  trigger: 'auto',
  steps: [],
  includeInContext: false,
  contextConfig: { ...DEFAULT_REASONING_CONTEXT_CONFIG },
  builtin: false
}

// 计算拓扑层级用于可视化（带循环依赖保护）
function computeLevels(steps: ReasoningStep[]): number[] {
  const keyToIndex = new Map(steps.map((s, i) => [s.outputKey, i]))
  const levelOf = new Map<string, number>()
  const visiting = new Set<string>()

  const getLevel = (key: string): number => {
    if (levelOf.has(key)) return levelOf.get(key)!
    if (visiting.has(key)) {
      levelOf.set(key, 0)
      return 0
    }
    visiting.add(key)
    const step = steps.find(s => s.outputKey === key)
    if (!step || !step.dependsOn || step.dependsOn.length === 0) {
      levelOf.set(key, 0)
      visiting.delete(key)
      return 0
    }
    const maxDep = Math.max(...step.dependsOn.filter(d => keyToIndex.has(d)).map(d => getLevel(d)))
    const level = maxDep + 1
    levelOf.set(key, level)
    visiting.delete(key)
    return level
  }

  for (const step of steps) {
    getLevel(step.outputKey)
  }
  return steps.map(s => levelOf.get(s.outputKey) || 0)
}

export default function ReasoningChainEditor({ chain, onSave, onCancel, onDelete }: ReasoningChainEditorProps) {
  const [form, setForm] = useState<ReasoningChain>(chain || { ...emptyChain, id: crypto.randomUUID() })
  const [error, setError] = useState<string | null>(null)

  const levels = useMemo(() => computeLevels(form.steps), [form.steps])

  const updateForm = (updates: Partial<ReasoningChain>) => {
    setError(null)
    setForm(prev => ({ ...prev, ...updates }))
  }

  const addStep = () => {
    const newStep: ReasoningStep = {
      ...emptyStep,
      id: `step-${Date.now()}`,
      outputKey: `step${form.steps.length + 1}`,
      dependsOn: []
    }
    updateForm({ steps: [...form.steps, newStep] })
  }

  const updateStep = (index: number, updates: Partial<ReasoningStep>) => {
    setError(null)
    const newSteps = [...form.steps]
    newSteps[index] = { ...newSteps[index], ...updates }
    updateForm({ steps: newSteps })
  }

  const removeStep = (index: number) => {
    const removedKey = form.steps[index].outputKey
    const newSteps = form.steps
      .filter((_, i) => i !== index)
      .map(s => ({
        ...s,
        dependsOn: (s.dependsOn || []).filter(d => d !== removedKey)
      }))
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

  const toggleDep = (stepIndex: number, depKey: string) => {
    const step = form.steps[stepIndex]
    const deps = step.dependsOn || []
    const newDeps = deps.includes(depKey) ? deps.filter(d => d !== depKey) : [...deps, depKey]
    updateStep(stepIndex, { dependsOn: newDeps })
  }

  const handleSave = () => {
    const chainToSave = { ...form }

    if (!chainToSave.name.trim()) {
      setError('请输入推理链名称')
      return
    }
    if (chainToSave.steps.length === 0) {
      setError('请至少添加一个推理步骤')
      return
    }
    for (const step of chainToSave.steps) {
      if (!step.name.trim() || !step.prompt.trim()) {
        setError('请填写所有步骤的名称和提示词')
        return
      }
    }

    // 检测循环依赖
    const keyToStep = new Map(chainToSave.steps.map(s => [s.outputKey, s]))
    const visited = new Set<string>()
    const inStack = new Set<string>()
    const hasCycle = (key: string): boolean => {
      if (inStack.has(key)) return true
      if (visited.has(key)) return false
      visited.add(key)
      inStack.add(key)
      const step = keyToStep.get(key)
      if (step?.dependsOn) {
        for (const dep of step.dependsOn) {
          if (hasCycle(dep)) return true
        }
      }
      inStack.delete(key)
      return false
    }
    for (const step of chainToSave.steps) {
      if (hasCycle(step.outputKey)) {
        setError('检测到循环依赖，请检查步骤依赖关系')
        return
      }
    }

    onSave(chainToSave)
  }

  const maxLevel = levels.length > 0 ? Math.max(...levels) : 0

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

      {error && (
        <div className="bg-red-900/30 border border-red-500/40 rounded px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

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
            {(['auto', 'manual'] as const).map(t => (
              <button
                key={t}
                onClick={() => updateForm({ trigger: t })}
                className={`px-3 py-1 text-[11px] rounded transition-colors ${
                  form.trigger === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:text-gray-300'
                }`}
              >
                {t === 'auto' ? '自动' : '手动'}
              </button>
            ))}
          </div>
        </div>

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

      {/* Context Configuration */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 block">推理上下文</label>
        <p className="text-[10px] text-gray-600">选择推理时需要参考的信息</p>
        <div className="space-y-1.5">
          {[
            { key: 'bookOutline' as keyof ReasoningContextConfig, label: '书籍大纲', icon: '📚' },
            { key: 'volumeOutline' as keyof ReasoningContextConfig, label: '卷大纲', icon: '📖' },
            { key: 'chapterOutline' as keyof ReasoningContextConfig, label: '章节大纲', icon: '📝' },
            { key: 'previousSummaries' as keyof ReasoningContextConfig, label: '前文章节摘要', icon: '📋' },
            { key: 'dialogueHistory' as keyof ReasoningContextConfig, label: '最近对话', icon: '💬' }
          ].map(item => (
            <label key={item.key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.contextConfig?.[item.key] ?? true}
                onChange={e => updateForm({
                  contextConfig: {
                    ...(form.contextConfig || DEFAULT_REASONING_CONTEXT_CONFIG),
                    [item.key]: e.target.checked
                  }
                })}
                className="accent-blue-500"
              />
              <span className="text-[10px]">{item.icon}</span>
              <span className="text-xs text-gray-300">{item.label}</span>
            </label>
          ))}
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

        {/* DAG 可视化 */}
        {form.steps.length > 1 && (
          <div className="mb-3 bg-gray-900/50 rounded p-2.5 overflow-x-auto">
            <p className="text-[9px] text-gray-500 mb-2">依赖关系 · L{maxLevel + 1} 层 · 无依赖的步骤并发执行</p>
            <div className="flex items-start gap-1">
              {Array.from({ length: maxLevel + 1 }, (_, li) => {
                const levelSteps = form.steps.filter((_, i) => levels[i] === li)
                return (
                  <div key={li} className="flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[8px] text-gray-600">L{li}</span>
                    {levelSteps.map(s => (
                      <div key={s.id} className="px-1.5 py-0.5 bg-blue-600/20 border border-blue-500/30 rounded text-[9px] text-blue-300 truncate max-w-[80px]" title={s.name}>
                        {s.name || s.outputKey}
                      </div>
                    ))}
                    {li < maxLevel && (
                      <div className="text-gray-600 text-[10px] mt-1">→</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {form.steps.map((step, index) => {
            const availableDeps = form.steps.filter((_, i) => i !== index)
            const isIndependent = !step.dependsOn || step.dependsOn.length === 0

            return (
              <div key={step.id} className={`rounded p-3 space-y-2 ${isIndependent ? 'bg-green-900/10 border border-green-800/20' : 'bg-gray-700/30'}`}>
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
                {/* 依赖选择 */}
                {availableDeps.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-gray-500 mt-0.5 shrink-0">依赖：</span>
                    <div className="flex flex-wrap gap-1">
                      {availableDeps.map(dep => {
                        const isSelected = step.dependsOn?.includes(dep.outputKey)
                        return (
                          <button
                            key={dep.id}
                            onClick={() => toggleDep(index, dep.outputKey)}
                            className={`px-1.5 py-0.5 text-[9px] rounded border transition-colors ${
                              isSelected
                                ? 'bg-orange-600/20 border-orange-500/40 text-orange-300'
                                : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-400'
                            }`}
                          >
                            {dep.name || dep.outputKey}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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
