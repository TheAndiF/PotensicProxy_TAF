import type { MapConfig, MapConnectionTest, OfflineRegion, VersionInfo } from '../types/map'
import { useDroneStore } from '../stores/useDroneStore'

function baseUrl() {
  const store = useDroneStore()
  const proto = window.location.protocol === 'https:' ? 'https:' : 'http:'
  return `${proto}//${store.normalizedHost}`
}

async function errorText(r: Response): Promise<string> {
  try {
    const body = await r.json()
    return body?.error || `HTTP ${r.status}`
  } catch {
    return `HTTP ${r.status}`
  }
}

export const MapService = {
  async getVersion(): Promise<VersionInfo> {
    const r = await fetch(`${baseUrl()}/api/version`)
    if (!r.ok) throw new Error(await errorText(r))
    return r.json()
  },
  async getConfig(): Promise<MapConfig> {
    const r = await fetch(`${baseUrl()}/api/map/config`)
    if (!r.ok) throw new Error(await errorText(r))
    return r.json()
  },
  async saveConfig(config: Partial<MapConfig>): Promise<MapConfig> {
    const r = await fetch(`${baseUrl()}/api/map/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    if (!r.ok) throw new Error(await errorText(r))
    return r.json()
  },
  async testConfig(config: Partial<MapConfig>): Promise<MapConnectionTest> {
    const r = await fetch(`${baseUrl()}/api/map/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    if (!r.ok) throw new Error(await errorText(r))
    return r.json()
  },
  tileUrl(z: number, x: number, y: number) {
    return `${baseUrl()}/api/map/tiles/${z}/${x}/${y}`
  },
  async regions(): Promise<OfflineRegion[]> {
    const r = await fetch(`${baseUrl()}/api/map/regions`)
    if (!r.ok) throw new Error(await errorText(r))
    return r.json()
  },
  async downloadRegion(region: Partial<OfflineRegion>): Promise<OfflineRegion> {
    const r = await fetch(`${baseUrl()}/api/map/regions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(region)
    })
    if (!r.ok) throw new Error(await errorText(r))
    return r.json()
  },
  async region(id: string): Promise<OfflineRegion> {
    const r = await fetch(`${baseUrl()}/api/map/regions/${encodeURIComponent(id)}`)
    if (!r.ok) throw new Error(await errorText(r))
    return r.json()
  },
  async deleteRegion(id: string): Promise<void> {
    const r = await fetch(`${baseUrl()}/api/map/regions/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!r.ok && r.status !== 204) throw new Error(await errorText(r))
  }
}
