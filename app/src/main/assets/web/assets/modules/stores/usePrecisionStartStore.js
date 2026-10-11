import { defineStore } from '../../vendor/pinia.js';
import { computed, reactive } from '../../vendor/vue.js';
export const usePrecisionStartStore = defineStore('precision-start', () => {
    const state = reactive({
        active: false,
        phase: 'IDLE',
        sessionId: '',
        status: '',
        abortReason: '',
        startedAt: 0,
        stepId: '',
        startVerticalDistance: 0,
        startLatitude: 0,
        startLongitude: 0,
        startHeading: 0,
        hoverHeight: 0,
        currentTargetHeight: null,
        referenceIndex: -1,
        capturedImages: 0,
    });
    const blinking = computed(() => state.active);
    function begin(sessionId) {
        state.active = true;
        state.phase = 'STEP0_CHECK';
        state.sessionId = sessionId;
        state.status = 'Schritt 0: Voraussetzungen werden geprüft.';
        state.abortReason = '';
        state.startedAt = Date.now();
        state.stepId = 'STEP0';
        state.startVerticalDistance = 0;
        state.startLatitude = 0;
        state.startLongitude = 0;
        state.startHeading = 0;
        state.hoverHeight = 0;
        state.currentTargetHeight = null;
        state.referenceIndex = -1;
        state.capturedImages = 0;
    }
    function finish(status) {
        state.active = false;
        state.phase = 'COMPLETE';
        state.status = status;
        state.abortReason = '';
        state.currentTargetHeight = null;
    }
    function abort(reason) {
        state.active = false;
        state.phase = 'ABORTED';
        state.abortReason = reason;
        state.status = `PStart abgebrochen: ${reason}`;
        state.currentTargetHeight = null;
    }
    return { state, blinking, begin, finish, abort };
});
