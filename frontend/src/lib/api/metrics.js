import { apiClient } from '../apiClient'

export async function dashboardMetriche() {
  const { data } = await apiClient.get('/metrics/dashboard')
  return data
}
