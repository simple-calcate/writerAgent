import type { SubTask } from '../../shared/types'

/**
 * 解析子任务依赖图，返回按层级分组的执行顺序
 * 同一层级的任务可以并行执行
 */
export function resolveDependencyLayers(subTasks: SubTask[]): SubTask[][] {
  const resolved = new Set<string>()
  const layers: SubTask[][] = []
  let remaining = [...subTasks]
  let safetyCounter = 0

  while (remaining.length > 0 && safetyCounter < 100) {
    safetyCounter++
    const layer: SubTask[] = []

    for (const task of remaining) {
      const deps = task.dependsOn || []
      if (deps.every(d => resolved.has(d))) {
        layer.push(task)
      }
    }

    if (layer.length === 0) {
      layers.push(remaining)
      break
    }

    layers.push(layer)
    for (const task of layer) {
      resolved.add(task.id)
    }
    remaining = remaining.filter(t => !resolved.has(t.id))
  }

  return layers
}
