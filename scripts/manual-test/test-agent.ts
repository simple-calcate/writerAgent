/**
 * Writer Agent 2.0 模块验证脚本
 * 运行方式: npx tsx src/main/test-agent.ts
 */

// ─── 1. State Machine ───
import { createWritingStateMachine } from './agent/state-machine'

function testStateMachine(): boolean {
  console.log('\n=== 1. State Machine ===')
  const sm = createWritingStateMachine()
  let pass = true

  // 初始状态
  if (sm.currentPhase !== 'idle') { console.log('  ✗ 初始状态应为 idle'); pass = false }
  else { console.log('  ✓ 初始状态: idle') }

  // 正常转换
  if (!sm.transition('planning')) { console.log('  ✗ idle→planning 应成功'); pass = false }
  else { console.log('  ✓ idle → planning') }

  if (!sm.transition('writing')) { console.log('  ✗ planning→writing 应成功'); pass = false }
  else { console.log('  ✓ planning → writing') }

  if (!sm.transition('critic_check', { hasContent: true })) { console.log('  ✗ writing→critic_check 应成功'); pass = false }
  else { console.log('  ✓ writing → critic_check') }

  if (!sm.transition('revision', { hasIssues: true })) { console.log('  ✗ critic_check→revision 应成功'); pass = false }
  else { console.log('  ✓ critic_check → revision') }

  if (!sm.transition('critic_check', { hasContent: true })) { console.log('  ✗ revision→critic_check 应成功'); pass = false }
  else { console.log('  ✓ revision → critic_check') }

  if (!sm.transition('finalizing')) { console.log('  ✗ critic_check→finalizing 应成功'); pass = false }
  else { console.log('  ✓ critic_check → finalizing') }

  // 非法转换
  if (sm.transition('planning')) { console.log('  ✗ finalizing→planning 应失败'); pass = false }
  else { console.log('  ✓ finalizing → planning 被拒绝') }

  // 守卫测试
  sm.reset()
  sm.transition('writing')
  if (sm.transition('critic_check', { hasContent: false })) { console.log('  ✗ 无内容时应拒绝进入 critic_check'); pass = false }
  else { console.log('  ✓ 守卫: 无内容时拒绝 critic_check') }

  // 快照
  sm.reset()
  sm.transition('planning')
  const snapshot = sm.snapshot
  if (snapshot.phase !== 'planning' || snapshot.transitionCount !== 1) { console.log('  ✗ 快照数据不正确'); pass = false }
  else { console.log('  ✓ 快照: phase=planning, count=1') }

  // 历史
  if (snapshot.history.length !== 1) { console.log('  ✗ 历史记录应为 1'); pass = false }
  else { console.log('  ✓ 历史记录: 1 条') }

  console.log(`  结果: ${pass ? 'PASS' : 'FAIL'}`)
  return pass
}

// ─── 2. Importance Scorer ───
import { scoreChunk, scoreToImportance, scoreMessages } from './llm/importance-scorer'

function testImportanceScorer(): boolean {
  console.log('\n=== 2. Importance Scorer ===')
  let pass = true

  // 关键词密度
  const highScore = scoreChunk('主角决定前往宗门，这是一个关键的转折点')
  if (highScore < 0.4) { console.log(`  ✗ 含关键词文本分数应 > 0.4, 实际: ${highScore.toFixed(2)}`); pass = false }
  else { console.log(`  ✓ 关键词文本: ${highScore.toFixed(2)}`) }

  const lowScore = scoreChunk('今天天气不错')
  if (lowScore > 0.5) { console.log(`  ✗ 普通文本分数应 < 0.5, 实际: ${lowScore.toFixed(2)}`); pass = false }
  else { console.log(`  ✓ 普通文本: ${lowScore.toFixed(2)}`) }

  // 等级映射
  if (scoreToImportance(0.9) !== 'critical') { console.log('  ✗ 0.9 应为 critical'); pass = false }
  if (scoreToImportance(0.7) !== 'high') { console.log('  ✗ 0.7 应为 high'); pass = false }
  if (scoreToImportance(0.5) !== 'medium') { console.log('  ✗ 0.5 应为 medium'); pass = false }
  if (scoreToImportance(0.2) !== 'low') { console.log('  ✗ 0.2 应为 low'); pass = false }
  else { console.log('  ✓ 等级映射正确') }

  // 消息评分
  const messages = [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '主角决定前往宗门参加考核，这是一个关键的转折点' },
    { role: 'user', content: '继续写' }
  ]
  const scored = scoreMessages(messages)
  if (scored.length !== 3) { console.log('  ✗ 评分数量不正确'); pass = false }
  if (scored[1].score <= scored[0].score) { console.log('  ✗ 含关键词消息分数应更高'); pass = false }
  else { console.log('  ✓ 消息评分排序正确') }

  console.log(`  结果: ${pass ? 'PASS' : 'FAIL'}`)
  return pass
}

// ─── 3. Chunking ───
import { chunkText, prioritizeChunks } from './llm/chunking'

function testChunking(): boolean {
  console.log('\n=== 3. Chunking ===')
  let pass = true

  // 短文本不拆分
  const shortText = '这是一段短文本。'
  const shortChunks = chunkText(shortText)
  if (shortChunks.length !== 1) { console.log(`  ✗ 短文本应为 1 块, 实际: ${shortChunks.length}`); pass = false }
  else { console.log('  ✓ 短文本不拆分') }

  // 长文本拆分
  const longText = Array(20).fill(null).map((_, i) => `这是第 ${i + 1} 段内容。包含一些测试文字用于验证分块功能是否正常工作。每段大约五十个字左右。`).join('\n\n')
  const chunks = chunkText(longText, { maxChunkTokens: 100 })
  if (chunks.length <= 1) { console.log(`  ✗ 长文本应拆分为多块, 实际: ${chunks.length}`); pass = false }
  else { console.log(`  ✓ 长文本拆分为 ${chunks.length} 块`) }

  // 每块不超过限制
  const overLimit = chunks.filter(c => c.tokenEstimate > 150)
  if (overLimit.length > 0) { console.log(`  ✗ 有 ${overLimit.length} 块超出限制`); pass = false }
  else { console.log('  ✓ 所有块在 token 限制内') }

  // 优先级过滤
  const prioritized = prioritizeChunks(chunks, 200)
  if (prioritized.length === 0) { console.log('  ✗ 优先级过滤结果不应为空'); pass = false }
  else { console.log(`  ✓ 优先级过滤: ${prioritized.length} 块`) }

  console.log(`  结果: ${pass ? 'PASS' : 'FAIL'}`)
  return pass
}

// ─── 4. Task Resolver ───
import { resolveDependencyLayers } from './agent/task-resolver'

function testTaskResolver(): boolean {
  console.log('\n=== 4. Task Resolver ===')
  let pass = true

  // 无依赖
  const noDeps = [
    { id: 'a', description: '', agentRole: 'writer' as const, priority: 1, status: 'pending' as const },
    { id: 'b', description: '', agentRole: 'critic' as const, priority: 2, status: 'pending' as const }
  ]
  const layers1 = resolveDependencyLayers(noDeps)
  if (layers1.length !== 1) { console.log(`  ✗ 无依赖应为 1 层, 实际: ${layers1.length}`); pass = false }
  if (layers1[0].length !== 2) { console.log(`  ✗ 第一层应有 2 个任务, 实际: ${layers1[0].length}`); pass = false }
  else { console.log('  ✓ 无依赖: 1 层, 2 任务可并行') }

  // 有依赖
  const withDeps = [
    { id: 'a', description: '', agentRole: 'writer' as const, priority: 1, status: 'pending' as const },
    { id: 'b', description: '', agentRole: 'critic' as const, priority: 2, dependsOn: ['a'], status: 'pending' as const },
    { id: 'c', description: '', agentRole: 'editor' as const, priority: 3, dependsOn: ['b'], status: 'pending' as const }
  ]
  const layers2 = resolveDependencyLayers(withDeps)
  if (layers2.length !== 3) { console.log(`  ✗ 链式依赖应为 3 层, 实际: ${layers2.length}`); pass = false }
  else { console.log('  ✓ 链式依赖: 3 层') }

  // 混合依赖
  const mixed = [
    { id: 'a', description: '', agentRole: 'writer' as const, priority: 1, status: 'pending' as const },
    { id: 'b', description: '', agentRole: 'writer' as const, priority: 1, status: 'pending' as const },
    { id: 'c', description: '', agentRole: 'critic' as const, priority: 2, dependsOn: ['a', 'b'], status: 'pending' as const }
  ]
  const layers3 = resolveDependencyLayers(mixed)
  if (layers3.length !== 2) { console.log(`  ✗ 混合依赖应为 2 层, 实际: ${layers3.length}`); pass = false }
  if (layers3[0].length !== 2) { console.log(`  ✗ 第一层应有 2 个并行任务, 实际: ${layers3[0].length}`); pass = false }
  else { console.log('  ✓ 混合依赖: 2 层, 第一层 2 并行') }

  console.log(`  结果: ${pass ? 'PASS' : 'FAIL'}`)
  return pass
}

// ─── 5. Rewrite Strategy ───
import { selectRewriteStrategy } from './agent/rewrite-strategy'

function testRewriteStrategy(): boolean {
  console.log('\n=== 5. Rewrite Strategy ===')
  let pass = true

  const goodScore = { overall: 8.5, structure: 8, pacing: 8, conflict: 8, infoDensity: 8, styleConsistency: 8, issues: [], suggestions: [], shouldRewrite: false }
  const badStructureScore = { overall: 4, structure: 3, pacing: 6, conflict: 6, infoDensity: 6, styleConsistency: 6, issues: ['结构混乱'], suggestions: ['重新组织'], shouldRewrite: true }
  const styleOnlyScore = { overall: 7, structure: 8, pacing: 7, conflict: 7, infoDensity: 7, styleConsistency: 5, issues: ['文风不统一'], suggestions: ['统一风格'], shouldRewrite: true }
  const pacingOnlyScore = { overall: 7, structure: 7, pacing: 5, conflict: 7, infoDensity: 7, styleConsistency: 7, issues: ['节奏拖沓'], suggestions: ['加快节奏'], shouldRewrite: true }
  const conflictOnlyScore = { overall: 7, structure: 7, pacing: 7, conflict: 4, infoDensity: 7, styleConsistency: 7, issues: ['冲突不足'], suggestions: ['增加冲突'], shouldRewrite: true }

  const s1 = selectRewriteStrategy(goodScore, 1)
  if (s1.strategy !== 'skip') { console.log(`  ✗ 好分数应 skip, 实际: ${s1.strategy}`); pass = false }
  else { console.log('  ✓ 好分数 → skip') }

  const s2 = selectRewriteStrategy(badStructureScore, 1)
  if (s2.strategy !== 'full_rewrite') { console.log(`  ✗ 结构差应 full_rewrite, 实际: ${s2.strategy}`); pass = false }
  else { console.log('  ✓ 结构差 → full_rewrite') }

  const s3 = selectRewriteStrategy(styleOnlyScore, 1)
  if (s3.strategy !== 'style_pass') { console.log(`  ✗ 仅文风问题应 style_pass, 实际: ${s3.strategy}`); pass = false }
  else { console.log('  ✓ 仅文风问题 → style_pass') }

  const s4 = selectRewriteStrategy(pacingOnlyScore, 1)
  if (s4.strategy !== 'pacing_adjust') { console.log(`  ✗ 仅节奏问题应 pacing_adjust, 实际: ${s4.strategy}`); pass = false }
  else { console.log('  ✓ 仅节奏问题 → pacing_adjust') }

  const s5 = selectRewriteStrategy(conflictOnlyScore, 1)
  if (s5.strategy !== 'conflict_boost') { console.log(`  ✗ 仅冲突问题应 conflict_boost, 实际: ${s5.strategy}`); pass = false }
  else { console.log('  ✓ 仅冲突问题 → conflict_boost') }

  console.log(`  结果: ${pass ? 'PASS' : 'FAIL'}`)
  return pass
}

// ─── 6. Score Trend ───
import { trackScoreTrend, shouldStopRewrite } from './agent/score-trend'

function testScoreTrend(): boolean {
  console.log('\n=== 6. Score Trend ===')
  let pass = true

  // 上升趋势
  const improving = trackScoreTrend([5, 6, 7])
  if (!improving.isImproving) { console.log('  ✗ [5,6,7] 应为上升趋势'); pass = false }
  else { console.log('  ✓ 上升趋势: [5,6,7]') }

  // 停滞趋势
  const stagnant = trackScoreTrend([7, 7.1, 7.0])
  if (!stagnant.isStagnant) { console.log('  ✗ [7,7.1,7.0] 应为停滞'); pass = false }
  else { console.log('  ✓ 停滞趋势: [7,7.1,7.0]') }

  // 停止判断 - 高分
  const goodScore = { overall: 9, structure: 9, pacing: 9, conflict: 9, infoDensity: 9, styleConsistency: 9, issues: [], suggestions: [], shouldRewrite: false }
  const stop1 = shouldStopRewrite(goodScore, improving, 0, 3)
  if (!stop1.stop) { console.log('  ✗ 高分应停止'); pass = false }
  else { console.log('  ✓ 高分停止: ' + stop1.reason) }

  // 停止判断 - 达到最大轮数
  const midScore = { overall: 6, structure: 6, pacing: 6, conflict: 6, infoDensity: 6, styleConsistency: 6, issues: ['问题'], suggestions: ['建议'], shouldRewrite: true }
  const stop2 = shouldStopRewrite(midScore, improving, 3, 3)
  if (!stop2.stop) { console.log('  ✗ 达到最大轮数应停止'); pass = false }
  else { console.log('  ✓ 最大轮数停止: ' + stop2.reason) }

  // 停止判断 - 不应停止
  const stop3 = shouldStopRewrite(midScore, improving, 0, 3)
  if (stop3.stop) { console.log('  ✗ 低分+首轮不应停止'); pass = false }
  else { console.log('  ✓ 低分+首轮: 继续重写') }

  console.log(`  结果: ${pass ? 'PASS' : 'FAIL'}`)
  return pass
}

// ─── 7. Visualization ───
import { buildAgentFlow, TrajectoryRecorder } from './agent/visualization'

function testVisualization(): boolean {
  console.log('\n=== 7. Visualization ===')
  let pass = true

  // 流程图构建
  const subTasks = [
    { id: 't1', description: '写世界观', agentRole: 'writer' as const, priority: 1, status: 'done' as const },
    { id: 't2', description: '评审', agentRole: 'critic' as const, priority: 2, dependsOn: ['t1'], status: 'running' as const }
  ]
  const flow = buildAgentFlow('task1', 'critic_check', subTasks, [])
  if (flow.nodes.length < 4) { console.log(`  ✗ 流程图节点应 ≥ 4, 实际: ${flow.nodes.length}`); pass = false }
  else { console.log(`  ✓ 流程图: ${flow.nodes.length} 节点`) }

  if (flow.currentNodeId !== 't2') { console.log(`  ✗ 当前节点应为 t2, 实际: ${flow.currentNodeId}`); pass = false }
  else { console.log('  ✓ 当前节点: t2 (running)') }

  // 轨迹记录
  const recorder = new TrajectoryRecorder('task1', 'proj1')
  recorder.record('phase_change', { phase: 'planning' })
  recorder.record('subtask_start', { id: 't1' })
  recorder.record('critic_score', { overall: 7.5 })
  recorder.record('complete', { success: true })

  const trajectory = recorder.getTrajectory('最终内容')
  if (trajectory.entries.length !== 4) { console.log(`  ✗ 轨迹应有 4 条记录, 实际: ${trajectory.entries.length}`); pass = false }
  else { console.log(`  ✓ 轨迹记录: ${trajectory.entries.length} 条`) }

  if (trajectory.totalDuration === undefined || trajectory.totalDuration === null) { console.log('  ✗ 持续时间不应为 undefined/null'); pass = false }
  else { console.log(`  ✓ 持续时间: ${trajectory.totalDuration}ms`) }

  console.log(`  结果: ${pass ? 'PASS' : 'FAIL'}`)
  return pass
}

// ─── Main ───
function main() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║   Writer Agent 2.0 模块验证脚本     ║')
  console.log('╚══════════════════════════════════════╝')

  const results = [
    testStateMachine(),
    testImportanceScorer(),
    testChunking(),
    testTaskResolver(),
    testRewriteStrategy(),
    testScoreTrend(),
    testVisualization()
  ]

  const passed = results.filter(Boolean).length
  const total = results.length

  console.log('\n════════════════════════════════════════')
  console.log(`总计: ${passed}/${total} 通过`)
  if (passed === total) {
    console.log('✓ 全部通过!')
  } else {
    console.log(`✗ ${total - passed} 项失败`)
    process.exit(1)
  }
}

main()
