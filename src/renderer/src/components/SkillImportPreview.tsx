import { useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { SKILL_CATEGORIES } from '../../../shared/types'
import type { WritingSkill } from '../../../shared/types'

export default function SkillImportPreview() {
  const { skillImportPreview, showSkillImportPreview, closeSkillImportPreview, importSkillsConfirm, skills } = useAppStore()
  const [selected, setSelected] = useState<Set<number>>(new Set())

  if (!showSkillImportPreview || !skillImportPreview || skillImportPreview.length === 0) return null

  const existingNames = new Set(skills.map(s => s.name))

  const toggle = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === skillImportPreview!.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(skillImportPreview!.map((_, i) => i)))
    }
  }

  const handleConfirm = async () => {
    const toImport = skillImportPreview!.filter((_, i) => selected.has(i))
    if (toImport.length > 0) {
      await importSkillsConfirm(toImport)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-[var(--nw-surface-2)] rounded-lg shadow-2xl w-[480px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm text-[var(--nw-text-primary)]">导入技能库</h3>
          <button onClick={closeSkillImportPreview} className="text-[var(--nw-text-muted)] hover:text-[var(--nw-text-secondary)] text-xs">✕</button>
        </div>

        {/* Skill list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <button onClick={toggleAll} className="text-[11px] text-blue-400 hover:text-blue-300">
              {selected.size === skillImportPreview.length ? '取消全选' : '全选'}
            </button>
            <span className="text-[10px] text-[var(--nw-text-muted)]">{selected.size} / {skillImportPreview.length} 已选</span>
          </div>

          {skillImportPreview.map((skill, i) => {
            const meta = SKILL_CATEGORIES[skill.category] || { icon: '📌', label: skill.category }
            const isDuplicate = existingNames.has(skill.name)
            return (
              <div
                key={i}
                onClick={() => toggle(i)}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  selected.has(i)
                    ? 'border-blue-500/50 bg-blue-900/20'
                    : 'border-white/10 bg-[var(--nw-surface-2)]/30 hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    className="accent-blue-500"
                  />
                  <span className="text-[10px]">{meta.icon}</span>
                  <span className="text-xs text-[var(--nw-text-secondary)] flex-1">{skill.name}</span>
                  {isDuplicate && (
                    <span className="text-[10px] text-yellow-500 bg-yellow-900/30 px-1.5 py-0.5 rounded">重复</span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--nw-text-muted)] line-clamp-2 ml-6">{skill.content.substring(0, 120)}{skill.content.length > 120 ? '...' : ''}</p>
                {skill.source && <p className="text-[10px] text-[var(--nw-text-muted)] ml-6 mt-0.5">{skill.source}</p>}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
          <button onClick={closeSkillImportPreview} className="text-xs text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)]">取消</button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-xs transition-colors disabled:opacity-40"
          >
            导入 {selected.size} 个技能
          </button>
        </div>
      </div>
    </div>
  )
}
