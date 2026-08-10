import { apiClient } from '../apiClient'

export async function achievementsUtente() {
  const { data } = await apiClient.get('/achievements/me')
  return data
}
