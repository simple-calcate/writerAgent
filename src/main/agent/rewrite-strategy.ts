import type { CriticScore } from '../../shared/types'

export type RewriteStrategy =
  | 'full_rewrite'       // 整体重写（结构/冲突严重问题）
  | 'targeted_fix'       // 针对性修改（只有个别维度差）
  | 'style_pass'         // 风格润色（文风不一致）
  | 'pacing_adjust'      // 节奏调整（节奏问题）
  | 'conflict_boost'     // 冲突增强（冲突不足）
  | 'skip'               // 无需修改

export interface RewritePlan {
  strategy: RewriteStrategy
  targetSections: string[]   // 需要修改的维度
  instruction: string        // 给 Writer 的修改指令
  preserveContent: string[]  // 需要保留的内容片段描述
  priority: 'high' | 'medium' | 'low'
}

/**
 * 根据 Critic 评分选择重写策略
 */
export function selectRewriteStrategy(score: CriticScore, round: number): RewritePlan {
  // 高分直接跳过
  if (score.overall >= 8 && score.structure >= 7 && score.conflict >= 6) {
    return {
      strategy: 'skip',
      targetSections: [],
      instruction: '',
      preserveContent: [],
      priority: 'low'
    }
  }

  // 结构或冲突严重问题 → 全面重写
  if (score.structure < 5 || score.conflict < 4 || score.overall < 5) {
    return {
      strategy: 'full_rewrite',
      targetSections: ['structure', 'conflict', 'pacing'],
      instruction: buildFullRewriteInstruction(score, round),
      preserveContent: [],
      priority: 'high'
    }
  }

  // 只有文风问题 → 风格润色
  if (score.styleConsistency < 6 && score.structure >= 7 && score.conflict >= 6) {
    return {
      strategy: 'style_pass',
      targetSections: ['styleConsistency'],
      instruction: buildStylePassInstruction(score),
      preserveContent: ['情节结构', '冲突设计', '角色行为'],
      priority: 'low'
    }
  }

  // 只有节奏问题 → 节奏调整
  if (score.pacing < 6 && score.structure >= 7 && score.conflict >= 6) {
    return {
      strategy: 'pacing_adjust',
      targetSections: ['pacing', 'infoDensity'],
      instruction: buildPacingInstruction(score),
      preserveContent: ['核心情节', '人物关系', '场景设定'],
      priority: 'medium'
    }
  }

  // 只有冲突问题 → 冲突增强
  if (score.conflict < 6 && score.structure >= 7) {
    return {
      strategy: 'conflict_boost',
      targetSections: ['conflict'],
      instruction: buildConflictInstruction(score),
      preserveContent: ['整体结构', '文风', '节奏'],
      priority: 'medium'
    }
  }

  // 多维度问题但不严重 → 针对性修改
  return {
    strategy: 'targeted_fix',
    targetSections: identifyWeakDimensions(score),
    instruction: buildTargetedFixInstruction(score, round),
    preserveContent: identifyStrongDimensions(score),
    priority: 'medium'
  }
}

function identifyWeakDimensions(score: CriticScore): string[] {
  const weak: string[] = []
  if (score.structure < 7) weak.push('结构')
  if (score.pacing < 7) weak.push('节奏')
  if (score.conflict < 7) weak.push('冲突')
  if (score.infoDensity < 7) weak.push('信息密度')
  if (score.styleConsistency < 7) weak.push('文风')
  return weak
}

function identifyStrongDimensions(score: CriticScore): string[] {
  const strong: string[] = []
  if (score.structure >= 7) strong.push('结构完整性')
  if (score.pacing >= 7) strong.push('节奏把控')
  if (score.conflict >= 7) strong.push('冲突设计')
  if (score.infoDensity >= 7) strong.push('信息密度')
  if (score.styleConsistency >= 7) strong.push('文风一致性')
  return strong
}

function buildFullRewriteInstruction(score: CriticScore, round: number): string {
  const parts: string[] = [
    `【第 ${round} 轮重写 - 全面重写】`,
    `当前评分：${score.overall}/10`,
    `\n主要问题：`,
    ...score.issues.map(i => `- ${i}`),
    `\n修改建议：`,
    ...score.suggestions.map(s => `- ${s}`)
  ]
  if (score.rewriteInstructions) {
    parts.push(`\n具体指令：${score.rewriteInstructions}`)
  }
  parts.push('\n请重新构思和写作，重点解决以上问题。')
  return parts.join('\n')
}

function buildStylePassInstruction(score: CriticScore): string {
  return [
    `【风格润色】文风一致性评分：${score.styleConsistency}/10`,
    `问题：${score.issues.filter(i => i.includes('风格') || i.includes('文风') || i.includes('语气')).join('；') || '文风不够统一'}`,
    `请保持情节和结构不变，重点优化：语言风格统一、用词准确性、句式多样性。`,
    ...score.suggestions.map(s => `- ${s}`)
  ].join('\n')
}

function buildPacingInstruction(score: CriticScore): string {
  return [
    `【节奏调整】节奏评分：${score.pacing}/10`,
    `问题：${score.issues.filter(i => i.includes('节奏') || i.includes('拖沓') || i.includes('过快')).join('；') || '节奏需要优化'}`,
    `请保持核心情节不变，调整叙事节奏：`,
    `- 如果节奏拖沓：删减冗余描写，加快情节推进`,
    `- 如果节奏过快：增加细节描写，补充过渡`,
    ...score.suggestions.map(s => `- ${s}`)
  ].join('\n')
}

function buildConflictInstruction(score: CriticScore): string {
  return [
    `【冲突增强】冲突评分：${score.conflict}/10`,
    `问题：${score.issues.filter(i => i.includes('冲突') || i.includes('矛盾') || i.includes('张力')).join('；') || '冲突不够强烈'}`,
    `请在保持整体结构的基础上增强冲突：`,
    `- 增加角色间的利益冲突`,
    `- 强化内心矛盾`,
    `- 提升场景张力`,
    ...score.suggestions.map(s => `- ${s}`)
  ].join('\n')
}

function buildTargetedFixInstruction(score: CriticScore, round: number): string {
  const weakDims = identifyWeakDimensions(score)
  return [
    `【第 ${round} 轮针对性修改】`,
    `当前评分：${score.overall}/10`,
    `需要改进的维度：${weakDims.join('、')}`,
    `\n问题：`,
    ...score.issues.map(i => `- ${i}`),
    `\n建议：`,
    ...score.suggestions.map(s => `- ${s}`),
    `\n请针对以上维度进行修改，同时保持其他方面的质量。`
  ].join('\n')
}

// Re-export from score-trend for backward compatibility
export { trackScoreTrend, shouldStopRewrite } from './score-trend'
export type { ScoreTrend } from './score-trend'
