import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/layout/AppShell.jsx'
import GazeReticle from '../components/GazeReticle.jsx'
import CameraPreview from '../components/CameraPreview.jsx'
import { useEyeTracking } from '../hooks/useEyeTracking.js'
import { dettaglioEsercizio } from '../lib/api/exercises.js'
import { ultimaCalibrazione } from '../lib/api/calibration.js'
import { creaSessione, registraTelemetria } from '../lib/api/sessions.js'

const TARGET_RADIUS_TOLERANCE = 0.09 // frazione della diagonale considerata "on target"
const SACCADI_TRIAL_SEC = 1.6
const DISTANZA_MIN_CM = 32 // soglia postura in cm

function applyCalibration(coef, fx, fy) {
  if (!coef || !Array.isArray(coef) || coef.length < 4) return fx
  const [c0, c1, c2, c3] = coef
  if (isNaN(c0) || isNaN(c1) || isNaN(c2) || isNaN(c3)) return fx
  // Se la calibrazione salvata era degenere o non responsiva, usa direttamente il tracciamento pupillare puro
  if (Math.abs(c1) < 0.15 && Math.abs(c2) < 0.15 && Math.abs(c3) < 0.15) return fx
  const raw = c0 + c1 * fx + c2 * fy + c3 * fx * fy
  return Math.min(0.96, Math.max(0.04, raw))
}

function getTargetPosition(categoria, elapsedSec) {
  if (categoria === 'Saccadi') {
    const trial = Math.floor(elapsedSec / SACCADI_TRIAL_SEC)
    const seedPoints = [
      [0.15, 0.2], [0.85, 0.25], [0.5, 0.5], [0.2, 0.8],
      [0.8, 0.75], [0.5, 0.15], [0.15, 0.6], [0.85, 0.6]
    ]
    return seedPoints[trial % seedPoints.length]
  }
  if (categoria === 'Inseguimento') {
    const t = elapsedSec * 0.6
    const x = 0.5 + 0.36 * Math.sin(t)
    const y = 0.5 + 0.30 * Math.sin(t * 1.3 + 1.2)
    return [x, y]
  }
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
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [summary, setSummary] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  const startTimeRef = useRef(null)
  const statsRef = useRef(null)
  const targetPosRef = useRef([0.5, 0.5])
  const gazePosRef = useRef(null)
  const smoothGazeRef = useRef([0.5, 0.5])
  const onTargetRef = useRef(false)
  const calibrazioneRef = useRef(null)
  const elapsedRef = useRef(0)

  // DOM node direct refs per 60 FPS senza re-render React
  const targetElemRef = useRef(null)
  const gazeElemRef = useRef(null)
  const gazeRingElemRef = useRef(null)
  const gazeLabelElemRef = useRef(null)
  const progressElemRef = useRef(null)
  const targetStatusElemRef = useRef(null)
  const timerElemRef = useRef(null)

  const trackingEnabled = phase === 'running'

  // Callback high-frequency feature handling con smoothing EMA
  const handleFeatures = useCallback((features) => {
    if (!statsRef.current || !features) return
    const stats = statsRef.current

    if (!features.face_detected) {
      gazePosRef.current = null
      if (gazeElemRef.current) {
        gazeElemRef.current.style.display = 'none'
      }
      return
    }

    let gx = features.feature_x
    let gy = features.feature_y
    const calib = calibrazioneRef.current
    if (calib?.parametri_matrice?.coef_x) {
      gx = applyCalibration(calib.parametri_matrice.coef_x, features.feature_x, features.feature_y)
      gy = applyCalibration(calib.parametri_matrice.coef_y, features.feature_x, features.feature_y)
    }

    // Filtro di smoothing EMA per eliminare micro-tremolii della webcam
    const alpha = 0.4
    const smoothX = smoothGazeRef.current[0] * (1 - alpha) + gx * alpha
    const smoothY = smoothGazeRef.current[1] * (1 - alpha) + gy * alpha
    smoothGazeRef.current = [smoothX, smoothY]
    gazePosRef.current = [smoothX, smoothY]

    if (gazeElemRef.current) {
      gazeElemRef.current.style.display = 'block'
      gazeElemRef.current.style.left = `${smoothX * 100}%`
      gazeElemRef.current.style.top = `${smoothY * 100}%`
    }

    const tPos = targetPosRef.current
    const dist = Math.hypot(smoothX - tPos[0], smoothY - tPos[1])
    const isOnTarget = dist <= TARGET_RADIUS_TOLERANCE
    onTargetRef.current = isOnTarget

    if (targetStatusElemRef.current) {
      if (isOnTarget) {
        targetStatusElemRef.current.innerText = 'Sguardo agganciato'
        targetStatusElemRef.current.className = 'text-sm font-medium text-emerald-400'
      } else {
        targetStatusElemRef.current.innerText = 'Segui il bersaglio'
        targetStatusElemRef.current.className = 'text-sm font-medium text-mist-muted'
      }
    }

    if (gazeRingElemRef.current && gazeLabelElemRef.current) {
      if (isOnTarget) {
        gazeRingElemRef.current.className =
          'relative rounded-full border-2 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.9),0_0_30px_rgba(52,211,153,0.5)] flex items-center justify-center'
        gazeLabelElemRef.current.innerText = 'AGGANCIATO'
        gazeLabelElemRef.current.className =
          'absolute -top-5 text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border bg-emerald-950/90 text-emerald-300 border-emerald-500/50 backdrop-blur-md whitespace-nowrap'
      } else {
        gazeRingElemRef.current.className =
          'relative rounded-full border-2 border-amber shadow-[0_0_15px_rgba(244,162,89,0.9),0_0_30px_rgba(244,162,89,0.5)] flex items-center justify-center'
        gazeLabelElemRef.current.innerText = 'TUO SGUARDO'
        gazeLabelElemRef.current.className =
          'absolute -top-5 text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border bg-amber-950/90 text-amber-300 border-amber/50 backdrop-blur-md whitespace-nowrap'
      }
    }

    stats.totalFrames += 1
    if (isOnTarget) {
      stats.onTargetFrames += 1
      stats.trialLocked = true
    }

    if (features.blink && !stats.prevBlink) stats.blinkEvents += 1
    stats.prevBlink = features.blink

    if (features.distanza_cm) {
      stats.distanceSamples.push(features.distanza_cm)
      const tooClose = features.distanza_cm < DISTANZA_MIN_CM
      if (tooClose && !stats.inPostureViolation) {
        stats.postureViolations += 1
        stats.inPostureViolation = true
      } else if (!tooClose) {
        stats.inPostureViolation = false
      }
    }
  }, [])

  const { videoRef, mediaStream, status, lastFeatures, errorMessage } = useEyeTracking({
    enabled: trackingEnabled,
    onFeatures: handleFeatures
  })

  useEffect(() => {
    Promise.all([dettaglioEsercizio(id), ultimaCalibrazione().catch(() => null)])
      .then(([ex, calib]) => {
        setEsercizio(ex)
        setCalibrazione(calib)
        calibrazioneRef.current = calib
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
    elapsedRef.current = 0
    setSecondsRemaining(durataSec)
    setPhase('running')
  }

  // Loop a 60 FPS fluido via requestAnimationFrame per animazioni del bersaglio
  useEffect(() => {
    if (phase !== 'running') return
    let animId
    const categoria = esercizio?.categoria
    let lastSecUpdate = 0

    function tick() {
      const now = performance.now()
      const secs = (now - startTimeRef.current) / 1000
      elapsedRef.current = secs

      // Aggiorna posizione target
      const pos = getTargetPosition(categoria, secs)
      targetPosRef.current = pos

      if (targetElemRef.current) {
        targetElemRef.current.style.left = `${pos[0] * 100}%`
        targetElemRef.current.style.top = `${pos[1] * 100}%`
      }

      // Aggiorna barra progresso
      if (progressElemRef.current) {
        const pct = Math.min(100, (secs / durataSec) * 100)
        progressElemRef.current.style.width = `${pct}%`
      }

      // Aggiorna timer rimanente (1 volta al secondo per non stressare il DOM)
      const currentSecFloor = Math.floor(secs)
      if (currentSecFloor !== lastSecUpdate) {
        lastSecUpdate = currentSecFloor
        const remaining = Math.max(0, Math.round(durataSec - secs))
        setSecondsRemaining(remaining)
        if (timerElemRef.current) {
          timerElemRef.current.innerText = `${remaining}s rimanenti`
        }
      }

      // Saccadi trial tracking
      if (categoria === 'Saccadi') {
        const trial = Math.floor(secs / SACCADI_TRIAL_SEC)
        const stats = statsRef.current
        if (stats && trial !== stats.currentTrial) {
          if (stats.currentTrial >= 0) {
            stats.totalTrials += 1
            if (!stats.trialLocked) stats.missedTrials += 1
          }
          stats.currentTrial = trial
          stats.trialLocked = false
        }
      }

      if (secs >= durataSec) {
        setPhase('post')
        return
      }

      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [phase, durataSec, esercizio?.categoria])

  async function submitSession() {
    setSubmitError(null)
    const stats = statsRef.current
    const elapsed = elapsedRef.current
    const precisione = stats.totalFrames > 0 ? (stats.onTargetFrames / stats.totalFrames) * 100 : 0
    const durataMin = Math.max(elapsed, 1) / 60
    const blinkPerMin = stats.blinkEvents / durataMin
    const distanzaMedia =
      stats.distanceSamples.length > 0
        ? stats.distanceSamples.reduce((a, b) => a + b, 0) / stats.distanceSamples.length
        : null
    const saccadiPerse =
      esercizio.categoria === 'Saccadi'
        ? stats.missedTrials
        : stats.totalFrames > 0
        ? Math.round((1 - stats.onTargetFrames / stats.totalFrames) * 3)
        : 0

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
          Nessun profilo di calibrazione trovato: il tracciamento userà valori approssimati. Ti consigliamo di{' '}
          <button className="underline font-medium" onClick={() => navigate('/calibrazione')}>
            eseguire prima la calibrazione
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
            <span className="data-num text-iris self-end font-semibold">{affaticamentoPre}/10</span>
          </label>
          <button
            onClick={beginExercise}
            className="bg-iris text-ink font-semibold rounded-xl py-3 hover:brightness-110 transition shadow-lg"
          >
            Avvia esercizio con tracciamento live
          </button>
        </div>
      )}

      {phase === 'running' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <video ref={videoRef} className="hidden" muted playsInline />

          {/* Area Principale Esercizio (3 Colonne) */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            {status === 'error' && (
              <div className="text-sm text-alert bg-alert/10 border border-alert/30 rounded-lg px-4 py-3 max-w-xl">
                {errorMessage}
              </div>
            )}

            <div className="flex items-center justify-between px-1">
              <span ref={timerElemRef} className="text-sm text-mist-muted font-medium">
                {secondsRemaining}s rimanenti
              </span>
              <span ref={targetStatusElemRef} className="text-sm font-medium text-mist-muted">
                Segui il bersaglio
              </span>
            </div>

            <div className="relative w-full aspect-video rounded-2xl border border-ink-border bg-ink-panel/50 overflow-hidden shadow-card">
              {/* Target 60 FPS controllato direttamente via Ref */}
              <div
                ref={targetElemRef}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  willChange: 'left, top'
                }}
              >
                <GazeReticle mode="idle" size={48} locked={onTargetRef.current} />
              </div>

              {/* Cerchio dello sguardo in tempo reale ad alta visibilità */}
              <div
                ref={gazeElemRef}
                style={{
                  position: 'absolute',
                  display: 'none',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  zIndex: 25,
                  transition: 'left 0.05s ease-out, top 0.05s ease-out',
                  willChange: 'left, top'
                }}
              >
                <div className="relative flex items-center justify-center">
                  {/* Alone pulsante esterno */}
                  <span
                    className="absolute rounded-full animate-ping opacity-60 bg-amber"
                    style={{ width: 36, height: 36, animationDuration: '1.8s' }}
                  />

                  {/* Anello neon principale */}
                  <div
                    ref={gazeRingElemRef}
                    className="relative rounded-full border-2 border-amber shadow-[0_0_15px_rgba(244,162,89,0.9),0_0_30px_rgba(244,162,89,0.5)] flex items-center justify-center"
                    style={{ width: 28, height: 28 }}
                  >
                    <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_6px_#fff]" />
                    <span className="absolute h-full w-[1px] bg-amber/50" />
                    <span className="absolute w-full h-[1px] bg-amber/50" />
                  </div>

                  {/* Etichetta di identificazione */}
                  <span
                    ref={gazeLabelElemRef}
                    className="absolute -top-5 text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border bg-amber-950/90 text-amber-300 border-amber/50 backdrop-blur-md whitespace-nowrap"
                  >
                    TUO SGUARDO
                  </span>
                </div>
              </div>

              {/* Barra di avanzamento tempo */}
              <div className="absolute top-3 left-3 h-1.5 w-40 bg-ink-border/80 rounded-full overflow-hidden">
                <div
                  ref={progressElemRef}
                  className="h-full bg-iris transition-all"
                  style={{ width: '0%' }}
                />
              </div>
            </div>
          </div>

          {/* Pannello Laterale Esterno: Fotocamera & Info (1 Colonna) */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <CameraPreview
              mediaStream={mediaStream}
              lastFeatures={lastFeatures}
              status={status}
              className="w-full"
            />

            <div className="rounded-2xl border border-ink-border bg-ink-panel/40 p-4 flex flex-col gap-2.5 text-xs text-mist-muted shadow-card">
              <h3 className="font-semibold text-mist text-sm">{esercizio?.nome || 'Esercizio'}</h3>
              <p className="leading-relaxed">{esercizio?.descrizione}</p>
              <div className="border-t border-ink-border/60 pt-2.5 flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span>Categoria:</span>
                  <span className="text-mist font-medium">{esercizio?.categoria}</span>
                </div>
                <div className="flex justify-between">
                  <span>Durata totale:</span>
                  <span className="text-iris font-medium">{esercizio?.durata_secondi}s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'post' && (
        <div className="rounded-2xl border border-ink-border bg-ink-panel/70 shadow-card p-6 max-w-md flex flex-col gap-4">
          {submitError && <div className="text-sm text-alert">{submitError}</div>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-mist-muted">E adesso al termine, come ti senti?</span>
            <input
              type="range"
              min={1}
              max={10}
              value={affaticamentoPost}
              onChange={(e) => setAffaticamentoPost(Number(e.target.value))}
              className="accent-iris"
            />
            <span className="data-num text-iris self-end font-semibold">{affaticamentoPost}/10</span>
          </label>
          <button
            onClick={submitSession}
            className="bg-iris text-ink font-semibold rounded-xl py-3 hover:brightness-110 transition shadow-lg"
          >
            Salva risultati sessione
          </button>
        </div>
      )}

      {phase === 'summary' && summary && (
        <div className="rounded-2xl border border-okgreen/30 bg-okgreen/10 p-8 max-w-lg flex flex-col items-center text-center gap-4 shadow-card">
          <GazeReticle mode="idle" size={64} locked />
          <h2 className="font-display text-xl font-semibold text-okgreen">Sessione completata con successo!</h2>
          <p className="data-num text-4xl font-bold">{summary.precisione.toFixed(1)}%</p>
          <p className="text-mist-muted text-sm">precisione media di fissazione sul bersaglio</p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-iris text-ink font-semibold rounded-xl px-5 py-2.5 hover:brightness-110 transition shadow"
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
