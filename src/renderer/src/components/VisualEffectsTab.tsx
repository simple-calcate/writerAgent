import { useVisualStore } from '../stores/useVisualStore'

const GLOW_PRESETS = [
  { label: '蓝', color: 'rgba(100,150,255,0.15)' },
  { label: '紫', color: 'rgba(160,100,255,0.15)' },
  { label: '琥珀', color: 'rgba(255,180,80,0.12)' },
  { label: '绿', color: 'rgba(100,220,150,0.12)' }
]

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${value ? 'bg-blue-600' : 'bg-gray-600'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </div>
  )
}

function Slider({ value, onChange, min, max, step = 1, unit = '' }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-blue-500 h-1"
      />
      <span className="text-[11px] text-gray-400 w-10 text-right">{value}{unit}</span>
    </div>
  )
}

function Section({ title, enabled, onToggle, children }: {
  title: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode
}) {
  return (
    <div className="bg-gray-900/40 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300 font-medium">{title}</span>
        <Toggle value={enabled} onChange={onToggle} />
      </div>
      {enabled && <div className="space-y-2 pt-1">{children}</div>}
    </div>
  )
}

export default function VisualEffectsTab() {
  const settings = useVisualStore()

  const handleSelectBackground = async () => {
    const path = await window.api.selectBackgroundImage()
    if (path) {
      settings.updateSettings({ backgroundImage: path, effectsEnabled: true })
    }
  }

  return (
    <div className="space-y-3">
      {/* Master toggle */}
      <div className="flex items-center justify-between bg-gray-900/40 rounded-lg p-3">
        <div>
          <span className="text-sm text-gray-200 font-medium">视觉效果</span>
          <p className="text-[11px] text-gray-500 mt-0.5">开启后可使用背景、毛玻璃、光晕、雨滴等效果</p>
        </div>
        <Toggle value={settings.effectsEnabled} onChange={v => settings.updateSettings({ effectsEnabled: v })} />
      </div>

      {settings.effectsEnabled && (
        <>
          {/* Background - always shows content, no conditional hide */}
          <div className="bg-gray-900/40 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300 font-medium">背景图</span>
              {settings.backgroundImage && (
                <button onClick={() => settings.updateSettings({ backgroundImage: null })} className="text-[11px] text-red-400 hover:text-red-300">移除</button>
              )}
            </div>
            {settings.backgroundImage ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-10 rounded overflow-hidden bg-gray-700 shrink-0">
                    {/\.(mp4|webm)$/i.test(settings.backgroundImage) ? (
                      <video src={settings.backgroundImage} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={settings.backgroundImage} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 truncate">已选择背景</p>
                    <button onClick={handleSelectBackground} className="text-[11px] text-blue-400 hover:text-blue-300">更换</button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">透明度</label>
                  <Slider value={settings.backgroundOpacity} onChange={v => settings.updateSettings({ backgroundOpacity: v })} min={0} max={1} step={0.05} />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">模糊</label>
                  <Slider value={settings.backgroundBlur} onChange={v => settings.updateSettings({ backgroundBlur: v })} min={0} max={20} unit="px" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">底色</label>
                  <input
                    type="color"
                    value={settings.backgroundColor}
                    onChange={e => settings.updateSettings({ backgroundColor: e.target.value })}
                    className="w-8 h-5 rounded border-0 cursor-pointer"
                  />
                </div>
              </>
            ) : (
              <button
                onClick={handleSelectBackground}
                className="w-full py-2 text-xs text-gray-400 border border-dashed border-gray-600 rounded hover:border-blue-500 hover:text-blue-400 transition-colors"
              >
                选择图片或视频文件
              </button>
            )}
          </div>

          {/* Frosted glass */}
          <Section title="毛玻璃" enabled={settings.frostedGlass} onToggle={v => settings.updateSettings({ frostedGlass: v })}>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">模糊强度</label>
              <Slider value={settings.glassBlur} onChange={v => settings.updateSettings({ glassBlur: v })} min={4} max={24} unit="px" />
            </div>
          </Section>

          {/* Mouse glow */}
          <Section title="鼠标光晕" enabled={settings.mouseGlow} onToggle={v => settings.updateSettings({ mouseGlow: v })}>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">颜色</label>
              <div className="flex gap-1.5">
                {GLOW_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => settings.updateSettings({ mouseGlowColor: p.color })}
                    className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                      settings.mouseGlowColor === p.color
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">半径</label>
              <Slider value={settings.mouseGlowRadius} onChange={v => settings.updateSettings({ mouseGlowRadius: v })} min={100} max={400} unit="px" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">强度</label>
              <Slider value={settings.mouseGlowIntensity} onChange={v => settings.updateSettings({ mouseGlowIntensity: v })} min={0.1} max={1} step={0.05} />
            </div>
          </Section>

          {/* Rain */}
          <Section title="雨滴效果" enabled={settings.rainEffect} onToggle={v => settings.updateSettings({ rainEffect: v })}>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">密度</label>
              <Slider value={settings.rainDensity} onChange={v => settings.updateSettings({ rainDensity: v })} min={50} max={300} />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">速度</label>
              <Slider value={settings.rainSpeed} onChange={v => settings.updateSettings({ rainSpeed: v })} min={1} max={5} step={0.5} unit="x" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">透明度</label>
              <Slider value={settings.rainOpacity} onChange={v => settings.updateSettings({ rainOpacity: v })} min={0.1} max={0.8} step={0.05} />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
