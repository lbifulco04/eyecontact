import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { extractErrorMessage } from '../lib/apiClient.js'
import GazeReticle from '../components/GazeReticle.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(extractErrorMessage(err, 'Email o password non corrette.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <GazeReticle mode="idle" size={64} />
          <h1 className="font-display text-2xl font-semibold mt-4">
            Eye<span className="text-iris">Contact</span>
          </h1>
          <p className="text-mist-muted text-sm mt-1">Allenamento visivo guidato dallo sguardo</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-ink-border bg-ink-panel/70 shadow-card p-6 flex flex-col gap-4"
        >
          {error && (
            <div className="text-sm text-alert bg-alert/10 border border-alert/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-mist-muted">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-ink-panel2 border border-ink-border rounded-xl px-3 py-2.5 focus:border-iris outline-none transition-colors"
              placeholder="tuamail@esempio.it"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-mist-muted">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-ink-panel2 border border-ink-border rounded-xl px-3 py-2.5 focus:border-iris outline-none transition-colors"
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-iris text-ink font-semibold rounded-xl py-2.5 hover:brightness-110 transition disabled:opacity-60"
          >
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>

        <p className="text-center text-sm text-mist-muted mt-5">
          Non hai un account?{' '}
          <Link to="/register" className="text-iris hover:underline">
            Registrati
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
