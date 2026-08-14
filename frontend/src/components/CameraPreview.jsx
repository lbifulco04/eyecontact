import React, { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Sparkles, Minimize2, Maximize2 } from 'lucide-react'

/**
 * Componente Picture-in-Picture per l'anteprima della webcam
 * con indicatore visivo in tempo reale dello stato di rilevamento degli occhi/viso.
 */
export default function CameraPreview({
  mediaStream,
  lastFeatures,
  status = 'idle',
  compact = false,
  className = ''
}) {
  const videoRef = useRef(null)
  const [minimized, setMinimized] = useState(compact)

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream
      videoRef.current.play().catch(() => {})
    }
  }, [mediaStream])

  const faceDetected = Boolean(lastFeatures?.face_detected)
  const isBlinking = Boolean(lastFeatures?.blink)
  const distanzaCm = lastFeatures?.distanza_cm ? Math.round(lastFeatures.distanza_cm) : null

  // Valutazione postura distanza
  const isOptimalDistance = distanzaCm && distanzaCm >= 40 && distanzaCm <= 70
  const isTooClose = distanzaCm && distanzaCm < 35
  const isTooFar = distanzaCm && distanzaCm > 75

  return (
    <div
      className={`transition-all duration-300 rounded-2xl border backdrop-blur-md overflow-hidden shadow-card ${
        faceDetected
          ? 'border-emerald-500/50 bg-ink-panel/90 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
          : 'border-amber-500/50 bg-ink-panel/90 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
      } ${className}`}
    >
      {/* Header status bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-ink/80 border-b border-white/5 text-xs">
        <div className="flex items-center gap-2">
          {faceDetected ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {isBlinking ? 'Blink!' : 'Occhi rilevati'}
              </span>
            </>
          ) : (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
              <span className="font-medium text-amber-300 flex items-center gap-1">
                <EyeOff className="w-3.5 h-3.5" />
                In cerca di occhi…
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {faceDetected && distanzaCm && (
            <span
              className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border ${
                isOptimalDistance
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              {distanzaCm} cm
            </span>
          )}
          <button
            type="button"
            onClick={() => setMinimized(!minimized)}
            className="text-mist-muted hover:text-white p-1 rounded transition"
            title={minimized ? 'Espandi fotocamera' : 'Minimizza'}
          >
            {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Video container */}
      {!minimized && (
        <div className="relative aspect-video w-full bg-black/80 overflow-hidden">
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-full object-cover -scale-x-100"
          />

          {/* Effetto mirino/overlay sul volto */}
          {faceDetected ? (
            <div className="absolute inset-2 border border-emerald-500/30 rounded-xl pointer-events-none transition-all duration-300 flex flex-col justify-between p-1.5">
              <div className="self-end flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 backdrop-blur-sm">
                <Sparkles className="w-2.5 h-2.5" /> Live
              </div>
              {isTooClose && (
                <div className="self-center bg-amber-950/90 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-500/40">
                  Troppo vicino allo schermo
                </div>
              )}
              {isTooFar && (
                <div className="self-center bg-amber-950/90 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-500/40">
                  Avvicinati allo schermo
                </div>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-3 text-center pointer-events-none">
              <div className="w-7 h-7 rounded-full border-2 border-amber-500/40 border-t-amber-400 animate-spin mb-1.5" />
              <p className="text-xs text-amber-200">Posizionati di fronte alla fotocamera</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
