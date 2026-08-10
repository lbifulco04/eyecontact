import { apiClient } from '../apiClient'

export async function salvaCalibrazione(payload) {
  const { data } = await apiClient.post('/calibration/', payload)
  return data
}

export async function ultimaCalibrazione() {
  const { data } = await apiClient.get('/calibration/me')
  return data
}
