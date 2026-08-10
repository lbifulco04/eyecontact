import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import AppShell from '../components/layout/AppShell.jsx'
import GazeReticle from '../components/GazeReticle.jsx'
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
  const { videoRef, status, lastFeatures, errorMessage } = useEyeTracking({ enabled: true })
  const [pointIndex, setPointIndex] = useState(0)
  const [samples, setSamples] = useState([])
  const [collecting, setCollecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const collectedRef = useRef([])

  useEffect(() => {
    if (!collecting || !lastFeatures?.face_detected) return
    collectedRef.current.push(lastFeatures)
    if (collectedRef.current.length >= SAMPLES_PER_POINT) {
      const avgX = collectedRef.current.reduce((s, f) => s + f.feature_x, 0) / collectedRef.current.length
      const avgY = collectedRef.current.reduce((s, f) => s + f.feature_y, 0) / collectedRef.current.length
      const [tx, ty] = POINTS[pointIndex]
      setSamples((prev) => [...prev, { feature_x: avgX, feature_y: avgY, target_x_norm: tx, target_y_norm: ty }])
      collectedRef.current = []
      setCollecting(false)
      if (pointIndex < POINTS.length - 1) {
        setPointIndex((i) => i + 1)
      } else {
        finalizeCalibration()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFeatures, collecting])

  function startPointCapture() {
    collectedRef.current = []
    setCollecting(true)
  }

  async function finalizeCalibration() {
    setSaving(true)
    setError(null)
    try {
      const allSamples = [...samples]
      const { data: fit } = await axios.post(`${EYE_TRACKING_HTTP_URL}/calibrate/fit`, {
        samples: allSamples
      })
      if (fit.error) throw new Error(fit.error)

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

  return (
    <AppShell>
      <h1 className="font-display text-2xl md:text-3xl font-semibold mb-2">Calibrazione sguardo</h1>
      <p className="text-mist-muted mb-6 max-w-xl">
        Guarda ogni pallino quando appare e resta fermo per un istante: il microservizio di
        eye-tracking Python apprende la relazione tra la posizione della tua iride e lo schermo.
      </p>

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
        <div className="rounded-2xl border border-okgreen/30 bg-okgreen/10 p-8 max-w-lg flex flex-col items-center text-center gap-4">
          <GazeReticle mode="idle" size={64} locked />
          <h2 className="font-display text-xl font-semibold text-okgreen">Calibrazione completata</h2>
          <p className="text-mist-muted text-sm">
            Il profilo è stato salvato. Ora puoi avviare un esercizio con tracciamento live.
          </p>
          <button
            onClick={() => navigate('/esercizi')}
            className="bg-iris text-ink font-semibold rounded-xl px-5 py-2.5 hover:brightness-110 transition"
          >
            Vai agli esercizi
          </button>
        </div>
      ) : (
        <div className="relative w-full max-w-4xl aspect-video rounded-2xl border border-ink-border bg-ink-panel/50 overflow-hidden">
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
              className="z-10"
            >
              <GazeReticle mode="idle" size={56} locked={collecting} />
            </button>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
            {status === 'connecting' && <p className="text-mist-muted text-sm">Attivazione webcam…</p>}
            {status === 'streaming' && !saving && (
              <p className="text-sm text-mist-muted">
                Punto {pointIndex + 1} di {POINTS.length} — clicca sul reticolo e fissalo
              </p>
            )}
            {saving && <p className="text-sm text-iris">Calcolo calibrazione…</p>}
          </div>
        </div>
      )}
    </AppShell>
  )
}
