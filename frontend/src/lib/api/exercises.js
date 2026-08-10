import { apiClient } from '../apiClient'

export async function listaEsercizi() {
  const { data } = await apiClient.get('/exercises/')
  return data
}

export async function eserciziRaccomandati(affaticamento_pre = 5) {
  const { data } = await apiClient.get('/exercises/recommended', {
    params: { affaticamento_pre }
  })
  return data
}

export async function dettaglioEsercizio(id) {
  const { data } = await apiClient.get(`/exercises/${id}`)
  return data
}
