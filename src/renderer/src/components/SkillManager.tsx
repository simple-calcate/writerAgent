import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { SKILL_CATEGORIES } from '../../../shared/types'
import type { WritingSkill, SkillCategory } from '../../../shared/types'

type ViewMode = 'list' | 'edit' | 'add'

export default function SkillManager() {
  const {
    skills,
    loadSkills,
    saveSkill,
    deleteSkill,
    exportSkills,
    importSkills,
    navBack
  } = useAppStore()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingSkill, setEditingSkill] = useState<WritingSkill | null>(null)
  const [form, setForm] = useState({ name: '', category: 'custom' as SkillCategory, content: '', source: '' })

  useEffect(() => { loadSkills() }, [loadSkills])

  // Group skills by category
  const grouped = new Map<SkillCategory, WritingSkill[]>()
  for (const skill of skills) {
    const list = grouped.get(skill.category) || []
    list.push(skill)
    grouped.set(skill.category, list)
  }

  const handleAdd = () => {
    setForm({ name: '', category: 'custom', content: '', source: '' })
    setEditingSkill(null)
    setViewMode('add')
  }

  const handleEdit = (skill: WritingSkill) => {
    setForm({ name: skill.name, category: skill.category, content: skill.content, source: skill.source || '' })
    setEditingSkill(skill)
    setViewMode('edit')
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) return
    const now = new Date().toISOString()
    const skill: WritingSkill = editingSkill
      ? { ...editingSkill, name: form.name, category: form.category, content: form.content, source: form.source || undefined, updatedAt: now }
      : { id: crypto.randomUUID(), name: form.name, category: form.category, content: form.content, source: form.source || undefined, createdAt: now, updatedAt: now }
    await saveSkill(skill)
    setViewMode('list')
    setEditingSkill(null)
  }

  const handleDelete = async (id: string) => {
    await deleteSkill(id)
    if (editingSkill?.id === id) {
      setViewMode('list')
      setEditingSkill(null)
    }
  }

  const handleExportAll = () => { exportSkills() }

  const handleImport = () => { importSkills() }

  // ─── Edit/Add Form ───
  if (viewMode === 'edit' || viewMode === 'add') {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-white/10/60 shrink-0 flex items-center gap-2">
          <button onClick={() => setViewMode('list')} className="text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)] text-xs">← 返回</button>
          <span className="text-xs text-[var(--nw-text-secondary)]">{viewMode === 'add' ? '添加技能' : '编辑技能'}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <label className="text-[10px] text-[var(--nw-text-muted)] block mb-1">技能名称</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="如：都市打斗场景写法"
              className="w-full bg-[var(--nw-surface-2)]/50 border border-white/10 rounded px-3 py-1.5 text-xs text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--nw-text-muted)] block mb-1">分类</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as SkillCategory }))}
              className="w-full bg-[var(--nw-surface-2)]/50 border border-white/10 rounded px-3 py-1.5 text-xs text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500"
            >
              {Object.entries(SKILL_CATEGORIES).map(([key, meta]) => (
                <option key={key} value={key}>{meta.icon} {meta.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[var(--nw-text-muted)] block mb-1">来源（可选）</label>
            <input
              value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              placeholder="如：提取自《xxx》第三章"
              className="w-full bg-[var(--nw-surface-2)]/50 border border-white/10 rounded px-3 py-1.5 text-xs text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--nw-text-muted)] block mb-1">技能内容</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="详细的写作指导，包含具体规则和示例..."
              rows={10}
              className="w-full bg-[var(--nw-surface-2)]/50 border border-white/10 rounded px-3 py-2 text-xs text-[var(--nw-text-secondary)] focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="px-3 py-2 border-t border-white/10/60 shrink-0 flex gap-2">
          <button
            onClick={handleSave}
            disabled={!form.name.trim() || !form.content.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-40"
          >
            保存
          </button>
          {editingSkill && (
            <button
              onClick={() => handleDelete(editingSkill.id)}
              className="bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded text-xs transition-colors"
            >
              删除
            </button>
          )}
          <button
            onClick={() => setViewMode('list')}
            className="bg-[var(--nw-surface-2)] hover:bg-white/10 text-[var(--nw-text-secondary)] px-3 py-1.5 rounded text-xs transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    )
  }

  // ─── List View ───
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/10/60 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={navBack} className="text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)] text-xs">← 返回</button>
          <span className="text-xs text-[var(--nw-text-secondary)]">🎭 技能库</span>
        </div>
        <span className="text-[10px] text-[var(--nw-text-muted)]">{skills.length} 个技能</span>
      </div>

      {/* Action buttons */}
      <div className="px-3 py-2 border-b border-white/10/60 shrink-0 flex gap-1.5">
        <button onClick={handleAdd} className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors">
          + 添加
        </button>
        <button onClick={handleImport} className="flex-1 bg-[var(--nw-surface-2)] hover:bg-white/10 text-[var(--nw-text-secondary)] px-2 py-1.5 rounded text-[11px] transition-colors">
          导入
        </button>
        <button onClick={handleExportAll} disabled={skills.length === 0} className="flex-1 bg-[var(--nw-surface-2)] hover:bg-white/10 text-[var(--nw-text-secondary)] px-2 py-1.5 rounded text-[11px] transition-colors disabled:opacity-40">
          导出
        </button>
      </div>

      {/* Skill list grouped by category */}
      <div className="flex-1 overflow-y-auto">
        {skills.length === 0 && (
          <div className="text-center text-[var(--nw-text-muted)] mt-8 px-4">
            <p className="text-sm mb-2">🎭</p>
            <p className="text-xs mb-2">还没有写作技能</p>
            <p className="text-[10px] text-[var(--nw-text-muted)]">手动添加，或在 AI 对话中让 AI 从章节中提取</p>
          </div>
        )}

        {Array.from(grouped.entries()).map(([category, categorySkills]) => {
          const meta = SKILL_CATEGORIES[category] || { icon: '📌', label: category }
          return (
            <div key={category}>
              <div className="px-3 py-1.5 bg-[var(--nw-surface-2)]/40 flex items-center gap-1.5">
                <span className="text-[10px]">{meta.icon}</span>
                <span className="text-[10px] text-[var(--nw-text-muted)] font-medium">{meta.label}</span>
                <span className="text-[10px] text-[var(--nw-text-muted)] ml-auto">{categorySkills.length}</span>
              </div>
              {categorySkills.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => handleEdit(skill)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-[var(--nw-surface-2)]/30 transition-colors group text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[var(--nw-text-secondary)] truncate">{skill.name}</p>
                    {skill.source && <p className="text-[10px] text-[var(--nw-text-muted)] truncate">{skill.source}</p>}
                  </div>
                  <span className="text-[10px] text-[var(--nw-text-muted)] opacity-0 group-hover:opacity-100 ml-2 shrink-0">编辑</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
