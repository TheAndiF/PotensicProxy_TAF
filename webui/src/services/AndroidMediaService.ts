import { useDroneStore } from '../stores/useDroneStore'

export type AndroidMediaLibrary = 'camera' | 'recognition'
export type RecognitionSource = 'LIVE_RECO' | 'DRONE_RECO'

export type RecognitionMetadata = {
  schemaVersion: number
  source: RecognitionSource
  capture: {
    timestampUnixMs: number
    timestampIso: string
  }
  telemetry: Record<string, unknown>
  camera: Record<string, unknown>
  controls: Record<string, unknown>
  connection: Record<string, unknown>
  app: {
    version: string
    metadataSchema: number
  }
  recognition: {
    processed: boolean
    runs: unknown[]
  }
}

export type AndroidStoredImage = {
  id: string
  name: string
  mimeType: string
  size: number
  source: string
  library: AndroidMediaLibrary
  createdAt: number
  captureTime?: number
  uri: string
  relativePath: string
  sha256?: string
  verified?: boolean
  image?: { width?: number | null; height?: number | null; format?: string; byteSize?: number; sha256?: string }
  metadata?: RecognitionMetadata | Record<string, unknown>
}

export class AndroidMediaService {
  private static baseUrl(): string {
    const host = useDroneStore().normalizedHost
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
    return `${protocol}//${host}`
  }

  static async saveLiveSnapshot(metadata?: RecognitionMetadata | Record<string, unknown>): Promise<AndroidStoredImage> {
    const response = await fetch(`${this.baseUrl()}/api/media/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: metadata ? JSON.stringify(metadata) : '{}'
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
    const saved = body as AndroidStoredImage
    window.dispatchEvent(new CustomEvent('taf-android-media-saved', { detail: saved }))
    return saved
  }


  static async savePrecisionSnapshot(
    metadata: Record<string, unknown>,
    fileName: string,
    source: 'pstart-documentation' | 'pstart-reference',
    sessionId: string
  ): Promise<AndroidStoredImage> {
    const params = new URLSearchParams({ library: 'recognition', source, name: fileName, session: sessionId })
    const response = await fetch(`${this.baseUrl()}/api/media/snapshot?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
    const saved = body as AndroidStoredImage
    window.dispatchEvent(new CustomEvent('taf-android-media-saved', { detail: saved }))
    return saved
  }



  static async finalizePrecisionSession(payload: {
    sessionId: string
    masterImageId: string
    masterImageName: string
    fileName: string
    protocol: string
    summary: Record<string, unknown>
  }): Promise<{
    success: boolean
    protocol: { name: string; relativePath: string; uri: string; size: number; sha256: string; verified: boolean; saved?: boolean; error?: string }
    masterImage?: { id: string; name: string; size: number; sha256: string; verified: boolean; protocolEmbedded: boolean; protocolChunks: number }
  }> {
    const response = await fetch(`${this.baseUrl()}/api/pstart/session/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
    return body
  }

  static async saveCockpitSnapshot(): Promise<AndroidStoredImage> {
    const response = await fetch(`${this.baseUrl()}/api/media/snapshot?library=camera&source=cockpit-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
    const saved = body as AndroidStoredImage
    window.dispatchEvent(new CustomEvent('taf-android-media-saved', { detail: saved }))
    return saved
  }

  static async saveImageBytes(
    blob: Blob,
    fileName: string,
    source = 'camera-download',
    library: AndroidMediaLibrary = 'camera',
    metadata?: RecognitionMetadata
  ): Promise<AndroidStoredImage> {
    const params = new URLSearchParams({ name: fileName, source, library })
    if (metadata) params.set('metadata', JSON.stringify(metadata))
    const response = await fetch(`${this.baseUrl()}/api/media/import?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
    const saved = body as AndroidStoredImage
    window.dispatchEvent(new CustomEvent('taf-android-media-saved', { detail: saved }))
    return saved
  }

  static async listImages(library?: AndroidMediaLibrary): Promise<AndroidStoredImage[]> {
    const params = library ? `?library=${encodeURIComponent(library)}` : ''
    const response = await fetch(`${this.baseUrl()}/api/media/local${params}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json() as AndroidStoredImage[]
  }

  static imageUrl(id: string): string {
    return `${this.baseUrl()}/api/media/local/${encodeURIComponent(id)}`
  }
}
