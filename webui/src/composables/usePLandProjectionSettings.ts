import { reactive, watch } from 'vue'

export type ProjectionMode = 'original' | 'ideal' | 'measured' | 'compare' | 'difference'
export type ProjectionBasis = 'image' | 'telemetry' | 'combined'
export interface PPortEntry { id: string; available: boolean; status: string; sourceImage?: string; metricValidated?: boolean; zoomGroups?: string[] }
const key = 'taf.pland.projection.settings.v1'
const defaults = { mode: 'measured' as ProjectionMode, basis: 'image' as ProjectionBasis,
  opacity: 0.4, lineWidth: 2, contourColor: '#4fe3c1', cornerColor: '#ffffff', diagnostics: true,
  modelSelection: 'auto', manualId: '' }
function restore(): typeof defaults {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '{}')
    return { ...defaults,
      mode: ['original','ideal','measured','compare','difference'].includes(raw.mode) ? raw.mode : defaults.mode,
      basis: ['image','telemetry','combined'].includes(raw.basis) ? raw.basis : defaults.basis,
      opacity: typeof raw.opacity === 'number' && raw.opacity >= 0 && raw.opacity <= 1 ? raw.opacity : defaults.opacity,
      lineWidth: typeof raw.lineWidth === 'number' && raw.lineWidth >= 1 && raw.lineWidth <= 8 ? raw.lineWidth : defaults.lineWidth,
      contourColor: /^#[0-9a-fA-F]{6}$/.test(raw.contourColor) ? raw.contourColor : defaults.contourColor,
      cornerColor: /^#[0-9a-fA-F]{6}$/.test(raw.cornerColor) ? raw.cornerColor : defaults.cornerColor,
      diagnostics: typeof raw.diagnostics === 'boolean' ? raw.diagnostics : defaults.diagnostics,
      modelSelection: raw.modelSelection === 'manual' ? 'manual' : 'auto',
      manualId: typeof raw.manualId === 'string' ? raw.manualId : '' }
  } catch { return { ...defaults } }
}
export const plandProjectionSettings = reactive(restore())
watch(plandProjectionSettings, value => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ } }, { deep: true })
export function usePLandProjectionSettings() { return plandProjectionSettings }
export async function listPPortModels(): Promise<PPortEntry[]> {
  const response = await fetch('/api/pport/models', { cache: 'no-store' })
  if (!response.ok) throw new Error(`PPort HTTP ${response.status}`)
  const data = await response.json() as { models?: PPortEntry[] }
  return Array.isArray(data.models) ? data.models : []
}
export function selectedModelId(entries: PPortEntry[], settings = plandProjectionSettings): string | null {
  if (settings.modelSelection === 'manual') return entries.some(m => m.id === settings.manualId && m.available) ? settings.manualId : null
  // The authoritative ordering is provided by the SAF listing. Do not promote incomplete models.
  return entries.find(m => m.available)?.id ?? null
}
