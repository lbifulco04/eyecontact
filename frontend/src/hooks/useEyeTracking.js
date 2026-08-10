import { useCallback, useEffect, useRef, useState } from 'react'

const WS_URL = import.meta.env.VITE_EYE_TRACKING_WS_URL || 'ws://localhost:8100/ws/track'
const SEND_INTERVAL_MS = 100 // ~10 fps: sufficiente per fissazione/inseguimento, leggero sulla CPU

/**
 * Cattura il flusso video dalla webcam, lo invia a frame regolari al
 * microservizio Python di eye-tracking via WebSocket e restituisce le
 * feature grezze di sguardo (feature_x/feature_y, blink, distanza) ricevute.
 */
export function useEyeTracking({ enabled }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))
  const wsRef = useRef(null)
  const intervalRef = useRef(null)
  const streamRef = useRef(null)

  const [status, setStatus] = useState('idle') // idle | connecting | streaming | error
  const [lastFeatures, setLastFeatures] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const sendFrame = useCallback(() => {
    const video = videoRef.current
    const ws = wsRef.current
    if (!video || !ws || ws.readyState !== WebSocket.OPEN || video.readyState < 2) return

    const canvas = canvasRef.current
    const w = 320
    const h = Math.round((video.videoHeight / video.videoWidth) * w) || 240
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
    const base64 = dataUrl.split(',')[1]
    ws.send(JSON.stringify({ frame: base64 }))
  }, [])

  useEffect(() => {
    if (!enabled) return
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => {
          setStatus('streaming')
          intervalRef.current = setInterval(sendFrame, SEND_INTERVAL_MS)
        }
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            setLastFeatures(data)
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
    }
  }, [enabled, sendFrame])

  return { videoRef, status, lastFeatures, errorMessage }
}
