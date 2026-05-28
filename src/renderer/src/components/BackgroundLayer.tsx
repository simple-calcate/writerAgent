import { useVisualStore } from '../stores/useVisualStore'

export default function BackgroundLayer() {
  const { effectsEnabled, backgroundImage, backgroundOpacity, backgroundBlur, backgroundColor, backgroundFit, backgroundScale } = useVisualStore()

  if (!effectsEnabled || !backgroundImage) return null

  const isVideo = /\.(mp4|webm)$/i.test(backgroundImage)

  const mediaStyle: React.CSSProperties = {
    opacity: backgroundOpacity,
    filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined,
    objectFit: backgroundFit,
    width: `${backgroundScale}%`,
    height: `${backgroundScale}%`,
    maxWidth: 'none',
    maxHeight: 'none'
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0" style={{ background: backgroundColor }} />
      <div className="absolute inset-0 flex items-center justify-center">
        {isVideo ? (
          <video
            src={backgroundImage}
            autoPlay
            loop
            muted
            playsInline
            style={mediaStyle}
          />
        ) : (
          <img
            src={backgroundImage}
            style={mediaStyle}
          />
        )}
      </div>
    </div>
  )
}
