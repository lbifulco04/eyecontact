import React from 'react'
import { motion } from 'framer-motion'

/**
 * Reticolo dello sguardo — elemento firma di EyeContact.
 * In modalità "idle" è un indicatore decorativo/di caricamento.
 * In modalità "live" segue le coordinate di sguardo reali (x, y in px, relative al contenitore)
 * calcolate dal microservizio di eye-tracking, fungendo da mirino/crosshair.
 */
export default function GazeReticle({ mode = 'idle', x = null, y = null, size = 64, locked = false }) {
  const style =
    mode === 'live' && x !== null && y !== null
      ? { position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)' }
      : {}

  return (
    <div style={style} className={mode === 'live' ? 'pointer-events-none z-20' : 'relative'}>
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span
          className="absolute inset-0 rounded-full border animate-pulseRing"
          style={{ borderColor: locked ? '#6EE7B7' : '#4CC9F0' }}
        />
        <span
          className="absolute rounded-full border animate-spinSlow"
          style={{
            inset: size * 0.14,
            borderColor: locked ? 'rgba(110,231,183,0.5)' : 'rgba(76,201,240,0.5)',
            borderStyle: 'dashed'
          }}
        />
        <motion.span
          className="rounded-full"
          animate={{ scale: locked ? [1, 1.15, 1] : 1 }}
          transition={{ duration: 0.6, repeat: locked ? Infinity : 0 }}
          style={{
            width: size * 0.16,
            height: size * 0.16,
            backgroundColor: locked ? '#6EE7B7' : '#4CC9F0',
            boxShadow: `0 0 12px ${locked ? '#6EE7B7' : '#4CC9F0'}`
          }}
        />
      </div>
    </div>
  )
}
