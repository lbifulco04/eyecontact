import { apiClient } from '../apiClient'

export async function login(email, password) {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  const { data } = await apiClient.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  return data
}

export async function register({ email, password, nome_display }) {
  const { data } = await apiClient.post('/auth/register', {
    email,
    password,
    nome_display
  })
  return data
}

export async function getCurrentUser() {
  const { data } = await apiClient.get('/auth/me')
  return data
}
