import { useVisualStore } from '../stores/useVisualStore'

export default function BackgroundLayer() {
  const { effectsEnabled, backgroundImage, backgroundOpacity, backgroundBlur, backgroundColor } = useVisualStore()

  if (!effectsEnabled || !backgroundImage) return null

  const isVideo = /\.(mp4|webm)$/i.test(backgroundImage)

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <div className="absolute inset-0" style={{ background: backgroundColor }} />
      {isVideo ? (
        <video
          src={backgroundImage}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: backgroundOpacity, filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined }}
        />
      ) : (
        <img
          src={backgroundImage}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: backgroundOpacity, filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined }}
        />
      )}
    </div>
  )
}
