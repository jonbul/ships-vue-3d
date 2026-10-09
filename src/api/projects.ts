import type { Layer, Project } from '@/shared/shipModel'
import { request } from './http'

export function listProjects(): Promise<Project[]> {
  return request<Project[]>('/projects')
}

export function getProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${encodeURIComponent(id)}`)
}

/** Creates the project if it has no id yet, otherwise overwrites it. */
export async function saveProject(project: Project): Promise<Project> {
  const body = { name: project.name, layers: project.layers }
  const data = project._id
    ? await request<{ project: Project }>(`/projects/${encodeURIComponent(project._id)}`, {
        method: 'PUT',
        body,
      })
    : await request<{ project: Project }>('/projects', { method: 'POST', body })
  return data.project
}

export async function deleteProject(id: string): Promise<void> {
  await request(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export interface ShipInfo {
  id: string
  name: string
  layers: Layer[]
}

/** Ships a player can fly: built-in ones, plus their own when logged in. */
export function listGameShips(): Promise<{ defaults: ShipInfo[]; own: ShipInfo[] }> {
  return request('/game/ships')
}
