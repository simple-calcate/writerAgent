import type { CriticScore } from '../../shared/types'

export interface ScoreTrend {
  scores: number[]
  isImproving: boolean
  isStagnant: boolean
  avgImprovement: number
}

export function trackScoreTrend(scores: number[]): ScoreTrend {
  if (scores.length < 2) {
    return { scores, isImproving: true, isStagnant: false, avgImprovement: 0 }
  }

  const improvements: number[] = []
  for (let i = 1; i < scores.length; i++) {
    improvements.push(scores[i] - scores[i - 1])
  }

  const avgImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length
  const lastImprovement = improvements[improvements.length - 1]

  return {
    scores,
    isImproving: avgImprovement > 0.3,
    isStagnant: Math.abs(lastImprovement) < 0.5,
    avgImprovement
  }
}

export function shouldStopRewrite(
  score: CriticScore,
  trend: ScoreTrend,
  round: number,
  maxRounds: number
): { stop: boolean; reason?: string } {
  // 达到最大轮数
  if (round >= maxRounds) {
    return { stop: true, reason: `已达最大重写轮数 (${maxRounds})` }
  }

  // 评分达标（良好即可，不要求完美）
  if (score.overall >= 7.5 && score.structure >= 7 && score.conflict >= 6) {
    return { stop: true, reason: `评分已达标 (${score.overall}/10)` }
  }

  // 第一轮后就停滞 → 停止
  if (trend.isStagnant && round >= 1) {
    return { stop: true, reason: `评分停滞 (${trend.scores.join('→')}), 停止重写` }
  }

  // 评分没有持续改善
  if (!trend.isImproving && round >= 1) {
    return { stop: true, reason: '评分未持续改善' }
  }

  return { stop: false }
}
