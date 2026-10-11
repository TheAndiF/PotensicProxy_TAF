import { ref, watch } from '../../vendor/vue.js';
const END_HEIGHT_KEY = 'potensic-pstart-end-height';
const HEIGHT_STEP_KEY = 'potensic-pstart-height-step';
const STABILIZATION_KEY = 'potensic-pstart-stabilization-seconds';
const POSITION_WARNING_KEY = 'potensic-pstart-position-warning-meters';
const POSITION_ABORT_KEY = 'potensic-pstart-position-abort-meters';
const endHeight = ref(Number(localStorage.getItem(END_HEIGHT_KEY) || '20'));
const heightStep = ref(Number(localStorage.getItem(HEIGHT_STEP_KEY) || '5'));
const stabilizationSeconds = ref(Number(localStorage.getItem(STABILIZATION_KEY) || '2'));
const positionWarningMeters = ref(Number(localStorage.getItem(POSITION_WARNING_KEY) || '3'));
const positionAbortMeters = ref(Number(localStorage.getItem(POSITION_ABORT_KEY) || '6'));
watch(endHeight, value => localStorage.setItem(END_HEIGHT_KEY, String(value)));
watch(heightStep, value => localStorage.setItem(HEIGHT_STEP_KEY, String(value)));
watch(stabilizationSeconds, value => localStorage.setItem(STABILIZATION_KEY, String(value)));
watch(positionWarningMeters, value => localStorage.setItem(POSITION_WARNING_KEY, String(value)));
watch(positionAbortMeters, value => localStorage.setItem(POSITION_ABORT_KEY, String(value)));
export function usePrecisionStartSettings() {
    return { endHeight, heightStep, stabilizationSeconds, positionWarningMeters, positionAbortMeters };
}
