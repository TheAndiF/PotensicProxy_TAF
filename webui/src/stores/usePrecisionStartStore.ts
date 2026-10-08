import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'

export type PrecisionStartPhase =
  | 'IDLE'
  | 'STEP0_CHECK'
  | 'STEP0_DOCUMENT'
  | 'TAKEOFF'
  | 'WAIT_HOVER'
  | 'ASCEND'
  | 'GIMBAL'
  | 'STABILIZE'
  | 'CAPTURE'
  | 'COMPLETE'
  | 'ABORTED'

export const usePrecisionStartStore = defineStore('precision-start', () => {
  const state = reactive({
    active: false,
    phase: 'IDLE' as PrecisionStartPhase,
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
    currentTargetHeight: null as number | null,
    referenceIndex: -1,
    capturedImages: 0,
  })

  const blinking = computed(() => state.active)

  function begin(sessionId: string) {
    state.active = true
    state.phase = 'STEP0_CHECK'
    state.sessionId = sessionId
    state.status = 'Schritt 0: Voraussetzungen werden geprüft.'
    state.abortReason = ''
    state.startedAt = Date.now()
    state.stepId = 'STEP0'
    state.startVerticalDistance = 0
    state.startLatitude = 0
    state.startLongitude = 0
    state.startHeading = 0
    state.hoverHeight = 0
    state.currentTargetHeight = null
    state.referenceIndex = -1
    state.capturedImages = 0
  }

  function finish(status: string) {
    state.active = false
    state.phase = 'COMPLETE'
    state.status = status
    state.abortReason = ''
    state.currentTargetHeight = null
  }

  function abort(reason: string) {
    state.active = false
    state.phase = 'ABORTED'
    state.abortReason = reason
    state.status = `PStart abgebrochen: ${reason}`
    state.currentTargetHeight = null
  }

  return { state, blinking, begin, finish, abort }
})
