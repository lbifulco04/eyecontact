import { useCallback, useEffect, useRef, useState } from 'react'

const WS_URL = import.meta.env.VITE_EYE_TRACKING_WS_URL || 'ws://localhost:8100/ws/track'
const SEND_INTERVAL_MS = 100 // ~10 fps: sufficiente per tracciamento real-time, ultra-leggero su CPU

/**
 * Cattura il flusso video dalla webcam, lo invia in formato binario compresso (JPEG Blob)
 * al microservizio Python di eye-tracking via WebSocket e restituisce le feature grezze di sguardo.
 */
export function useEyeTracking({ enabled, onFeatures = null } = {}) {
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

  const [status, setStatus] = useState('idle') // idle | connecting | streaming | error
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
    const w = 320
    const h = Math.round((video.videoHeight / (video.videoWidth || 1)) * w) || 240
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
          ws.send(blob)
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
          } catch {
            // Ignora autostart interrupt
          }
        }

        const ws = new WebSocket(WS_URL)
        ws.binaryType = 'blob'
        wsRef.current = ws

        ws.onopen = () => {
          if (cancelled) {
            ws.close()
            return
          }
          setStatus('streaming')
          intervalRef.current = setInterval(sendFrame, SEND_INTERVAL_MS)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
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
          setStatus('error')
          setErrorMessage('Impossibile connettersi al servizio di eye-tracking.')
        }

        ws.onclose = () => {
          if (!cancelled) setStatus('idle')
        }
      } catch (err) {
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
  }, [enabled, sendFrame])

  return {
    videoRef,
    mediaStream,
    status,
    lastFeatures,
    featuresRef,
    errorMessage
  }
}
