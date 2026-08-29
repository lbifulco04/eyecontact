import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import AppShell from '../components/layout/AppShell.jsx'
import GazeReticle from '../components/GazeReticle.jsx'
import GazePointer from '../components/GazePointer.jsx'
import CameraPreview from '../components/CameraPreview.jsx'
import { useEyeTracking } from '../hooks/useEyeTracking.js'
import { salvaCalibrazione } from '../lib/api/calibration.js'

const EYE_TRACKING_HTTP_URL = import.meta.env.VITE_EYE_TRACKING_HTTP_URL || 'http://localhost:8100'
const SAMPLES_PER_POINT = 20

// Griglia 3x3 in coordinate normalizzate (0..1) sullo schermo
const POINTS = [
  [0.08, 0.1], [0.5, 0.1], [0.92, 0.1],
  [0.08, 0.5], [0.5, 0.5], [0.92, 0.5],
  [0.08, 0.9], [0.5, 0.9], [0.92, 0.9]
]

export default function Calibration() {
  const navigate = useNavigate()
  // smooth=false per disattivare il filtro durante la calibrazione
  const { videoRef, mediaStream, status, lastFeatures, errorMessage } = useEyeTracking({ enabled: true, smooth: true })
  const [pointIndex, setPointIndex] = useState(0)
  const [samples, setSamples] = useState([])
  const [collecting, setCollecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const [pointProgress, setPointProgress] = useState(0)
  const collectedRef = useRef([])
  const allSamplesRef = useRef([])

  useEffect(() => {
    if (!collecting || !lastFeatures?.face_detected) return
    collectedRef.current.push(lastFeatures)
    setPointProgress(collectedRef.current.length)

    if (collectedRef.current.length >= SAMPLES_PER_POINT) {
      const avgX = collectedRef.current.reduce((s, f) => s + f.feature_x, 0) / collectedRef.current.length
      const avgY = collectedRef.current.reduce((s, f) => s + f.feature_y, 0) / collectedRef.current.length
      const avgHeadYaw = collectedRef.current.reduce((s, f) => s + (f.head_yaw || 0), 0) / collectedRef.current.length
      const avgHeadPitch = collectedRef.current.reduce((s, f) => s + (f.head_pitch || 0), 0) / collectedRef.current.length
      const [tx, ty] = POINTS[pointIndex]
      const newSample = {
        feature_x: avgX,
        feature_y: avgY,
        head_yaw: avgHeadYaw,
        head_pitch: avgHeadPitch,
        target_x_norm: tx,
        target_y_norm: ty
      }
      
      const nextSamples = [...allSamplesRef.current, newSample]
      allSamplesRef.current = nextSamples
      setSamples(nextSamples)
      collectedRef.current = []
      setCollecting(false)
      setPointProgress(0)

      if (pointIndex < POINTS.length - 1) {
        setPointIndex((i) => i + 1)
      } else {
        finalizeCalibration(nextSamples)
      }
    }
  }, [lastFeatures, collecting])

  function startPointCapture() {
    collectedRef.current = []
    setPointProgress(0)
    setCollecting(true)
  }

  async function finalizeCalibration(finalSamples) {
    setSaving(true)
    setError(null)
    try {
      const { data: fit } = await axios.post(`${EYE_TRACKING_HTTP_URL}/calibrate/fit`, {
        samples: finalSamples || allSamplesRef.current
      })
      if (fit.error) throw new Error(fit.error)

      // Salva i coefficienti localmente per l'uso in altre parti dell'app
      localStorage.setItem('calibration_coef_x', JSON.stringify(fit.coef_x))
      localStorage.setItem('calibration_coef_y', JSON.stringify(fit.coef_y))
      localStorage.setItem('calibration_model', fit.model)

      await salvaCalibrazione({
        device_info: `${navigator.userAgent.slice(0, 60)}`,
        larghezza_schermo_px: window.screen.width,
        altezza_schermo_px: window.screen.height,
        punti_calibrazione_count: POINTS.length,
        qualita_calibrazione_pct: fit.qualita_calibrazione_pct,
        parametri_matrice: { coef_x: fit.coef_x, coef_y: fit.coef_y, model: fit.model }
      })
      setDone(true)
    } catch (err) {
      setError('Calibrazione non riuscita. Assicurati che il viso sia ben illuminato e riprova.')
    } finally {
      setSaving(false)
    }
  }

  const currentPoint = POINTS[pointIndex]

  // Mostra il puntino con le feature grezze (non calibrate) per feedback visivo durante la calibrazione
  const estimatedGaze = useMemo(() => {
    if (!lastFeatures?.face_detected) return null
    // Se noti inversioni, puoi correggerle qui (es. x = 1 - x)
    return [lastFeatures.feature_x, lastFeatures.feature_y]
  }, [lastFeatures])

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Calibrazione sguardo</h1>
          <p className="text-mist-muted mt-1 max-w-xl">
            Guarda ogni cerchio quando appare e mantieni lo sguardo fisso: il modello impara la geometria dei tuoi occhi.
          </p>
        </div>
      </div>

      <video ref={videoRef} className="hidden" muted playsInline />

      {status === 'error' && (
        <div className="text-sm text-alert bg-alert/10 border border-alert/30 rounded-lg px-4 py-3 max-w-xl mb-4">
          {errorMessage}
        </div>
      )}

      {error && (
        <div className="text-sm text-alert bg-alert/10 border border-alert/30 rounded-lg px-4 py-3 max-w-xl mb-4">
          {error}
        </div>
      )}

      {done ? (
        <div className="rounded-2xl border border-okgreen/30 bg-okgreen/10 p-8 max-w-lg flex flex-col items-center text-center gap-4 shadow-card mx-auto">
          <GazeReticle mode="idle" size={64} locked />
          <h2 className="font-display text-xl font-semibold text-okgreen">Calibrazione completata con successo!</h2>
          <p className="text-mist-muted text-sm">
            Il profilo è stato salvato nel database. Ora puoi avviare qualsiasi esercizio con precisione ottimale.
          </p>
          <button
            onClick={() => navigate('/esercizi')}
            className="bg-iris text-ink font-semibold rounded-xl px-6 py-2.5 hover:brightness-110 transition shadow-lg"
          >
            Vai agli esercizi
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Area Principale di Calibrazione */}
          <div className="lg:col-span-3">
            <div className="relative w-full aspect-video rounded-2xl border border-ink-border bg-ink-panel/60 overflow-hidden shadow-card">
              {/* Cerchietto dello sguardo in tempo reale visibile durante la calibrazione */}
              {status === 'streaming' && estimatedGaze && (
                <GazePointer
                  x={estimatedGaze[0]}
                  y={estimatedGaze[1]}
                  onTarget={collecting}
                  label={collecting ? 'CAMPIONAMENTO' : 'TUO SGUARDO'}
                />
              )}

              {status === 'streaming' && !saving && (
                <button
                  style={{
                    position: 'absolute',
                    left: `${currentPoint[0] * 100}%`,
                    top: `${currentPoint[1] * 100}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onClick={startPointCapture}
                  disabled={collecting}
                  className="z-10 focus:outline-none transition-transform hover:scale-105"
                >
                  <GazeReticle mode="idle" size={56} locked={collecting} />
                  {collecting && (
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-emerald-400 font-mono whitespace-nowrap bg-ink/80 px-1.5 py-0.5 rounded">
                      {pointProgress}/{SAMPLES_PER_POINT}
                    </div>
                  )}
                </button>
              )}

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center bg-ink-panel/90 px-4 py-2 rounded-xl backdrop-blur border border-ink-border shadow-lg">
                {status === 'connecting' && <p className="text-mist-muted text-sm animate-pulse">Attivazione webcam…</p>}
                {status === 'streaming' && !saving && (
                  <p className="text-sm font-medium">
                    Punto <span className="text-iris font-semibold">{pointIndex + 1}</span> di {POINTS.length} —{' '}
                    {collecting ? (
                      <span className="text-emerald-400 font-semibold">Fissa il punto…</span>
                    ) : (
                      <span className="text-mist-muted">clicca sul cerchio per calibrare</span>
                    )}
                  </p>
                )}
                {saving && <p className="text-sm text-iris animate-pulse font-semibold">Calcolo matrice di calibrazione in corso…</p>}
              </div>
            </div>
          </div>

          {/* Pannello Laterale Esterno: Fotocamera & Istruzioni */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {status === 'streaming' && (
              <CameraPreview
                mediaStream={mediaStream}
                lastFeatures={lastFeatures}
                status={status}
                className="w-full"
              />
            )}

            <div className="rounded-2xl border border-ink-border bg-ink-panel/40 p-4 flex flex-col gap-2 text-xs text-mist-muted shadow-card">
              <h3 className="font-semibold text-mist text-sm">Guida alla calibrazione</h3>
              <p>1. Mantieni la testa ferma di fronte allo schermo (distanza ideale 50-65 cm).</p>
              <p>2. Clicca sul bersaglio azzurro e fissalo con gli occhi finché il conteggio arriva a 20.</p>
              <p>3. Il cerchietto arancione mostrerà in tempo reale la stima del tuo sguardo.</p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}