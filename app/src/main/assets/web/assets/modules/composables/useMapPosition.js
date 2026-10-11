import { computed, ref } from '../../vendor/vue.js';
import { useDroneStore } from '../stores/useDroneStore.js';
export const MAP_POSITION_CHANGED_EVENT = 'potensic-map-position-changed';
const manualPosition = ref(null);
function validCoordinates(latitude, longitude) {
    return Number.isFinite(latitude) && Number.isFinite(longitude) &&
        latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
export function useMapPosition() {
    const store = useDroneStore();
    const dronePosition = computed(() => {
        const latitude = store.telemetry.latitude;
        const longitude = store.telemetry.longitude;
        return validCoordinates(latitude, longitude) && !(latitude === 0 && longitude === 0) ? { latitude, longitude } : null;
    });
    const currentPosition = computed(() => dronePosition.value || manualPosition.value);
    const source = computed(() => dronePosition.value ? 'drone' : manualPosition.value ? 'manual' : 'none');
    function setManualPosition(latitude, longitude) {
        if (!validCoordinates(latitude, longitude))
            throw new Error('Invalid latitude/longitude');
        manualPosition.value = { latitude, longitude };
        window.dispatchEvent(new CustomEvent(MAP_POSITION_CHANGED_EVENT, { detail: manualPosition.value }));
    }
    return { manualPosition, dronePosition, currentPosition, source, setManualPosition, validCoordinates };
}
