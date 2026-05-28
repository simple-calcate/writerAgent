import { useState, useEffect } from 'react'
import { useVisualStore } from '../stores/useVisualStore'
import type { WallpaperInfo } from '../../../shared/types'

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
  const [wallpapers, setWallpapers] = useState<WallpaperInfo[]>([])
  const [scanning, setScanning] = useState(false)

  const handleSelectBackground = async () => {
    const path = await window.api.selectBackgroundImage()
    if (path) {
      settings.updateSettings({ backgroundImage: path, effectsEnabled: true })
    }
  }

  const handleDetectSteam = async () => {
    const path = await window.api.detectSteamPath()
    if (path) {
      const wePath = path + '\\steamapps\\workshop\\content\\431960'
      settings.updateSettings({ wallpaperEnginePath: wePath })
    }
    return path
  }

  const handleSelectFolder = async () => {
    const path = await window.api.selectFolder()
    if (path) {
      settings.updateSettings({ wallpaperEnginePath: path })
    }
  }

  const handleScanWallpapers = async () => {
    if (!settings.wallpaperEnginePath) return
    setScanning(true)
    try {
      const result = await window.api.scanWallpapers(settings.wallpaperEnginePath)
      setWallpapers(result)
    } finally {
      setScanning(false)
    }
  }

  const handleSelectWallpaper = async (wp: WallpaperInfo) => {
    const processed = await window.api.prepareWallpaper(wp.file)
    if (processed) {
      settings.updateSettings({ backgroundImage: processed, effectsEnabled: true })
    }
  }

  useEffect(() => {
    if (settings.wallpaperEngineEnabled && settings.wallpaperEnginePath) {
      handleScanWallpapers()
    }
  }, [settings.wallpaperEngineEnabled, settings.wallpaperEnginePath])

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
                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">适应方式</label>
                  <div className="flex gap-1.5">
                    {[
                      { value: 'cover' as const, label: '填充' },
                      { value: 'contain' as const, label: '适应' },
                      { value: 'fill' as const, label: '拉伸' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => settings.updateSettings({ backgroundFit: opt.value })}
                        className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                          settings.backgroundFit === opt.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">缩放</label>
                  <Slider value={settings.backgroundScale} onChange={v => settings.updateSettings({ backgroundScale: v })} min={20} max={200} unit="%" />
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

          {/* Wallpaper Engine */}
          <Section title="壁纸引擎" enabled={settings.wallpaperEngineEnabled} onToggle={v => settings.updateSettings({ wallpaperEngineEnabled: v })}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={settings.wallpaperEnginePath || ''}
                  placeholder="Wallpaper Engine 壁纸目录路径"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600"
                  readOnly
                />
                <button
                  onClick={handleDetectSteam}
                  className="px-2 py-1 text-[11px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors shrink-0"
                >
                  自动检测
                </button>
                <button
                  onClick={handleSelectFolder}
                  className="px-2 py-1 text-[11px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors shrink-0"
                >
                  手动选择
                </button>
              </div>
              {settings.wallpaperEnginePath && (
                <p className="text-[10px] text-gray-600 truncate">路径：{settings.wallpaperEnginePath}</p>
              )}
              {settings.wallpaperEnginePath && (
                <button
                  onClick={handleScanWallpapers}
                  disabled={scanning}
                  className="w-full py-1.5 text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                >
                  {scanning ? '扫描中...' : '扫描壁纸'}
                </button>
              )}
              {wallpapers.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {wallpapers.map(wp => (
                    <div
                      key={wp.id}
                      onClick={() => handleSelectWallpaper(wp)}
                      className="flex items-center gap-2 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 transition-colors"
                    >
                      <div className="w-12 h-8 rounded overflow-hidden bg-gray-700 shrink-0">
                        {wp.preview ? (
                          <img src={wp.preview} className="w-full h-full object-cover" />
                        ) : /\.(mp4|webm)$/i.test(wp.file) ? (
                          <video src={wp.file} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={wp.file} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 truncate">{wp.name}</p>
                        <p className="text-[10px] text-gray-600">{wp.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {wallpapers.length === 0 && settings.wallpaperEnginePath && !scanning && (
                <p className="text-[11px] text-gray-600 text-center py-2">未找到壁纸，请检查路径是否正确</p>
              )}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
