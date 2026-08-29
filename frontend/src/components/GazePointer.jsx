import React from 'react'

/**
 * Cerchietto luminoso in tempo reale che indica la posizione stimata dello sguardo dell'utente.
 * Colore ambra brillante (o verde smeraldo quando agganciato sul bersaglio).
 * La transizione è molto breve per evitare ritardi, ma non assente per ridurre jitter.
 */
export default function GazePointer({
  x = null,
  y = null,
  onTarget = false,
  label = 'Sguardo',
  className = ''
}) {
  if (x === null || y === null) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 25,
        transition: 'left 0.04s linear, top 0.04s linear',
        willChange: 'left, top'
      }}
      className={className}
    >
      <div className="relative flex items-center justify-center">
        {/* Alone pulsante esterno */}
        <span
          className={`absolute rounded-full animate-ping opacity-60 ${
            onTarget ? 'bg-emerald-400' : 'bg-amber'
          }`}
          style={{ width: 36, height: 36, animationDuration: '1.8s' }}
        />

        {/* Anello neon principale */}
        <div
          className={`relative rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${
            onTarget
              ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.9),0_0_30px_rgba(52,211,153,0.5)]'
              : 'border-amber shadow-[0_0_15px_rgba(244,162,89,0.9),0_0_30px_rgba(244,162,89,0.5)]'
          }`}
          style={{ width: 28, height: 28 }}
        >
          {/* Mirino centrale */}
          <span
            className={`w-2 h-2 rounded-full ${
              onTarget ? 'bg-emerald-300' : 'bg-white shadow-[0_0_6px_#fff]'
            }`}
          />
          {/* Ticks mirino */}
          <span
            className={`absolute h-full w-[1px] ${
              onTarget ? 'bg-emerald-400/50' : 'bg-amber/50'
            }`}
          />
          <span
            className={`absolute w-full h-[1px] ${
              onTarget ? 'bg-emerald-400/50' : 'bg-amber/50'
            }`}
          />
        </div>

        {/* Mini etichetta di identificazione */}
        <span
          className={`absolute -top-5 text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border backdrop-blur-md whitespace-nowrap transition-colors ${
            onTarget
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
              : 'bg-amber-950/90 text-amber-300 border-amber/50'
          }`}
        >
          {onTarget ? 'AGGANCIATO' : label}
        </span>
      </div>
    </div>
  )
}