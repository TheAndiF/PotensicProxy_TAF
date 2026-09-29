import type { MissionSummary, TAFMission } from '../types/mission'
import { useDroneStore } from '../stores/useDroneStore'

function baseUrl() {
  const store = useDroneStore()
  const proto = window.location.protocol === 'https:' ? 'https:' : 'http:'
  return `${proto}//${store.normalizedHost}`
}
async function err(r: Response) { try { return (await r.json()).error || `HTTP ${r.status}` } catch { return `HTTP ${r.status}` } }

export const MissionService = {
  async list(): Promise<MissionSummary[]> {
    const r = await fetch(`${baseUrl()}/api/missions`); if (!r.ok) throw new Error(await err(r)); return r.json()
  },
  async load(id: string): Promise<TAFMission> {
    const r = await fetch(`${baseUrl()}/api/missions/${encodeURIComponent(id)}`); if (!r.ok) throw new Error(await err(r)); return r.json()
  },
  async save(mission: TAFMission): Promise<TAFMission> {
    mission.updatedAt = new Date().toISOString()
    const r = await fetch(`${baseUrl()}/api/missions/${encodeURIComponent(mission.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mission) })
    if (!r.ok) throw new Error(await err(r)); return r.json()
  },
  async remove(id: string) {
    const r = await fetch(`${baseUrl()}/api/missions/${encodeURIComponent(id)}`, { method: 'DELETE' }); if (!r.ok && r.status !== 204) throw new Error(await err(r))
  },
  exportPotensicUrl(id: string) { return `${baseUrl()}/api/missions/${encodeURIComponent(id)}/export/potensic` }
}
