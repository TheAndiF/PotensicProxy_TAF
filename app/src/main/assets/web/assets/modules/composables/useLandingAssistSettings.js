import { ref, watch } from '../../vendor/vue.js';
const crosshairVisible = ref(localStorage.getItem('potensic-landing-assist-crosshair') === 'true');
const panelOpen = ref(localStorage.getItem('potensic-landing-assist-open') === 'true');
const returnHeight = ref(Number(localStorage.getItem('potensic-landing-assist-rth-height') || '120'));
const fineControlPercent = ref(Number(localStorage.getItem('potensic-landing-assist-fine-percent') || '15'));
watch(crosshairVisible, value => localStorage.setItem('potensic-landing-assist-crosshair', String(value)));
watch(panelOpen, value => localStorage.setItem('potensic-landing-assist-open', String(value)));
watch(returnHeight, value => localStorage.setItem('potensic-landing-assist-rth-height', String(value)));
watch(fineControlPercent, value => localStorage.setItem('potensic-landing-assist-fine-percent', String(value)));
export function useLandingAssistSettings() {
    return { crosshairVisible, panelOpen, returnHeight, fineControlPercent };
}
