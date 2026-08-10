import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { login as apiLogin, register as apiRegister, getCurrentUser } from '../lib/api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('eyecontact_token')
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await getCurrentUser()
      setUser(me)
    } catch {
      localStorage.removeItem('eyecontact_token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  async function login(email, password) {
    const { access_token } = await apiLogin(email, password)
    localStorage.setItem('eyecontact_token', access_token)
    await loadUser()
  }

  async function register(fields) {
    const { access_token } = await apiRegister(fields)
    localStorage.setItem('eyecontact_token', access_token)
    await loadUser()
  }

  function logout() {
    localStorage.removeItem('eyecontact_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh: loadUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
