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
const GIMBAL_ATTEMPT_TIMEOUT_MS = 2_500
const ZOOM_TIMEOUT_MS = 3_000
const CONTROL_INTERVAL_MS = 80
const MANUAL_RC_THRESHOLD = 120
const GIMBAL_TOLERANCE_DEG = 2
const HOVER_VERTICAL_SPEED_MPS = 0.25
const HOVER_STABLE_MS = 1_000
const TARGET_TOLERANCE_M = 0.05
const FIRST_REFERENCE_OFFSET_M = 0.10

const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))

export class PrecisionStartService {
  private static runId = 0
  private static axisTimer: ReturnType<typeof setInterval> | null = null
  private static autoThrottle = 0
  private static aborting = false
  private static fallbackActive = false

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
    this.runId += 1
    this.stopAutomaticAxes(true)
    CameraMediaService.setZoom(1)
    pstart.abort(reason)
    drone.addLog(
      kind === 'manual' ? 'WARN' : 'ERROR',
      `[PStart] aborted: reason=${reason}; phase=${previousPhase}; ` +
      `height=${this.relativeHeight(pstart.state.startVerticalDistance).toFixed(2)}m; ` +
      `target=${pstart.state.currentTargetHeight ?? 'n/a'}m; ` +
      `gps=${drone.telemetry.latitude.toFixed(7)},${drone.telemetry.longitude.toFixed(7)}; ` +
      `vSpeed=${drone.telemetry.verticalSpeed.toFixed(2)}m/s`
    )
    window.setTimeout(() => { this.aborting = false }, 0)
  }

  private static async start() {
    const pstart = usePrecisionStartStore()
    const drone = useDroneStore()
    const id = ++this.runId
    const sessionId = this.makeSessionId()
    pstart.begin(sessionId)
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
      drone.addLog('INFO', '[PStart] Step 1: executing existing normal takeoff command without pitch/roll/yaw intervention')
      DroneControlService.takeoff()

      const hoverHeight = await this.waitForStableHover(id)
      if (hoverHeight == null || !this.isCurrent(id)) return
      pstart.state.hoverHeight = hoverHeight
      drone.addLog('INFO', `[PStart] stable hover height=${hoverHeight.toFixed(2)}m (relative to PStart zero)`)

      const { endHeight, heightStep } = usePrecisionStartSettings()
      const end = Math.max(1, Number(endHeight.value) || 20)
      const step = Math.max(0.5, Number(heightStep.value) || 5)
      const firstReference = this.roundHeight(hoverHeight + FIRST_REFERENCE_OFFSET_M)

      if (firstReference > end + TARGET_TOLERANCE_M) {
        this.abort(`Endhöhe ${end.toFixed(1)} m liegt unter dem ersten Referenzpunkt ${firstReference.toFixed(1)} m`)
        return
      }

      const targets = this.buildTargets(firstReference, step, end)
      drone.addLog('INFO', `[PStart] reference targets=${targets.map(v => v.toFixed(2)).join(' -> ')}m`)

      for (let index = 0; index < targets.length; index++) {
        if (!this.isCurrent(id)) return
        const target = targets[index]
        pstart.state.referenceIndex = index
        pstart.state.stepId = `REF_${index}`
        pstart.state.currentTargetHeight = target

        if (!await this.ascendTo(id, target)) return
        if (!this.isCurrent(id)) return

        if (!await this.ensureGimbalMinus90(id, true)) return
        if (!this.isCurrent(id)) return

        const stabilizationMs = Math.max(0, Number(usePrecisionStartSettings().stabilizationSeconds.value) || 0) * 1000
        pstart.state.phase = 'STABILIZE'
        pstart.state.status = `Referenz ${index + 1}: Stabilisierung bei ${target.toFixed(1)} m.`
        if (!await this.delayWithAbortCheck(id, stabilizationMs)) return

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

    pstart.state.phase = 'WAIT_HOVER'
    pstart.state.status = 'Normaler Start läuft - warte auf stabilen Schwebeflug.'

    while (Date.now() < deadline) {
      if (!this.isCurrent(id)) return null
      if (this.hardwareManualInputActive()) {
        this.abort('manueller Steuereingriff während des normalen Starts', 'manual')
        return null
      }
      const t = drone.telemetry
      const stable = !!t.flying && !t.takingOff && !t.landing && Math.abs(Number(t.verticalSpeed || 0)) <= HOVER_VERTICAL_SPEED_MPS
      if (stable) {
        if (!stableSince) stableSince = Date.now()
        if (Date.now() - stableSince >= HOVER_STABLE_MS) return this.relativeHeight(pstart.state.startVerticalDistance)
      } else {
        stableSince = 0
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
    if (target <= current + TARGET_TOLERANCE_M) {
      // Never descend. If telemetry already passed the target, continue with the next stage at current altitude.
      drone.addLog('WARN', `[PStart] target ${target.toFixed(2)}m already reached/passed at ${current.toFixed(2)}m; no descent commanded`)
      this.neutralThrottle()
      return true
    }

    pstart.state.phase = 'ASCEND'
    pstart.state.status = `Steige auf ${target.toFixed(1)} m - nur Throttle, kein Pitch/Roll/Yaw.`
    const deadline = Date.now() + ASCENT_TIMEOUT_MS
    this.startAutomaticAxes()

    while (Date.now() < deadline) {
      if (!this.isCurrent(id)) return false
      if (this.hardwareManualInputActive()) {
        this.abort('manueller Steuereingriff während des Aufstiegs', 'manual')
        return false
      }
      const height = this.relativeHeight(pstart.state.startVerticalDistance)
      const remaining = target - height
      if (remaining <= TARGET_TOLERANCE_M) {
        this.neutralThrottle()
        drone.addLog('INFO', `[PStart] target ${target.toFixed(2)}m reached at ${height.toFixed(2)}m; throttle neutral`)
        return true
      }

      // Vertical-only V1 control: softer throttle as the target approaches.
      const throttle = remaining > 1.0 ? 260 : remaining > 0.35 ? 160 : 90
      this.setAutoThrottle(throttle)
      await sleep(80)
    }

    this.neutralThrottle()
    this.abort(`Zielhöhe ${target.toFixed(1)} m konnte nicht innerhalb von 45 s erreicht werden`)
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
      if (!sent) DroneControlService.requestGimbalSettings()
      const deadline = Date.now() + GIMBAL_ATTEMPT_TIMEOUT_MS
      while (Date.now() < deadline) {
        if (!this.isCurrent(id)) return false
        if (airborne && this.hardwareManualInputActive()) {
          this.abort('manueller Steuereingriff während der Gimbal-Ausrichtung', 'manual')
          return false
        }
        if (this.gimbalIsReady()) {
          drone.addLog('INFO', `[PStart] gimbal -90° confirmed on attempt ${attempt}: ${Number(drone.telemetry.gimbalPitch || 0).toFixed(1)}°`)
          return true
        }
        await sleep(100)
      }
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
    })
    const heightLabel = context.targetHeight == null ? 'step0' : `${context.targetHeight.toFixed(1).replace('.', 'p')}m`
    const name = `PStart_${pstart.state.sessionId}_${context.stepId}_${heightLabel}_${zoomRole.toLowerCase()}.jpg`
    const source = context.referenceEligible ? 'pstart-reference' : 'pstart-documentation'
    const saved = await AndroidMediaService.savePrecisionSnapshot(metadata, name, source)
    if (!this.isCurrent(id)) return
    pstart.state.capturedImages += 1
    useDroneStore().addLog('INFO', `[PStart] image saved: ${saved.relativePath}/${saved.name}; verified=${saved.verified === true}`)
  }

  private static async setZoomAndWait(id: number, zoom: number) {
    const camera = useCameraStore()
    CameraMediaService.setZoom(zoom)
    const deadline = Date.now() + ZOOM_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (!this.isCurrent(id)) return
      const actual = Number(camera.zoomActual ?? camera.zoomTarget)
      if (!camera.zoomPending && Math.abs(actual - zoom) <= 0.05) return
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
      this.setAutoThrottle(remaining > 1 ? 260 : 120)
      await sleep(80)
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
    this.autoThrottle = Math.max(-1000, Math.min(1000, Math.round(value)))
    const drone = useDroneStore()
    drone.userJoysticks.throttle = this.autoThrottle
    drone.userJoysticks.yaw = 0
    drone.userJoysticks.pitch = 0
    drone.userJoysticks.roll = 0
    DroneControlService.sendJoysticks()
  }

  private static neutralThrottle() {
    this.autoThrottle = 0
    const drone = useDroneStore()
    drone.userJoysticks.throttle = 0
    drone.userJoysticks.yaw = 0
    drone.userJoysticks.pitch = 0
    drone.userJoysticks.roll = 0
    DroneControlService.sendJoysticks()
  }

  private static stopAutomaticAxes(sendNeutral: boolean) {
    if (this.axisTimer) {
      clearInterval(this.axisTimer)
      this.axisTimer = null
    }
    this.autoThrottle = 0
    if (sendNeutral) this.neutralThrottle()
  }

  private static async delayWithAbortCheck(id: number, ms: number): Promise<boolean> {
    const deadline = Date.now() + ms
    while (Date.now() < deadline) {
      if (!this.isCurrent(id)) return false
      if (this.hardwareManualInputActive()) {
        this.abort('manueller Steuereingriff während der Stabilisierung', 'manual')
        return false
      }
      await sleep(Math.min(100, Math.max(1, deadline - Date.now())))
    }
    return this.isCurrent(id)
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
