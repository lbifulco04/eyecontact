import { apiClient } from '../apiClient'

export async function creaSessione(payload) {
  const { data } = await apiClient.post('/sessions/', payload)
  return data
}

export async function mieSessioni() {
  const { data } = await apiClient.get('/sessions/me')
  return data
}

export async function dettaglioSessione(id) {
  const { data } = await apiClient.get(`/sessions/${id}`)
  return data
}

export async function aggiungiEsercizioASessione(idSessione, payload) {
  const { data } = await apiClient.post(`/sessions/${idSessione}/esercizi`, payload)
  return data
}

export async function registraTelemetria(idSessione, payload) {
  const { data } = await apiClient.post(`/sessions/${idSessione}/telemetry`, payload)
  return data
}

export async function leggiTelemetria(idSessione) {
  const { data } = await apiClient.get(`/sessions/${idSessione}/telemetry`)
  return data
}
