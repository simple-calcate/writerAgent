import { getSkills } from '../store/db'

// 功能技能名称映射
const FEATURE_SKILL_NAMES: Record<string, string> = {
  polish: '智能润色指导',
  summary: '结构化摘要指导',
  refineSummary: '精炼总结指导',
  continuation: '智能续写指导',
  outline: '大纲撰写指导',
  chapterContent: '正文撰写指导'
}

/**
 * 获取指定 AI 功能的技能内容（用户可编辑的系统提示词）
 * 如果找到对应技能，返回其内容；否则返回 null（使用硬编码默认值）
 */
export function getFeatureSkillContent(feature: keyof typeof FEATURE_SKILL_NAMES): string | null {
  const targetName = FEATURE_SKILL_NAMES[feature]
  if (!targetName) return null
  const skills = getSkills()
  const skill = skills.find(s => s.name === targetName && s.builtin)
  return skill?.content || null
}
