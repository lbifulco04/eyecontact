import { useCallback, useEffect, useRef, useState } from 'react'

const WS_URL = import.meta.env.VITE_EYE_TRACKING_WS_URL || 'ws://localhost:8100/ws/track'
const SEND_INTERVAL_MS = 100 // ~10 fps

export function useEyeTracking({ enabled, onFeatures = null, smooth = true } = {}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const intervalRef = useRef(null)
  const streamRef = useRef(null)
  const isSendingRef = useRef(false)
  const featuresRef = useRef(null)
  const onFeaturesRef = useRef(onFeatures)

  useEffect(() => {
    onFeaturesRef.current = onFeatures
  }, [onFeatures])

  const [status, setStatus] = useState('idle')
  const [lastFeatures, setLastFeatures] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [mediaStream, setMediaStream] = useState(null)

  const sendFrame = useCallback(() => {
    const video = videoRef.current
    const ws = wsRef.current
    if (
      !video ||
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      video.readyState < 2 ||
      isSendingRef.current ||
      ws.bufferedAmount > 65536
    ) {
      return
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
    const canvas = canvasRef.current
    const w = 640
    const h = Math.round((video.videoHeight / (video.videoWidth || 1)) * w) || 480
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    ctx.drawImage(video, 0, 0, w, h)

    isSendingRef.current = true
    canvas.toBlob(
      (blob) => {
        isSendingRef.current = false
        if (blob && ws.readyState === WebSocket.OPEN) {
          console.log(`[useEyeTracking] Invio blob di ${blob.size} bytes`)
          ws.send(blob)
        } else {
          console.warn('[useEyeTracking] Blob nullo o WebSocket non aperto')
        }
      },
      'image/jpeg',
      0.6
    )
  }, [])

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return
    }
    let cancelled = false

    async function start() {
      setStatus('connecting')
      setErrorMessage(null)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        setMediaStream(stream)

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          try {
            await videoRef.current.play()
            console.log('[useEyeTracking] Video avviato')
          } catch {
            // Ignora autostart interrupt
          }
        }

        const wsUrl = smooth ? WS_URL : `${WS_URL}?smooth=false`
        console.log(`[useEyeTracking] Connessione WebSocket a ${wsUrl}`)
        const ws = new WebSocket(wsUrl)
        ws.binaryType = 'blob'
        wsRef.current = ws

        ws.onopen = () => {
          if (cancelled) {
            ws.close()
            return
          }
          console.log('[useEyeTracking] WebSocket aperto')
          setStatus('streaming')
          intervalRef.current = setInterval(sendFrame, SEND_INTERVAL_MS)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('[useEyeTracking] Ricevuto:', data)
            featuresRef.current = data
            setLastFeatures(data)
            if (onFeaturesRef.current) {
              onFeaturesRef.current(data)
            }
          } catch {
            // ignora pacchetti malformati
          }
        }

        ws.onerror = () => {
          console.error('[useEyeTracking] Errore WebSocket')
          setStatus('error')
          setErrorMessage('Impossibile connettersi al servizio di eye-tracking.')
        }

        ws.onclose = () => {
          if (!cancelled) setStatus('idle')
        }
      } catch (err) {
        console.error('[useEyeTracking] Errore getUserMedia:', err)
        setStatus('error')
        setErrorMessage('Accesso alla webcam negato o non disponibile.')
      }
    }

    start()

    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (wsRef.current) wsRef.current.close()
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
      wsRef.current = null
      streamRef.current = null
      setMediaStream(null)
    }
  }, [enabled, sendFrame, smooth])

  return {
    videoRef,
    mediaStream,
    status,
    lastFeatures,
    featuresRef,
    errorMessage
  }
}