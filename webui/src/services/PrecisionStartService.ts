import { AndroidMediaService } from './AndroidMediaService'
import { CameraMediaService } from './CameraMediaService'
import { DroneControlService } from './DroneControlService'
import { PrecisionStartMetadataService, type PStartImageRole } from './PrecisionStartMetadataService'
import { useDroneStore } from '../stores/useDroneStore'
import { useCameraStore } from '../stores/useCameraStore'
import { usePrecisionStartStore } from '../stores/usePrecisionStartStore'
import { usePrecisionStartSettings } from '../composables/usePrecisionStartSettings'

const STEP0_TIMEOUT_MS = 10_000
const STEP0_STABLE_MS = 1_000
const TAKEOFF_HOVER_TIMEOUT_MS = 20_000
const ASCENT_TIMEOUT_MS = 45_000
const ASCENT_SETTLE_TIMEOUT_MS = 4_000
const ASCENT_SETTLE_STABLE_MS = 800
const GIMBAL_ATTEMPT_TIMEOUT_MS = 2_500
const ZOOM_TIMEOUT_MS = 3_000
const CONTROL_INTERVAL_MS = 80
const PROTOCOL_SAMPLE_INTERVAL_MS = 200
const POSITION_ABORT_STABLE_MS = 1_000
const MANUAL_RC_THRESHOLD = 120
const GIMBAL_TOLERANCE_DEG = 2
const HOVER_VERTICAL_SPEED_MPS = 0.25
const HOVER_STABLE_MS = 1_000
const TARGET_TOLERANCE_M = 0.05
const TARGET_REACHED_TOLERANCE_M = 0.03
const TARGET_SETTLE_DROP_TOLERANCE_M = 0.15
const TARGET_SETTLE_VERTICAL_SPEED_MPS = 0.35
const FIRST_REFERENCE_OFFSET_M = 0.10
const CLOSE_ASCENT_THROTTLE = 150

const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))

type ProtocolStatus =
  | 'COMPLETED'
  | 'ABORTED_MANUAL'
  | 'ABORTED_GIMBAL'
  | 'ABORTED_TIMEOUT'
  | 'ABORTED_SAFETY'
  | 'ABORTED_ERROR'

export class PrecisionStartService {
  private static runId = 0
  private static axisTimer: ReturnType<typeof setInterval> | null = null
  private static autoThrottle = 0
  private static aborting = false
  private static fallbackActive = false

  private static protocolTimer: ReturnType<typeof setInterval> | null = null
  private static protocolLines: string[] = []
  private static protocolSessionId = ''
  private static protocolMasterImageId = ''
  private static protocolMasterImageName = ''
  private static protocolClosed = true
  private static protocolFinalized = true
  private static positionWarningActive = false
  private static positionAbortSince = 0

  static isActive(): boolean {
    return usePrecisionStartStore().state.active
  }

  static async toggle() {
    if (this.isActive()) {
      this.abort('Benutzerabbruch über PStart-Taste', 'manual')
      return
    }
    await this.start()
  }

  static notifyManualControl(source: string) {
    if (this.fallbackActive) {
      this.fallbackActive = false
      this.stopAutomaticAxes(true)
      useDroneStore().addLog('WARN', `[PStart fallback] stopped by manual control (${source}); hover/pilot control restored`)
      return
    }
    if (!this.isActive()) return
    this.abort(`manueller Steuereingriff (${source})`, 'manual')
  }

  static abort(reason: string, kind: 'manual' | 'error' = 'error') {
    if (this.aborting) return
    const pstart = usePrecisionStartStore()
    const drone = useDroneStore()
    if (!pstart.state.active && pstart.state.phase !== 'TAKEOFF' && pstart.state.phase !== 'WAIT_HOVER' && pstart.state.phase !== 'ASCEND' && pstart.state.phase !== 'GIMBAL' && pstart.state.phase !== 'STABILIZE' && pstart.state.phase !== 'CAPTURE') return

    this.aborting = true
    const previousPhase = pstart.state.phase
    const previousTarget = pstart.state.currentTargetHeight
    const status = this.abortProtocolStatus(reason, kind)
    this.recordProtocolEvent('PSTART_ABORT', {
      status,
      reason,
      phase: previousPhase,
      targetHeight: previousTarget,
      relativeHeight: this.relativeHeight(pstart.state.startVerticalDistance),
    })

    this.runId += 1
    this.stopAutomaticAxes(true)
    CameraMediaService.setZoom(1)
    pstart.abort(reason)
    drone.addLog(
      kind === 'manual' ? 'WARN' : 'ERROR',
      `[PStart] aborted: reason=${reason}; phase=${previousPhase}; ` +
      `height=${this.relativeHeight(pstart.state.startVerticalDistance).toFixed(2)}m; ` +
      `target=${previousTarget ?? 'n/a'}m; ` +
      `gps=${drone.telemetry.latitude.toFixed(7)},${drone.telemetry.longitude.toFixed(7)}; ` +
      `vSpeed=${drone.telemetry.verticalSpeed.toFixed(2)}m/s`
    )
    void this.finalizeProtocol(status, reason)
    window.setTimeout(() => { this.aborting = false }, 0)
  }

  private static async start() {
    const pstart = usePrecisionStartStore()
    const drone = useDroneStore()
    const id = ++this.runId
    const sessionId = this.makeSessionId()
    pstart.begin(sessionId)
    this.startProtocol(sessionId)
    drone.addLog('INFO', `[PStart] session=${sessionId} started; step0 timeout=${STEP0_TIMEOUT_MS / 1000}s`)

    // PStart starts from neutral user axes and never injects pitch/roll/yaw in V1.
    drone.userJoysticks.throttle = 0
    drone.userJoysticks.yaw = 0
    drone.userJoysticks.pitch = 0
    drone.userJoysticks.roll = 0
    DroneControlService.sendJoysticks()

    try {
      const ready = await this.waitForStep0Prerequisites(id)
      if (!ready || !this.isCurrent(id)) return

      pstart.state.startVerticalDistance = Number(drone.telemetry.verticalDistance || 0)
      pstart.state.startLatitude = Number(drone.telemetry.latitude || 0)
      pstart.state.startLongitude = Number(drone.telemetry.longitude || 0)
      pstart.state.startHeading = Number(drone.telemetry.heading || 0)
      pstart.state.phase = 'STEP0_DOCUMENT'
      pstart.state.status = 'Schritt 0: Voraussetzungen erfüllt - Dokumentationsbilder werden erstellt.'
      this.recordProtocolEvent('STEP0_READY', {
        startVerticalDistance: pstart.state.startVerticalDistance,
        startLatitude: pstart.state.startLatitude,
        startLongitude: pstart.state.startLongitude,
        startHeading: pstart.state.startHeading,
      })

      if (!await this.ensureGimbalMinus90(id, false)) return
      await this.capturePair(id, {
        stepId: 'STEP0',
        referenceIndex: -1,
        targetHeight: null,
        imageRole: 'PSTART_DOCUMENTATION',
        referenceEligible: false,
        referenceReason: 'step0_not_optically_suitable',
      })
      if (!this.isCurrent(id)) return

      pstart.state.phase = 'TAKEOFF'
      pstart.state.stepId = 'TAKEOFF'
      pstart.state.status = 'Schritt 1: normaler Start - kein Precision-Regeleingriff.'
      this.recordProtocolEvent('TAKEOFF_COMMAND')
      drone.addLog('INFO', '[PStart] Step 1: executing existing normal takeoff command without pitch/roll/yaw intervention')
      DroneControlService.takeoff()

      const hoverHeight = await this.waitForStableHover(id)
      if (hoverHeight == null || !this.isCurrent(id)) return
      pstart.state.hoverHeight = hoverHeight
      this.recordProtocolEvent('HOVER_DETECTED', { hoverHeight })
      drone.addLog('INFO', `[PStart] stable hover height=${hoverHeight.toFixed(2)}m (mean over stable window, relative to PStart zero)`)

      const { endHeight, heightStep } = usePrecisionStartSettings()
      const end = Math.max(1, Number(endHeight.value) || 20)
      const step = Math.max(0.5, Number(heightStep.value) || 5)
      const firstReference = this.roundHeight(hoverHeight + FIRST_REFERENCE_OFFSET_M)

      if (firstReference > end + TARGET_TOLERANCE_M) {
        this.abort(`Endhöhe ${end.toFixed(1)} m liegt unter dem ersten Referenzpunkt ${firstReference.toFixed(1)} m`)
        return
      }

      const targets = this.buildTargets(firstReference, step, end)
      this.recordProtocolEvent('REFERENCE_TARGETS_CALCULATED', { firstReference, endHeight: end, heightStep: step, targets })
      drone.addLog('INFO', `[PStart] reference targets=${targets.map(v => v.toFixed(2)).join(' -> ')}m`)

      for (let index = 0; index < targets.length; index++) {
        if (!this.isCurrent(id)) return
        const target = targets[index]
        pstart.state.referenceIndex = index
        pstart.state.stepId = `REF_${index}`
        pstart.state.currentTargetHeight = target
        this.recordProtocolEvent('REFERENCE_STAGE_BEGIN', { referenceIndex: index, targetHeight: target })

        if (!await this.ascendTo(id, target)) return
        if (!this.isCurrent(id)) return

        if (!await this.ensureGimbalMinus90(id, true)) return
        if (!this.isCurrent(id)) return

        const stabilizationMs = Math.max(0, Number(usePrecisionStartSettings().stabilizationSeconds.value) || 0) * 1000
        pstart.state.phase = 'STABILIZE'
        pstart.state.status = `Referenz ${index + 1}: Stabilisierung bei ${target.toFixed(1)} m.`
        this.recordProtocolEvent('STABILIZATION_STARTED', { referenceIndex: index, targetHeight: target, stabilizationMs })
        if (!await this.delayWithAbortCheck(id, stabilizationMs)) return
        this.recordProtocolEvent('STABILIZATION_COMPLETE', { referenceIndex: index, targetHeight: target })

        // Final angle check directly before the two pictures. A drift triggers the second-preset logic again.
        if (!this.gimbalIsReady()) {
          if (!await this.ensureGimbalMinus90(id, true)) return
        }

        await this.capturePair(id, {
          stepId: `REF_${index}`,
          referenceIndex: index,
          targetHeight: target,
          imageRole: 'PSTART_REFERENCE',
          referenceEligible: true,
        })
      }

      if (!this.isCurrent(id)) return
      this.stopAutomaticAxes(true)
      CameraMediaService.setZoom(1)
      this.recordProtocolEvent('PSTART_COMPLETE', {
        capturedImages: pstart.state.capturedImages,
        finalHeight: this.relativeHeight(pstart.state.startVerticalDistance),
      })
      await this.finalizeProtocol('COMPLETED')
      pstart.finish(`PStart abgeschlossen: ${pstart.state.capturedImages} Bilder dokumentiert. Drohne schwebt auf Endhöhe.`)
      drone.addLog('INFO', `[PStart] completed session=${sessionId}; images=${pstart.state.capturedImages}; finalHeight=${this.relativeHeight(pstart.state.startVerticalDistance).toFixed(2)}m`)
    } catch (error: any) {
      if (this.isCurrent(id)) this.abort(error?.message || String(error))
    }
  }

  private static async waitForStep0Prerequisites(id: number): Promise<boolean> {
    const pstart = usePrecisionStartStore()
    const drone = useDroneStore()
    const camera = useCameraStore()
    const deadline = Date.now() + STEP0_TIMEOUT_MS
    let stableSince = 0
    let lastReasons: string[] = []

    if (!drone.telemetry.gimbalSettingsValid) DroneControlService.requestGimbalSettings()
    if (!camera.initialization.ready) DroneControlService.initLiveView()

    while (Date.now() < deadline) {
      if (!this.isCurrent(id)) return false
      lastReasons = this.prerequisiteFailures()
      if (lastReasons.length === 0) {
        if (!stableSince) stableSince = Date.now()
        const stableFor = Date.now() - stableSince
        pstart.state.status = `Schritt 0: Voraussetzungen OK - Stabilität ${(stableFor / 1000).toFixed(1)}/${(STEP0_STABLE_MS / 1000).toFixed(1)} s.`
        if (stableFor >= STEP0_STABLE_MS) return true
      } else {
        stableSince = 0
        pstart.state.status = `Schritt 0: ${lastReasons.join('; ')}`
        if (!drone.telemetry.gimbalSettingsValid) DroneControlService.requestGimbalSettings()
      }
      await sleep(100)
    }

    const reason = lastReasons.length ? lastReasons.join('; ') : 'Voraussetzungen innerhalb von 10 s nicht stabil'
    this.abort(`Schritt 0 Timeout: ${reason}`)
    return false
  }

  private static prerequisiteFailures(): string[] {
    const drone = useDroneStore()
    const camera = useCameraStore()
    const t = drone.telemetry
    const failures: string[] = []
    const rxFresh = !!drone.connection.lastRxTimestamp && Date.now() - Number(drone.connection.lastRxTimestamp) < 2500

    if (!drone.connection.usbConnected) failures.push('Drohnenverbindung fehlt')
    if (!t.remoterConnected) failures.push('Fernsteuerung nicht verbunden')
    if (!rxFresh) failures.push('Telemetrie nicht aktuell')
    if (!t.receiveGps || !t.gpsLocationValid || t.gpsInterference || !Number.isFinite(t.latitude) || !Number.isFinite(t.longitude) || (t.latitude === 0 && t.longitude === 0)) failures.push('GPS nicht stabil')
    if (!camera.initialization.ready || !drone.connection.videoStreaming) failures.push('Kamera/Livebild nicht bereit')
    if (!t.gimbalSettingsValid || !t.gimbalStateValid || t.gimbalNotReady || Number(t.gimbalErrorStatus || 0) !== 0) failures.push('Gimbal nicht bereit')
    if (t.battery <= 0 || t.lowPowerMode) failures.push('Akku nicht ausreichend')
    if (t.needCalibration || t.geomagneticFault || t.emergencyStop || t.flightInNoFlyZone || t.restrictedZone) failures.push('kritischer Flug-/Sensorstatus')
    if (t.flying || t.takingOff || t.landing) failures.push('Drohne nicht am Boden/startbereit')
    if (this.hardwareManualInputActive()) failures.push('Steuerknüppel nicht in Neutralstellung')
    return failures
  }

  private static async waitForStableHover(id: number): Promise<number | null> {
    const pstart = usePrecisionStartStore()
    const drone = useDroneStore()
    const deadline = Date.now() + TAKEOFF_HOVER_TIMEOUT_MS
    let stableSince = 0
    let heightSamples: number[] = []

    pstart.state.phase = 'WAIT_HOVER'
    pstart.state.status = 'Normaler Start läuft - warte auf stabilen Schwebeflug.'

    while (Date.now() < deadline) {
      if (!this.isCurrent(id)) return null
      if (this.hardwareManualInputActive()) {
        this.abort('manueller Steuereingriff während des normalen Starts', 'manual')
        return null
      }
      if (!this.checkPositionSafety('WAIT_HOVER')) return null

      const t = drone.telemetry
      const stable = !!t.flying && !t.takingOff && !t.landing && Math.abs(Number(t.verticalSpeed || 0)) <= HOVER_VERTICAL_SPEED_MPS
      if (stable) {
        if (!stableSince) {
          stableSince = Date.now()
          heightSamples = []
        }
        heightSamples.push(this.relativeHeight(pstart.state.startVerticalDistance))
        if (Date.now() - stableSince >= HOVER_STABLE_MS) {
          const mean = heightSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, heightSamples.length)
          return this.roundHeight(mean)
        }
      } else {
        stableSince = 0
        heightSamples = []
      }
      await sleep(100)
    }

    this.abort('Normaler Start: stabiler Schwebeflug nicht innerhalb von 20 s erkannt')
    return null
  }

  private static buildTargets(firstReference: number, step: number, end: number): number[] {
    const targets: number[] = [Math.min(firstReference, end)]
    let grid = (Math.floor(firstReference / step) + 1) * step
    while (grid < end - TARGET_TOLERANCE_M) {
      if (grid > firstReference + TARGET_TOLERANCE_M) targets.push(this.roundHeight(grid))
      grid += step
    }
    if (end > targets[targets.length - 1] + TARGET_TOLERANCE_M) targets.push(this.roundHeight(end))
    return targets
  }

  private static async ascendTo(id: number, target: number): Promise<boolean> {
    const pstart = usePrecisionStartStore()
    const drone = useDroneStore()
    const current = this.relativeHeight(pstart.state.startVerticalDistance)
    if (target <= current + TARGET_REACHED_TOLERANCE_M) {
      // Never descend. If telemetry already passed the target, continue with the next stage at current altitude.
      drone.addLog('WARN', `[PStart] target ${target.toFixed(2)}m already reached/passed at ${current.toFixed(2)}m; no descent commanded`)
      this.recordProtocolEvent('TARGET_ALREADY_REACHED', { targetHeight: target, relativeHeight: current })
      this.neutralThrottle()
      return true
    }

    pstart.state.phase = 'ASCEND'
    pstart.state.status = `Steige auf ${target.toFixed(1)} m - nur Throttle, kein Pitch/Roll/Yaw.`
    this.recordProtocolEvent('ASCENT_STARTED', { targetHeight: target, startHeight: current })
    const deadline = Date.now() + ASCENT_TIMEOUT_MS
    this.startAutomaticAxes()

    while (Date.now() < deadline) {
      if (!this.isCurrent(id)) return false
      if (this.hardwareManualInputActive()) {
        this.abort('manueller Steuereingriff während des Aufstiegs', 'manual')
        return false
      }
      if (!this.checkPositionSafety('ASCEND')) return false

      const height = this.relativeHeight(pstart.state.startVerticalDistance)
      const remaining = target - height
      if (remaining <= TARGET_REACHED_TOLERANCE_M) {
        this.neutralThrottle()
        this.recordProtocolEvent('TARGET_REACHED', { targetHeight: target, relativeHeight: height, overshoot: height - target })
        drone.addLog('INFO', `[PStart] target ${target.toFixed(2)}m reached at ${height.toFixed(2)}m; throttle neutral`)

        const settled = await this.waitForPostAscentSettle(id, target)
        if (settled === null) return false
        if (settled) return true

        this.recordProtocolEvent('ASCENT_RESUME_AFTER_DROP', {
          targetHeight: target,
          relativeHeight: this.relativeHeight(pstart.state.startVerticalDistance),
        })
        pstart.state.phase = 'ASCEND'
      }

      // Vertical-only V1 control. The close-range command deliberately stays above
      // the previous very small value so that the first +10 cm point is not lost in
      // a control dead zone. PStart still stops immediately once the target is reached.
      const throttle = remaining > 1.0 ? 260 : remaining > 0.35 ? 180 : CLOSE_ASCENT_THROTTLE
      this.setAutoThrottle(throttle)
      await sleep(CONTROL_INTERVAL_MS)
    }

    this.neutralThrottle()
    this.abort(`Zielhöhe ${target.toFixed(1)} m konnte nicht innerhalb von 45 s erreicht werden`)
    return false
  }

  /**
   * After crossing a target PStart does not try to hold an exact decimetre value.
   * It neutralizes throttle and waits for vertical motion to settle. Only a clear
   * drop below the target band causes the climb to resume. This is intentionally
   * tolerant of wind and quantized verticalDistance telemetry.
   */
  private static async waitForPostAscentSettle(id: number, target: number): Promise<boolean | null> {
    const pstart = usePrecisionStartStore()
    const drone = useDroneStore()
    const deadline = Date.now() + ASCENT_SETTLE_TIMEOUT_MS
    let stableSince = 0

    while (Date.now() < deadline) {
      if (!this.isCurrent(id)) return null
      if (this.hardwareManualInputActive()) {
        this.abort('manueller Steuereingriff während der Höhenberuhigung', 'manual')
        return null
      }
      if (!this.checkPositionSafety('ASCENT_SETTLE')) return null

      const height = this.relativeHeight(pstart.state.startVerticalDistance)
      const verticalSpeed = Math.abs(Number(drone.telemetry.verticalSpeed || 0))
      if (height < target - TARGET_SETTLE_DROP_TOLERANCE_M) {
        drone.addLog('WARN', `[PStart] height dropped to ${height.toFixed(2)}m after target ${target.toFixed(2)}m; resuming vertical ascent`)
        return false
      }

      if (verticalSpeed <= TARGET_SETTLE_VERTICAL_SPEED_MPS) {
        if (!stableSince) stableSince = Date.now()
        if (Date.now() - stableSince >= ASCENT_SETTLE_STABLE_MS) {
          this.recordProtocolEvent('TARGET_SETTLED', { targetHeight: target, relativeHeight: height, verticalSpeed })
          return true
        }
      } else {
        stableSince = 0
      }
      await sleep(100)
    }

    const height = this.relativeHeight(pstart.state.startVerticalDistance)
    if (height >= target - TARGET_SETTLE_DROP_TOLERANCE_M) {
      drone.addLog('WARN', `[PStart] target ${target.toFixed(2)}m did not fully settle within ${(ASCENT_SETTLE_TIMEOUT_MS / 1000).toFixed(1)}s; continuing within tolerant height band at ${height.toFixed(2)}m`)
      this.recordProtocolEvent('TARGET_SETTLE_TIMEOUT_ACCEPTED', { targetHeight: target, relativeHeight: height })
      return true
    }
    return false
  }

  private static async ensureGimbalMinus90(id: number, airborne: boolean): Promise<boolean> {
    const pstart = usePrecisionStartStore()
    const drone = useDroneStore()
    pstart.state.phase = 'GIMBAL'
    pstart.state.status = 'Gimbal wird über Preset auf -90° gestellt.'

    for (let attempt = 1; attempt <= 2; attempt++) {
      if (!this.isCurrent(id)) return false
      const sent = DroneControlService.setGimbalPitchPreset(-90)
      this.recordProtocolEvent('GIMBAL_PRESET', { attempt, targetPitch: -90, commandSent: sent })
      if (!sent) DroneControlService.requestGimbalSettings()
      const deadline = Date.now() + GIMBAL_ATTEMPT_TIMEOUT_MS
      while (Date.now() < deadline) {
        if (!this.isCurrent(id)) return false
        if (airborne && this.hardwareManualInputActive()) {
          this.abort('manueller Steuereingriff während der Gimbal-Ausrichtung', 'manual')
          return false
        }
        if (airborne && !this.checkPositionSafety('GIMBAL')) return false
        if (this.gimbalIsReady()) {
          this.recordProtocolEvent('GIMBAL_CONFIRMED', { attempt, actualPitch: Number(drone.telemetry.gimbalPitch || 0) })
          drone.addLog('INFO', `[PStart] gimbal -90° confirmed on attempt ${attempt}: ${Number(drone.telemetry.gimbalPitch || 0).toFixed(1)}°`)
          return true
        }
        await sleep(100)
      }
      this.recordProtocolEvent('GIMBAL_PRESET_TIMEOUT', { attempt, actualPitch: Number(drone.telemetry.gimbalPitch || 0) })
      drone.addLog('WARN', `[PStart] gimbal -90° not confirmed after preset attempt ${attempt}/2`)
    }

    const reason = 'Gimbal -90° nach 2 Preset-Versuchen nicht erreicht'
    this.abort(reason)
    if (airborne) void this.continueToEndHeightAfterGimbalFailure(reason)
    return false
  }

  private static gimbalIsReady(): boolean {
    const t = useDroneStore().telemetry
    return !!t.gimbalStateValid && !t.gimbalNotReady && Number(t.gimbalErrorStatus || 0) === 0 && Math.abs(Number(t.gimbalPitch || 0) + 90) <= GIMBAL_TOLERANCE_DEG
  }

  private static async capturePair(
    id: number,
    context: {
      stepId: string
      referenceIndex: number
      targetHeight: number | null
      imageRole: PStartImageRole
      referenceEligible: boolean
      referenceReason?: string
    },
  ) {
    const pstart = usePrecisionStartStore()
    const camera = useCameraStore()
    const drone = useDroneStore()
    pstart.state.phase = 'CAPTURE'
    pstart.state.stepId = context.stepId
    this.recordProtocolEvent('CAPTURE_PAIR_STARTED', { ...context })

    await this.setZoomAndWait(id, 1)
    if (!this.isCurrent(id)) return
    pstart.state.status = `${context.stepId}: Bild 1/2 ohne Zoom wird dokumentiert.`
    await this.captureOne(id, context, 'ZERO')

    const maxZoom = Math.max(1, Number(camera.zoomMax || 1))
    await this.setZoomAndWait(id, maxZoom)
    if (!this.isCurrent(id)) return
    pstart.state.status = `${context.stepId}: Bild 2/2 mit maximalem Zoom wird dokumentiert.`
    await this.captureOne(id, context, 'MAX')

    // Keep the pilot/live view wide between stages.
    CameraMediaService.setZoom(1)
    this.recordProtocolEvent('CAPTURE_PAIR_COMPLETE', { stepId: context.stepId, zoomZero: 1, zoomMax: maxZoom })
    drone.addLog('INFO', `[PStart] ${context.stepId} image pair completed (1.00x + ${maxZoom.toFixed(2)}x)`)
  }

  private static async captureOne(
    id: number,
    context: {
      stepId: string
      referenceIndex: number
      targetHeight: number | null
      imageRole: PStartImageRole
      referenceEligible: boolean
      referenceReason?: string
    },
    zoomRole: 'ZERO' | 'MAX',
  ) {
    if (!this.isCurrent(id)) return
    const pstart = usePrecisionStartStore()
    const settings = usePrecisionStartSettings()
    const metadata = PrecisionStartMetadataService.build({
      sessionId: pstart.state.sessionId,
      stepId: context.stepId,
      referenceIndex: context.referenceIndex,
      targetHeight: context.targetHeight,
      startVerticalDistance: pstart.state.startVerticalDistance,
      startLatitude: pstart.state.startLatitude,
      startLongitude: pstart.state.startLongitude,
      startHeading: pstart.state.startHeading,
      hoverHeight: pstart.state.hoverHeight,
      imageRole: context.imageRole,
      referenceEligible: context.referenceEligible,
      referenceReason: context.referenceReason,
      zoomRole,
      positionWarningMeters: Number(settings.positionWarningMeters.value),
      positionAbortMeters: Number(settings.positionAbortMeters.value),
      pstartThrottleCommand: this.autoThrottle,
    })
    const heightLabel = context.targetHeight == null ? 'step0' : `${context.targetHeight.toFixed(1).replace('.', 'p')}m`
    const name = `PStart_${pstart.state.sessionId}_${context.stepId}_${heightLabel}_${zoomRole.toLowerCase()}.jpg`
    const source = context.referenceEligible ? 'pstart-reference' : 'pstart-documentation'
    const saved = await AndroidMediaService.savePrecisionSnapshot(metadata, name, source, pstart.state.sessionId)
    if (!this.isCurrent(id)) return

    if (context.stepId === 'STEP0' && zoomRole === 'ZERO') {
      this.protocolMasterImageId = saved.id
      this.protocolMasterImageName = saved.name
    }

    pstart.state.capturedImages += 1
    this.recordProtocolEvent('IMAGE_CAPTURED', {
      stepId: context.stepId,
      referenceIndex: context.referenceIndex,
      targetHeight: context.targetHeight,
      zoomRole,
      name: saved.name,
      id: saved.id,
      relativePath: saved.relativePath,
      verified: saved.verified === true,
    })
    useDroneStore().addLog('INFO', `[PStart] image saved: ${saved.relativePath}/${saved.name}; verified=${saved.verified === true}`)
  }

  private static async setZoomAndWait(id: number, zoom: number) {
    const camera = useCameraStore()
    CameraMediaService.setZoom(zoom)
    const deadline = Date.now() + ZOOM_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (!this.isCurrent(id)) return
      const actual = Number(camera.zoomActual ?? camera.zoomTarget)
      if (!camera.zoomPending && Math.abs(actual - zoom) <= 0.05) {
        this.recordProtocolEvent('ZOOM_CONFIRMED', { targetZoom: zoom, actualZoom: actual })
        return
      }
      await sleep(80)
    }
    throw new Error(`Kamerazoom ${zoom.toFixed(2)}x wurde nicht bestätigt`)
  }

  private static async continueToEndHeightAfterGimbalFailure(reason: string) {
    const pstart = usePrecisionStartStore()
    const drone = useDroneStore()
    const end = Math.max(1, Number(usePrecisionStartSettings().endHeight.value) || 20)
    const startOffset = pstart.state.startVerticalDistance
    const current = this.relativeHeight(startOffset)
    if (!drone.telemetry.flying || end <= current + TARGET_TOLERANCE_M) return

    drone.addLog('WARN', `[PStart fallback] ${reason}; continuing vertically to configured end height ${end.toFixed(1)}m without PStart/reference capture`)
    this.fallbackActive = true
    const deadline = Date.now() + ASCENT_TIMEOUT_MS
    this.startAutomaticAxes()
    while (Date.now() < deadline && drone.telemetry.flying) {
      if (this.hardwareManualInputActive()) {
        this.fallbackActive = false
        this.stopAutomaticAxes(true)
        drone.addLog('WARN', '[PStart fallback] manual RC input detected; fallback climb stopped and hover/pilot control restored')
        return
      }
      const height = this.relativeHeight(startOffset)
      const remaining = end - height
      if (remaining <= TARGET_TOLERANCE_M) {
        this.fallbackActive = false
        this.stopAutomaticAxes(true)
        drone.addLog('INFO', `[PStart fallback] configured flight height ${end.toFixed(1)}m reached; throttle neutral`)
        return
      }
      this.setAutoThrottle(remaining > 1 ? 260 : 150)
      await sleep(CONTROL_INTERVAL_MS)
    }
    this.fallbackActive = false
    this.stopAutomaticAxes(true)
  }

  private static hardwareManualInputActive(): boolean {
    const rc = useDroneStore().rcHardwareJoysticks
    return [rc.throttle, rc.yaw, rc.pitch, rc.roll].some(value => Math.abs(Number(value || 0)) > MANUAL_RC_THRESHOLD)
  }

  private static relativeHeight(startVerticalDistance: number): number {
    return Number(useDroneStore().telemetry.verticalDistance || 0) - Number(startVerticalDistance || 0)
  }

  private static roundHeight(value: number): number {
    return Math.round(value * 100) / 100
  }

  private static startAutomaticAxes() {
    if (this.axisTimer) return
    this.axisTimer = setInterval(() => {
      const drone = useDroneStore()
      drone.userJoysticks.throttle = this.autoThrottle
      drone.userJoysticks.yaw = 0
      drone.userJoysticks.pitch = 0
      drone.userJoysticks.roll = 0
      DroneControlService.sendJoysticks()
    }, CONTROL_INTERVAL_MS)
  }

  private static setAutoThrottle(value: number) {
    const next = Math.max(-1000, Math.min(1000, Math.round(value)))
    const changed = next !== this.autoThrottle
    this.autoThrottle = next
    const drone = useDroneStore()
    drone.userJoysticks.throttle = this.autoThrottle
    drone.userJoysticks.yaw = 0
    drone.userJoysticks.pitch = 0
    drone.userJoysticks.roll = 0
    DroneControlService.sendJoysticks()
    if (changed) this.recordProtocolEvent('THROTTLE_COMMAND', { command: this.autoThrottle })
  }

  private static neutralThrottle() {
    const changed = this.autoThrottle !== 0
    this.autoThrottle = 0
    const drone = useDroneStore()
    drone.userJoysticks.throttle = 0
    drone.userJoysticks.yaw = 0
    drone.userJoysticks.pitch = 0
    drone.userJoysticks.roll = 0
    DroneControlService.sendJoysticks()
    if (changed) this.recordProtocolEvent('THROTTLE_NEUTRAL', { command: 0 })
  }

  private static stopAutomaticAxes(sendNeutral: boolean) {
    if (this.axisTimer) {
      clearInterval(this.axisTimer)
      this.axisTimer = null
    }
    if (sendNeutral) this.neutralThrottle()
    else this.autoThrottle = 0
  }

  private static async delayWithAbortCheck(id: number, ms: number): Promise<boolean> {
    const deadline = Date.now() + ms
    while (Date.now() < deadline) {
      if (!this.isCurrent(id)) return false
      if (this.hardwareManualInputActive()) {
        this.abort('manueller Steuereingriff während der Stabilisierung', 'manual')
        return false
      }
      if (!this.checkPositionSafety('STABILIZE')) return false
      await sleep(Math.min(100, Math.max(1, deadline - Date.now())))
    }
    return this.isCurrent(id)
  }

  /**
   * Horizontal GPS drift does not gate normal reference acquisition inside the
   * warning radius. A larger configurable warning radius marks quality only; the
   * separate abort radius is the safety boundary.
   */
  private static checkPositionSafety(stage: string): boolean {
    const pstart = usePrecisionStartStore()
    if (!pstart.state.startLatitude || !pstart.state.startLongitude) return true

    const drone = useDroneStore()
    const settings = usePrecisionStartSettings()
    const warning = Math.max(0.5, Number(settings.positionWarningMeters.value) || 3)
    const abort = Math.max(warning + 0.5, Number(settings.positionAbortMeters.value) || 6)
    const offset = PrecisionStartMetadataService.homeOffsetMeters(
      pstart.state.startLatitude,
      pstart.state.startLongitude,
      Number(drone.telemetry.latitude || 0),
      Number(drone.telemetry.longitude || 0),
    )
    if (offset == null) return true

    if (offset > abort) {
      if (!this.positionAbortSince) {
        this.positionAbortSince = Date.now()
        this.recordProtocolEvent('POSITION_ABORT_PENDING', { stage, homeOffset: offset, abortMeters: abort, requiredStableMs: POSITION_ABORT_STABLE_MS })
      }
      if (Date.now() - this.positionAbortSince >= POSITION_ABORT_STABLE_MS) {
        this.recordProtocolEvent('POSITION_ABORT_LIMIT', { stage, homeOffset: offset, abortMeters: abort, exceededForMs: Date.now() - this.positionAbortSince })
        this.abort(`GPS-Positionsabweichung ${offset.toFixed(1)} m überschreitet Abbruchgrenze ${abort.toFixed(1)} m länger als ${(POSITION_ABORT_STABLE_MS / 1000).toFixed(1)} s`)
        return false
      }
    } else {
      this.positionAbortSince = 0
    }

    if (offset > warning && !this.positionWarningActive) {
      this.positionWarningActive = true
      this.recordProtocolEvent('POSITION_WARNING', { stage, homeOffset: offset, warningMeters: warning, abortMeters: abort })
      drone.addLog('WARN', `[PStart] position warning: homeOffset=${offset.toFixed(1)}m > ${warning.toFixed(1)}m; PStart continues until abort limit ${abort.toFixed(1)}m`)
    } else if (offset <= warning && this.positionWarningActive) {
      this.positionWarningActive = false
      this.recordProtocolEvent('POSITION_RECOVERED', { stage, homeOffset: offset, warningMeters: warning })
      drone.addLog('INFO', `[PStart] position recovered inside warning radius: homeOffset=${offset.toFixed(1)}m`)
    }
    return true
  }

  private static startProtocol(sessionId: string) {
    this.stopProtocolSampling()
    this.protocolLines = []
    this.protocolSessionId = sessionId
    this.protocolMasterImageId = ''
    this.protocolMasterImageName = ''
    this.protocolClosed = false
    this.protocolFinalized = false
    this.positionWarningActive = false
    this.positionAbortSince = 0

    const settings = usePrecisionStartSettings()
    this.recordProtocolEvent('SESSION_START', {
      schema: 'PotensicProxy/PStartSession',
      schemaVersion: '1.0',
      settings: {
        endHeight: Number(settings.endHeight.value),
        heightStep: Number(settings.heightStep.value),
        stabilizationSeconds: Number(settings.stabilizationSeconds.value),
        positionWarningMeters: Number(settings.positionWarningMeters.value),
        positionAbortMeters: Number(settings.positionAbortMeters.value),
        firstReferenceOffsetMeters: FIRST_REFERENCE_OFFSET_M,
        protocolSampleIntervalMs: PROTOCOL_SAMPLE_INTERVAL_MS,
      },
    })
    this.protocolTimer = setInterval(() => this.recordProtocolTelemetry(), PROTOCOL_SAMPLE_INTERVAL_MS)
    this.recordProtocolTelemetry()
  }

  private static stopProtocolSampling() {
    if (this.protocolTimer) {
      clearInterval(this.protocolTimer)
      this.protocolTimer = null
    }
  }

  private static recordProtocolTelemetry() {
    if (this.protocolClosed || !this.protocolSessionId) return
    const pstart = usePrecisionStartStore()
    const drone = useDroneStore()
    const t = drone.telemetry
    const settings = usePrecisionStartSettings()
    const homeOffset = PrecisionStartMetadataService.homeOffsetMeters(
      pstart.state.startLatitude,
      pstart.state.startLongitude,
      Number(t.latitude || 0),
      Number(t.longitude || 0),
    )
    const warning = Number(settings.positionWarningMeters.value) || 3
    const abort = Number(settings.positionAbortMeters.value) || 6
    const positionQuality = homeOffset == null
      ? 'UNKNOWN'
      : homeOffset > abort
        ? 'ABORT_LIMIT'
        : homeOffset > warning ? 'WARNING_POSITION' : 'GOOD'

    this.protocolLines.push(JSON.stringify({
      schemaVersion: 1,
      recordType: 'telemetry',
      timestampUnixMs: Date.now(),
      timestampIso: new Date().toISOString(),
      sessionId: this.protocolSessionId,
      phase: pstart.state.phase,
      stepId: pstart.state.stepId,
      referenceIndex: pstart.state.referenceIndex,
      targetHeight: pstart.state.currentTargetHeight,
      verticalDistance: Number(t.verticalDistance || 0),
      pstartHeight: this.relativeHeight(pstart.state.startVerticalDistance),
      verticalSpeed: Number(t.verticalSpeed || 0),
      horizontalSpeed: Number(t.horizontalSpeed || 0),
      latitude: Number(t.latitude || 0),
      longitude: Number(t.longitude || 0),
      homeOffset,
      positionQuality,
      gps: {
        receiveGps: !!t.receiveGps,
        gpsLocationValid: !!t.gpsLocationValid,
        gpsInterference: !!t.gpsInterference,
        gpsAccuracy: Number((t as any).gpsAccuracy || 0),
        satellites: Number(t.satellites || 0),
      },
      tofHeight: Number(t.tofHeight ?? -1),
      heading: Number(t.heading || 0),
      pitch: Number(t.pitch || 0),
      roll: Number(t.roll || 0),
      gimbalPitch: Number(t.gimbalPitch || 0),
      rcHardware: { ...drone.rcHardwareJoysticks },
      pstartControl: {
        throttleCommand: this.autoThrottle,
        yawCommand: 0,
        pitchCommand: 0,
        rollCommand: 0,
      },
      flightState: {
        flying: !!t.flying,
        takingOff: !!t.takingOff,
        landing: !!t.landing,
        returning: !!t.returning,
      },
    }))
  }

  private static recordProtocolEvent(event: string, details: Record<string, unknown> = {}) {
    if (this.protocolClosed || !this.protocolSessionId) return
    const pstart = usePrecisionStartStore()
    const drone = useDroneStore()
    this.protocolLines.push(JSON.stringify({
      schemaVersion: 1,
      recordType: 'event',
      event,
      timestampUnixMs: Date.now(),
      timestampIso: new Date().toISOString(),
      sessionId: this.protocolSessionId,
      phase: pstart.state.phase,
      stepId: pstart.state.stepId,
      referenceIndex: pstart.state.referenceIndex,
      targetHeight: pstart.state.currentTargetHeight,
      pstartHeight: this.relativeHeight(pstart.state.startVerticalDistance),
      verticalSpeed: Number(drone.telemetry.verticalSpeed || 0),
      homeOffset: PrecisionStartMetadataService.homeOffsetMeters(
        pstart.state.startLatitude,
        pstart.state.startLongitude,
        Number(drone.telemetry.latitude || 0),
        Number(drone.telemetry.longitude || 0),
      ),
      ...details,
    }))
  }

  private static async finalizeProtocol(status: ProtocolStatus, abortReason = '') {
    if (this.protocolFinalized || !this.protocolSessionId) return

    this.stopProtocolSampling()
    const pstart = usePrecisionStartStore()
    const sessionId = this.protocolSessionId
    const masterImageId = this.protocolMasterImageId
    const masterImageName = this.protocolMasterImageName
    const fileName = `PStart_${sessionId}_session.jsonl`

    this.recordProtocolEvent('SESSION_END', {
      status,
      abortReason,
      capturedImages: pstart.state.capturedImages,
      finalHeight: this.relativeHeight(pstart.state.startVerticalDistance),
      masterImageName,
      protocolFile: fileName,
    })
    this.protocolClosed = true
    this.protocolFinalized = true

    const lines = [...this.protocolLines]
    const protocol = `${lines.join('\n')}\n`
    try {
      const result = await AndroidMediaService.finalizePrecisionSession({
        sessionId,
        masterImageId,
        masterImageName,
        fileName,
        protocol,
        summary: {
          schema: 'PotensicProxy/PStartSessionSummary',
          schemaVersion: 1,
          status,
          abortReason,
          recordCount: lines.length,
          capturedImages: pstart.state.capturedImages,
          hoverHeight: pstart.state.hoverHeight,
          finalHeight: this.relativeHeight(pstart.state.startVerticalDistance),
          endedAtUnixMs: Date.now(),
          endedAtIso: new Date().toISOString(),
        },
      })
      const sidecarSaved = result.protocol.saved !== false && !!result.protocol.uri
      const embedded = result.masterImage?.protocolEmbedded === true
      useDroneStore().addLog(
        sidecarSaved ? 'INFO' : 'WARN',
        `[PStart] session protocol finalized: sidecar=${sidecarSaved ? `${result.protocol.relativePath}/${result.protocol.name}` : 'not saved'}; ` +
        `verified=${result.protocol.verified === true}; embeddedInMaster=${embedded}` +
        (!sidecarSaved && result.protocol.error ? `; sidecarError=${result.protocol.error}` : '')
      )
    } catch (error: any) {
      useDroneStore().addLog('ERROR', `[PStart] session protocol finalization failed: ${error?.message || String(error)}`)
    }
  }

  private static abortProtocolStatus(reason: string, kind: 'manual' | 'error'): ProtocolStatus {
    if (kind === 'manual') return 'ABORTED_MANUAL'
    const normalized = reason.toLowerCase()
    if (normalized.includes('gimbal')) return 'ABORTED_GIMBAL'
    if (normalized.includes('timeout') || normalized.includes('innerhalb') || normalized.includes('zielhöhe')) return 'ABORTED_TIMEOUT'
    if (normalized.includes('gps') || normalized.includes('akku') || normalized.includes('verbindung') || normalized.includes('sensor') || normalized.includes('sicher')) return 'ABORTED_SAFETY'
    return 'ABORTED_ERROR'
  }

  private static isCurrent(id: number): boolean {
    return id === this.runId && usePrecisionStartStore().state.active
  }

  private static makeSessionId(): string {
    const d = new Date()
    const pad = (n: number, width = 2) => String(n).padStart(width, '0')
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}_${pad(d.getMilliseconds(), 3)}`
  }
}
