import type { AgentFeatureConfig } from '../../../../shared/types'
import { DEFAULT_AGENT_FEATURE_CONFIG } from '../../../../shared/types'

interface AgentConfigSectionProps {
  config: AgentFeatureConfig
  onChange: (config: AgentFeatureConfig) => void
}

export default function AgentConfigSection({ config, onChange }: AgentConfigSectionProps) {
  const update = (patch: Partial<AgentFeatureConfig>) => {
    onChange({ ...config, ...patch })
  }

  return (
    <div className="space-y-2.5 mt-2 pt-2 border-t border-gray-700/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Agent 配置</p>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 shrink-0 w-20">最大重写轮数</span>
        <input
          type="number"
          min={1}
          max={10}
          value={config.maxRewriteRounds}
          onChange={e => update({ maxRewriteRounds: Math.max(1, Math.min(10, parseInt(e.target.value) || 3)) })}
          className="w-16 bg-gray-800/80 border border-gray-600/50 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
        />
        <span className="text-[10px] text-gray-600">轮</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 shrink-0 w-20">Critic 阈值</span>
        <input
          type="number"
          min={1}
          max={10}
          value={config.criticThreshold}
          onChange={e => update({ criticThreshold: Math.max(1, Math.min(10, parseFloat(e.target.value) || 7)) })}
          className="w-16 bg-gray-800/80 border border-gray-600/50 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
        />
        <span className="text-[10px] text-gray-600">分 (0-10)</span>
      </div>

      <ToggleRow
        label="启用记忆系统"
        desc="自动提取事件/角色/风格记忆"
        value={config.enableMemory}
        onChange={v => update({ enableMemory: v })}
      />

      <ToggleRow
        label="启用轨迹记录"
        desc="记录 Agent 执行轨迹，可回放"
        value={config.enableTrajectory}
        onChange={v => update({ enableTrajectory: v })}
      />

      <ToggleRow
        label="自动提交记忆"
        desc="写作完成后自动将内容提交到记忆系统"
        value={config.autoCommitMemory}
        onChange={v => update({ autoCommitMemory: v })}
      />

      <ToggleRow
        label="显示记忆面板"
        desc="在对话面板底部显示持久记忆（事件/语义/风格/对话摘要）"
        value={config.showMemoryPanel}
        onChange={v => update({ showMemoryPanel: v })}
      />
    </div>
  )
}

function ToggleRow({ label, desc, value, onChange }: {
  label: string
  desc: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-300">{label}</p>
        <p className="text-[10px] text-gray-600">{desc}</p>
      </div>
      <div
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${value ? 'bg-blue-600' : 'bg-gray-600'}`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </div>
    </div>
  )
}
