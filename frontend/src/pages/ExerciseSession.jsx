import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/layout/AppShell.jsx'
import GazeReticle from '../components/GazeReticle.jsx'
import { useEyeTracking } from '../hooks/useEyeTracking.js'
import { dettaglioEsercizio } from '../lib/api/exercises.js'
import { ultimaCalibrazione } from '../lib/api/calibration.js'
import { creaSessione, registraTelemetria } from '../lib/api/sessions.js'

const TARGET_RADIUS_TOLERANCE = 0.09 // frazione della diagonale schermo considerata "on target"
const SACCADI_TRIAL_SEC = 1.6
const DISTANZA_MIN_CM = 32 // sotto questa soglia scatta un avviso di postura

function applyCalibration(coef, fx, fy) {
  const [c0, c1, c2, c3] = coef
  const raw = c0 + c1 * fx + c2 * fy + c3 * fx * fy
  return Math.min(1, Math.max(0, raw))
}

function getTargetPosition(categoria, elapsedSec) {
  if (categoria === 'Saccadi') {
    // Sequenza pseudo-casuale ma deterministica di punti nella griglia
    const trial = Math.floor(elapsedSec / SACCADI_TRIAL_SEC)
    const seedPoints = [
      [0.15, 0.2], [0.85, 0.25], [0.5, 0.5], [0.2, 0.8],
      [0.8, 0.75], [0.5, 0.15], [0.15, 0.6], [0.85, 0.6]
    ]
    return seedPoints[trial % seedPoints.length]
  }
  if (categoria === 'Inseguimento') {
    // Percorso fluido (Lissajous) per l'inseguimento lento/dinamico
    const t = elapsedSec * 0.6
    const x = 0.5 + 0.36 * Math.sin(t)
    const y = 0.5 + 0.30 * Math.sin(t * 1.3 + 1.2)
    return [x, y]
  }
  // Fissazione: punto fermo al centro
  return [0.5, 0.5]
}

export default function ExerciseSession() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [esercizio, setEsercizio] = useState(null)
  const [calibrazione, setCalibrazione] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | setup | running | post | summary | error
  const [affaticamentoPre, setAffaticamentoPre] = useState(5)
  const [affaticamentoPost, setAffaticamentoPost] = useState(5)
  const [elapsed, setElapsed] = useState(0)
  const [targetPos, setTargetPos] = useState([0.5, 0.5])
  const [gazePos, setGazePos] = useState(null)
  const [onTarget, setOnTarget] = useState(false)
  const [summary, setSummary] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  const trackingEnabled = phase === 'running'
  const { videoRef, status, lastFeatures, errorMessage } = useEyeTracking({ enabled: trackingEnabled })

  const startTimeRef = useRef(null)
  const statsRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    Promise.all([dettaglioEsercizio(id), ultimaCalibrazione().catch(() => null)])
      .then(([ex, calib]) => {
        setEsercizio(ex)
        setCalibrazione(calib)
        setPhase('setup')
      })
      .catch(() => setPhase('error'))
  }, [id])

  const durataSec = esercizio?.durata_consigliata_sec || 60

  function beginExercise() {
    statsRef.current = {
      onTargetFrames: 0,
      totalFrames: 0,
      blinkEvents: 0,
      prevBlink: false,
      postureViolations: 0,
      inPostureViolation: false,
      currentTrial: -1,
      trialLocked: false,
      totalTrials: 0,
      missedTrials: 0,
      distanceSamples: []
    }
    startTimeRef.current = performance.now()
    setElapsed(0)
    setPhase('running')
  }

  // Loop di rendering del target, indipendente dall'arrivo dei frame
  useEffect(() => {
    if (phase !== 'running') return
    const categoria = esercizio?.categoria
    const raf = setInterval(() => {
      const now = performance.now()
      const secs = (now - startTimeRef.current) / 1000
      setElapsed(secs)
      const pos = getTargetPosition(categoria, secs)
      setTargetPos(pos)

      if (categoria === 'Saccadi') {
        const trial = Math.floor(secs / SACCADI_TRIAL_SEC)
        const stats = statsRef.current
        if (trial !== stats.currentTrial) {
          if (stats.currentTrial >= 0) {
            stats.totalTrials += 1
            if (!stats.trialLocked) stats.missedTrials += 1
          }
          stats.currentTrial = trial
          stats.trialLocked = false
        }
      }

      if (secs >= durataSec) {
        clearInterval(raf)
        finishExercise()
      }
    }, 100)
    return () => clearInterval(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Scoring ad ogni feature ricevuta dal microservizio di eye-tracking
  useEffect(() => {
    if (phase !== 'running' || !lastFeatures || !statsRef.current) return
    const stats = statsRef.current

    if (!lastFeatures.face_detected) {
      setGazePos(null)
      return
    }

    let gx = lastFeatures.feature_x
    let gy = lastFeatures.feature_y
    if (calibrazione?.parametri_matrice?.coef_x) {
      gx = applyCalibration(calibrazione.parametri_matrice.coef_x, lastFeatures.feature_x, lastFeatures.feature_y)
      gy = applyCalibration(calibrazione.parametri_matrice.coef_y, lastFeatures.feature_x, lastFeatures.feature_y)
    }
    setGazePos([gx, gy])

    const dist = Math.hypot(gx - targetPos[0], gy - targetPos[1])
    const isOnTarget = dist <= TARGET_RADIUS_TOLERANCE
    setOnTarget(isOnTarget)

    stats.totalFrames += 1
    if (isOnTarget) {
      stats.onTargetFrames += 1
      stats.trialLocked = true
    }

    // Blink counting (fronte di salita)
    if (lastFeatures.blink && !stats.prevBlink) stats.blinkEvents += 1
    stats.prevBlink = lastFeatures.blink

    // Postura / distanza dallo schermo
    if (lastFeatures.distanza_cm) {
      stats.distanceSamples.push(lastFeatures.distanza_cm)
      const tooClose = lastFeatures.distanza_cm < DISTANZA_MIN_CM
      if (tooClose && !stats.inPostureViolation) {
        stats.postureViolations += 1
        stats.inPostureViolation = true
      } else if (!tooClose) {
        stats.inPostureViolation = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFeatures])

  function finishExercise() {
    setPhase('post')
  }

  async function submitSession() {
    setSubmitError(null)
    const stats = statsRef.current
    const precisione = stats.totalFrames > 0 ? (stats.onTargetFrames / stats.totalFrames) * 100 : 0
    const durataMin = Math.max(elapsed, 1) / 60
    const blinkPerMin = stats.blinkEvents / durataMin
    const distanzaMedia =
      stats.distanceSamples.length > 0
        ? stats.distanceSamples.reduce((a, b) => a + b, 0) / stats.distanceSamples.length
        : null
    const saccadiPerse = esercizio.categoria === 'Saccadi' ? stats.missedTrials : stats.totalFrames > 0 ? Math.round((1 - stats.onTargetFrames / stats.totalFrames) * 3) : 0

    try {
      const sessione = await creaSessione({
        durata_totale_sec: Math.round(elapsed),
        affaticamento_pre: affaticamentoPre,
        affaticamento_post: affaticamentoPost,
        note: `Esercizio: ${esercizio.nome}`,
        dettagli_esercizi: [
          {
            id_esercizio: esercizio.id_esercizio,
            tempo_target_sec: durataSec,
            tempo_effettivo_sec: Math.round(elapsed),
            completato: elapsed >= durataSec - 1
          }
        ]
      })

      await registraTelemetria(sessione.id_sessione, {
        precisione_fissazione_pct: Math.round(precisione * 10) / 10,
        frequenza_lampeggio_pm: Math.round(blinkPerMin * 10) / 10,
        distanza_schermo_cm_media: distanzaMedia ? Math.round(distanzaMedia * 10) / 10 : null,
        saccadi_perse_count: saccadiPerse,
        avvisi_postura_count: stats.postureViolations
      })

      setSummary({ precisione, sessione })
      setPhase('summary')
    } catch (err) {
      setSubmitError('Impossibile salvare la sessione. Riprova.')
    }
  }

  if (phase === 'loading') {
    return (
      <AppShell>
        <div className="text-mist-muted">Caricamento esercizio…</div>
      </AppShell>
    )
  }

  if (phase === 'error') {
    return (
      <AppShell>
        <div className="text-alert">Esercizio non trovato.</div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="font-display text-2xl md:text-3xl font-semibold mb-1">{esercizio.nome}</h1>
      <p className="text-mist-muted mb-6">{esercizio.descrizione}</p>

      {!calibrazione && phase === 'setup' && (
        <div className="text-sm text-amber bg-amber/10 border border-amber/30 rounded-lg px-4 py-3 max-w-xl mb-6">
          Nessun profilo di calibrazione trovato: il reticolo di sguardo userà valori non calibrati,
          meno precisi. Ti consigliamo di{' '}
          <button className="underline" onClick={() => navigate('/calibrazione')}>
            calibrare prima
          </button>
          .
        </div>
      )}

      {phase === 'setup' && (
        <div className="rounded-2xl border border-ink-border bg-ink-panel/70 shadow-card p-6 max-w-md flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-mist-muted">Quanto ti senti affaticato ora? (1 = riposato, 10 = molto affaticato)</span>
            <input
              type="range"
              min={1}
              max={10}
              value={affaticamentoPre}
              onChange={(e) => setAffaticamentoPre(Number(e.target.value))}
              className="accent-iris"
            />
            <span className="data-num text-iris self-end">{affaticamentoPre}/10</span>
          </label>
          <button
            onClick={beginExercise}
            className="bg-iris text-ink font-semibold rounded-xl py-2.5 hover:brightness-110 transition"
          >
            Avvia con tracciamento live
          </button>
        </div>
      )}

      {phase === 'running' && (
        <div>
          <video ref={videoRef} className="hidden" muted playsInline />
          {status === 'error' && (
            <div className="text-sm text-alert bg-alert/10 border border-alert/30 rounded-lg px-4 py-3 max-w-xl mb-4">
              {errorMessage}
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-mist-muted">
              {Math.max(0, Math.round(durataSec - elapsed))}s rimanenti
            </span>
            <span className={`text-sm font-medium ${onTarget ? 'text-okgreen' : 'text-mist-muted'}`}>
              {onTarget ? 'Sguardo agganciato' : 'Segui il bersaglio'}
            </span>
          </div>
          <div
            ref={containerRef}
            className="relative w-full aspect-video rounded-2xl border border-ink-border bg-ink-panel/50 overflow-hidden"
          >
            <div
              style={{
                position: 'absolute',
                left: `${targetPos[0] * 100}%`,
                top: `${targetPos[1] * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <GazeReticle mode="idle" size={48} locked={onTarget} />
            </div>
            {gazePos && (
              <div
                style={{
                  position: 'absolute',
                  left: `${gazePos[0] * 100}%`,
                  top: `${gazePos[1] * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 10,
                  height: 10,
                  borderRadius: '999px',
                  background: '#F4A259',
                  boxShadow: '0 0 8px #F4A259'
                }}
              />
            )}
            <div className="absolute top-3 left-3 h-1.5 w-40 bg-ink-border rounded-full overflow-hidden">
              <div
                className="h-full bg-iris"
                style={{ width: `${Math.min(100, (elapsed / durataSec) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {phase === 'post' && (
        <div className="rounded-2xl border border-ink-border bg-ink-panel/70 shadow-card p-6 max-w-md flex flex-col gap-4">
          {submitError && <div className="text-sm text-alert">{submitError}</div>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-mist-muted">E adesso, come ti senti?</span>
            <input
              type="range"
              min={1}
              max={10}
              value={affaticamentoPost}
              onChange={(e) => setAffaticamentoPost(Number(e.target.value))}
              className="accent-iris"
            />
            <span className="data-num text-iris self-end">{affaticamentoPost}/10</span>
          </label>
          <button
            onClick={submitSession}
            className="bg-iris text-ink font-semibold rounded-xl py-2.5 hover:brightness-110 transition"
          >
            Salva sessione
          </button>
        </div>
      )}

      {phase === 'summary' && summary && (
        <div className="rounded-2xl border border-okgreen/30 bg-okgreen/10 p-8 max-w-lg flex flex-col items-center text-center gap-4">
          <GazeReticle mode="idle" size={64} locked />
          <h2 className="font-display text-xl font-semibold text-okgreen">Sessione completata</h2>
          <p className="data-num text-3xl">{summary.precisione.toFixed(1)}%</p>
          <p className="text-mist-muted text-sm">precisione media di fissazione sul bersaglio</p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-iris text-ink font-semibold rounded-xl px-5 py-2.5 hover:brightness-110 transition"
            >
              Torna alla dashboard
            </button>
            <button
              onClick={() => navigate('/esercizi')}
              className="border border-ink-border rounded-xl px-5 py-2.5 hover:bg-white/5 transition"
            >
              Altro esercizio
            </button>
          </div>
        </div>
      )}
    </AppShell>
  )
}
