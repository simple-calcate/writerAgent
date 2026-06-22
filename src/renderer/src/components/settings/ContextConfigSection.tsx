import { useState } from 'react'
import type { ContextConfig, CompressionStrategyType } from '../../../../shared/types'
import { DEFAULT_CONTEXT_CONFIG } from '../../../../shared/types'

interface ContextConfigSectionProps {
  config: ContextConfig
  onChange: (config: ContextConfig) => void
}

export default function ContextConfigSection({ config, onChange }: ContextConfigSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const updateConfig = (updates: Partial<ContextConfig>) => {
    onChange({ ...config, ...updates })
  }

  const resetToDefaults = () => {
    onChange(DEFAULT_CONTEXT_CONFIG)
  }

  return (
    <div className="mt-3 border border-gray-600/50 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs font-medium text-gray-300">上下文管理</span>
          <span className="text-[10px] text-gray-500">Token 预算与压缩策略</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 py-3 space-y-4 bg-gray-800/30">
          {/* Output Reserve */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">输出预留比例</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0.1}
                max={0.5}
                step={0.05}
                value={config.outputReserveRatio}
                onChange={e => updateConfig({ outputReserveRatio: parseFloat(e.target.value) })}
                className="flex-1 accent-blue-500"
              />
              <span className="text-xs text-gray-300 w-12 text-right">{Math.round(config.outputReserveRatio * 100)}%</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">预留用于模型输出的 Token 比例</p>
          </div>

          {/* Budget Ratios */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">系统提示词预算分配</label>
            <div className="space-y-2">
              <BudgetSlider
                label="章节内容"
                value={config.chapterBudgetRatio}
                onChange={v => updateConfig({ chapterBudgetRatio: v })}
                color="bg-green-500"
              />
              <BudgetSlider
                label="大纲"
                value={config.outlineBudgetRatio}
                onChange={v => updateConfig({ outlineBudgetRatio: v })}
                color="bg-yellow-500"
              />
              <BudgetSlider
                label="对话历史"
                value={config.historyBudgetRatio}
                onChange={v => updateConfig({ historyBudgetRatio: v })}
                color="bg-purple-500"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-2">
              当前分配：{Math.round((config.chapterBudgetRatio + config.outlineBudgetRatio + config.historyBudgetRatio + 0.30) * 100)}%
              （剩余 30% 自动分配给写作技能、推理链等）
            </p>
          </div>

          {/* History Compression */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">对话历史压缩</label>
            <div className="space-y-3">
              {/* Compression Strategy Selector */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">压缩策略</label>
                <select
                  value={config.compressionStrategy || 'rule-based'}
                  onChange={e => updateConfig({ compressionStrategy: e.target.value as CompressionStrategyType })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="rule-based">规则式（零成本，默认）</option>
                  <option value="semantic">语义压缩（LLM 驱动）</option>
                  <option value="auto">自动选择</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  {config.compressionStrategy === 'semantic' 
                    ? '使用 LLM 进行智能摘要压缩，保留关键信息，压缩率更高'
                    : config.compressionStrategy === 'auto'
                    ? '优先使用语义压缩，不可用时回退到规则式'
                    : '基于规则的快速压缩，零成本无依赖'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">保留最近轮数</label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={config.keepRecentRounds}
                    onChange={e => updateConfig({ keepRecentRounds: Math.max(5, Math.min(50, parseInt(e.target.value) || 20)) })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">摘要 Token 上限</label>
                  <input
                    type="number"
                    min={200}
                    max={2000}
                    step={100}
                    value={config.summaryBudget}
                    onChange={e => updateConfig({ summaryBudget: Math.max(200, Math.min(2000, parseInt(e.target.value) || 800)) })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tool Result Limits */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">工具结果限制</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-24 shrink-0">总预算占比</span>
                <input
                  type="range"
                  min={0.05}
                  max={0.30}
                  step={0.05}
                  value={config.toolResultBudgetRatio}
                  onChange={e => updateConfig({ toolResultBudgetRatio: parseFloat(e.target.value) })}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xs text-gray-300 w-10 text-right">{Math.round(config.toolResultBudgetRatio * 100)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ToolLimitInput
                  label="summarize_chapter"
                  value={config.summarizeResultLimit}
                  onChange={v => updateConfig({ summarizeResultLimit: v })}
                />
                <ToolLimitInput
                  label="refine_summary"
                  value={config.refineResultLimit}
                  onChange={v => updateConfig({ refineResultLimit: v })}
                />
                <ToolLimitInput
                  label="read_chapter_content"
                  value={config.readContentResultLimit}
                  onChange={v => updateConfig({ readContentResultLimit: v })}
                />
                <ToolLimitInput
                  label="默认工具"
                  value={config.defaultToolResultLimit}
                  onChange={v => updateConfig({ defaultToolResultLimit: v })}
                />
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-2 border-t border-gray-700/50">
            <button
              onClick={resetToDefaults}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              恢复默认值
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BudgetSlider({ label, value, onChange, color }: {
  label: string
  value: number
  onChange: (v: number) => void
  color: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <input
        type="number"
        min={0.05}
        max={0.50}
        step={0.05}
        value={value}
        onChange={e => onChange(Math.max(0.05, Math.min(0.50, parseFloat(e.target.value) || 0.15)))}
        className="w-14 bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-300 text-center focus:outline-none focus:border-blue-500"
      />
      <span className="text-[10px] text-gray-500 w-8">{Math.round(value * 100)}%</span>
    </div>
  )
}

function ToolLimitInput({ label, value, onChange }: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-500 truncate flex-1">{label}</span>
      <input
        type="number"
        min={100}
        max={10000}
        step={100}
        value={value}
        onChange={e => onChange(Math.max(100, Math.min(10000, parseInt(e.target.value) || 2000)))}
        className="w-20 bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-300 text-right focus:outline-none focus:border-blue-500"
      />
      <span className="text-[10px] text-gray-500">T</span>
    </div>
  )
}
