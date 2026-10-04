import { computed, ref } from 'vue'
import { useDroneStore } from '../stores/useDroneStore'

export type MapPositionSource = 'drone' | 'manual' | 'none'
export interface MapPosition { latitude: number; longitude: number }

export const MAP_POSITION_CHANGED_EVENT = 'potensic-map-position-changed'

const manualPosition = ref<MapPosition | null>(null)

function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

export function useMapPosition() {
  const store = useDroneStore()
  const dronePosition = computed<MapPosition | null>(() => {
    const latitude = store.telemetry.latitude
    const longitude = store.telemetry.longitude
    return validCoordinates(latitude, longitude) && !(latitude === 0 && longitude === 0) ? { latitude, longitude } : null
  })
  const currentPosition = computed<MapPosition | null>(() => dronePosition.value || manualPosition.value)
  const source = computed<MapPositionSource>(() => dronePosition.value ? 'drone' : manualPosition.value ? 'manual' : 'none')

  function setManualPosition(latitude: number, longitude: number) {
    if (!validCoordinates(latitude, longitude)) throw new Error('Invalid latitude/longitude')
    manualPosition.value = { latitude, longitude }
    window.dispatchEvent(new CustomEvent<MapPosition>(MAP_POSITION_CHANGED_EVENT, { detail: manualPosition.value }))
  }

  return { manualPosition, dronePosition, currentPosition, source, setManualPosition, validCoordinates }
}
