import type { FeatureSkillIds } from '../../../../shared/types'
import { DEFAULT_FEATURE_SKILL_IDS } from '../../../../shared/types'
import { saveSkill, getSkills, getProjects, updateProjectFeatureSkillIds } from '../../../store/db'
import { randomUUID } from 'crypto'

export async function handleSkillTools(
  toolName: string,
  args: Record<string, string>,
  projectId: string
): Promise<string | null> {
  switch (toolName) {
    case 'extract_skill': {
      if (!args.name) return '错误：未提供技能名称'
      if (!args.content) return '错误：未提供技能内容'
      const now = new Date().toISOString()
      const skill = {
        id: randomUUID(),
        name: args.name,
        category: (args.category || 'custom') as any,
        content: args.content,
        source: args.source,
        createdAt: now,
        updatedAt: now
      }
      saveSkill(skill)
      return `已提取写作技能「${skill.name}」（分类：${skill.category}）\n\n${args.content.substring(0, 200)}${args.content.length > 200 ? '...' : ''}`
    }

    case 'refine_skill': {
      if (!args.skillId) return '错误：未提供技能 ID'
      if (!args.content) return '错误：未提供修正内容'
      const skills = getSkills()
      const targetSkill = skills.find(s => s.id === args.skillId)
      if (!targetSkill) return '错误：找不到指定技能'
      const updatedSkill = {
        ...targetSkill,
        content: args.content,
        updatedAt: new Date().toISOString()
      }
      saveSkill(updatedSkill)
      return `已修正技能「${targetSkill.name}」${args.reason ? '\n\n修正理由：' + args.reason : ''}\n\n${args.content.substring(0, 200)}${args.content.length > 200 ? '...' : ''}`
    }

    case 'list_skills': {
      const allSkills = getSkills()
      const projects = getProjects()
      const project = projects.find(p => p.id === projectId)
      const featureSkillIds = project?.featureSkillIds || DEFAULT_FEATURE_SKILL_IDS

      const featureNames: Record<string, string> = {
        dialogue: 'AI 对话',
        polish: '智能润色',
        summary: '章节摘要',
        continuation: '智能续写'
      }

      const lines = allSkills.map(skill => {
        const features = Object.entries(featureSkillIds)
          .filter(([, ids]) => ids.includes(skill.id))
          .map(([key]) => featureNames[key] || key)
        const mountStatus = features.length > 0 ? `已挂载：${features.join('、')}` : '未挂载到任何功能'
        const builtinTag = skill.builtin ? ' [内置]' : ''
        return `- 「${skill.name}」${builtinTag}（${skill.category}）${mountStatus}\n  ${skill.content.substring(0, 100)}${skill.content.length > 100 ? '...' : ''}`
      })

      return `共 ${allSkills.length} 个写作技能：\n\n${lines.join('\n\n')}`
    }

    case 'toggle_feature_skill': {
      if (!args.skillId) return '错误：未提供技能 ID'
      if (!args.feature) return '错误：未提供目标功能'
      if (args.enabled === undefined) return '错误：未提供启用/禁用状态'

      const allSkills = getSkills()
      const skill = allSkills.find(s => s.id === args.skillId)
      if (!skill) return '错误：找不到指定技能'

      const projects = getProjects()
      const project = projects.find(p => p.id === projectId)
      const current = project?.featureSkillIds || { ...DEFAULT_FEATURE_SKILL_IDS }
      const feature = args.feature as keyof FeatureSkillIds

      if (!(feature in current)) return `错误：不支持的功能「${args.feature}」`

      const ids = [...(current[feature] || [])]
      const isEnabled = ids.includes(args.skillId)

      if (args.enabled === 'true' && !isEnabled) {
        ids.push(args.skillId)
      } else if (args.enabled === 'false' && isEnabled) {
        const idx = ids.indexOf(args.skillId)
        ids.splice(idx, 1)
      }

      const newFeatureSkillIds = { ...current, [feature]: ids }
      updateProjectFeatureSkillIds(projectId, newFeatureSkillIds)

      const featureNames: Record<string, string> = {
        dialogue: 'AI 对话',
        polish: '智能润色',
        summary: '章节摘要',
        continuation: '智能续写'
      }
      const action = args.enabled === 'true' ? '启用' : '禁用'
      const mountedSkills = ids.map(id => allSkills.find(s => s.id === id)?.name || id).join('、')

      return `已${action}技能「${skill.name}」在${featureNames[feature] || feature}上的挂载。\n\n当前${featureNames[feature] || feature}已挂载技能：${mountedSkills || '无'}`
    }

    default:
      return null
  }
}
