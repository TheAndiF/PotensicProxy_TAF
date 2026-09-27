export type MapProvider = 'osm' | 'mapbox-satellite' | 'mapbox-style' | 'custom'
export type MapboxTokenType = 'public' | 'secret' | 'temporary' | 'none' | 'unknown'

export interface MapConfig {
  provider: MapProvider
  style: string
  tileUrlTemplate: string
  accessToken: string
  hasAccessToken?: boolean
  tokenType?: MapboxTokenType
  mapboxStyle: string
  attribution: string
  defaultZoom: number
  autoCenter: boolean
  orientation: 'north' | 'heading'
  dataMode: 'auto' | 'offline' | 'online'
}

export interface MapConnectionTest {
  ok: boolean
  provider: MapProvider
  tokenType: MapboxTokenType
  httpStatus: number
  resource: string
  contentType: string
  message: string
}

export interface OfflineRegion {
  id: string
  latitude: number
  longitude: number
  radiusM: number
  minZoom: number
  maxZoom: number
  status: string
  downloaded: number
  total: number
  errors?: number
  downloadedAt?: number | null
  provider?: string
  resource?: string
}

export interface VersionInfo {
  projectVersion: string
  appVersion: string
  backendVersion: string
  webUiVersion: string
  mapModuleVersion: string
  mapApiVersion: number
  buildDate: string
}
