/**
 * High-Level Drone Control Service
 * Coordinates command construction and scheduled transmissions.
 */
import { UsbTransportService } from './UsbTransportService'
import { PacketBuilder } from '../protocol/PacketBuilder'
import { ByteUtils } from '../utils/ByteUtils'
import { useDroneStore } from '../stores/useDroneStore'
import { useCameraStore } from '../stores/useCameraStore'
import { AndroidMediaService } from './AndroidMediaService'
import { RecognitionMetadataService } from './RecognitionMetadataService'
import { CameraMediaService } from './CameraMediaService'

export class DroneControlService {
  private static transport = UsbTransportService.getInstance()

  // TAF tuning parameters for continuous gimbal target tracking. These values
  // deliberately describe controller behavior, not new protocol constants.
  private static readonly GIMBAL_TARGET_TOLERANCE_DEG = 1.0
  private static readonly GIMBAL_TELEMETRY_MAX_AGE_MS = 3500
  private static readonly GIMBAL_MIN_COMMAND = 140
  private static readonly GIMBAL_MAX_COMMAND = 650
  private static readonly GIMBAL_SLOW_ZONE_DEG = 18
  private static readonly GIMBAL_DIRECTION = 1
  private static lastGimbalLogAt = 0
  private static lastGimbalLoggedCommand = Number.NaN

  static sendPacketWithRepeats(bytes: Uint8Array, repeats = 1, intervalMs = 50) {
    let sent = 0
    const execute = () => {
      this.transport.send(bytes)
      sent++
      if (sent < repeats) {
        setTimeout(execute, intervalMs)
      }
    }
    execute()
  }

  // === Flight Actions ===

  private static logCtrlAction(action: string, packet: Uint8Array) {
    const store = useDroneStore()
    const feType = packet.length > 7 ? packet[7] : -1
    const functionId = packet.length > 21 ? (packet[20] | (packet[21] << 8)) : -1
    // New-FC FF-FD frame starts at FE payload +0; its application payload begins at +6.
    const ctrlPayload = packet.length >= 54 ? packet.slice(22, 54) : new Uint8Array(0)
    store.addLog(
      'INFO',
      `[Flight TX] action=${action} FE=0x${feType.toString(16).padStart(2, '0')} ` +
      `function=0x${functionId.toString(16).padStart(4, '0')} payloadLen=${ctrlPayload.length} ` +
      `payload=${ByteUtils.bytesToHex(ctrlPayload)} frame=${ByteUtils.bytesToHex(packet)}`
    )
  }

  static takeoff() {
    const packet = PacketBuilder.buildTakeoff()
    this.logCtrlAction('Takeoff', packet)
    this.transport.send(packet)
  }

  static land() {
    const packet = PacketBuilder.buildLand()
    this.logCtrlAction('Land', packet)
    this.transport.send(packet)
  }

  static cancelLand() {
    const packet = PacketBuilder.buildCancelLand()
    this.logCtrlAction('Cancel Land', packet)
    this.transport.send(packet)
  }

  static rth() {
    const packet = PacketBuilder.buildRTH()
    this.logCtrlAction('RTH', packet)
    this.transport.send(packet)
  }

  static cancelRth() {
    const packet = PacketBuilder.buildCancelRTH()
    this.logCtrlAction('Cancel Auto Fly', packet)
    this.transport.send(packet)
  }

  static emergencyStop() {
    const store = useDroneStore()
    store.addLog('WARN', 'Send Emergency Stop command (repeat 30 times)')
    const packet = PacketBuilder.buildEmergencyStop()
    this.sendPacketWithRepeats(packet, 30, 30)
  }

  // === PotensicPro flight settings, calibration and intelligent modes ===

  static applyFlightSettings(values: { limitHeight:number; limitDistance:number; returnHeight:number; beginnerMode:boolean; americaRockerMode:boolean; surroundRadius:number; clockwise:boolean; surroundSpeed:number; speedMode:number }) {
    const store = useDroneStore()
    store.addLog('INFO', `Apply flight settings: H=${values.limitHeight}m D=${values.limitDistance}m RTH=${values.returnHeight}m`)
    this.sendPacketWithRepeats(PacketBuilder.buildFlightSettings(values), 3, 80)
  }

  static setFollowMode() {
    useDroneStore().addLog('INFO', 'Toggle Follow mode (Potensic ctrl type 7)')
    this.transport.send(PacketBuilder.buildFollowToggle())
  }

  static setCircleMode() {
    useDroneStore().addLog('INFO', 'Toggle Circle mode (Potensic ctrl type 6)')
    this.transport.send(PacketBuilder.buildCircleToggle())
  }

  static setPointFlyMode() {
    useDroneStore().addLog('INFO', 'Toggle Point Fly mode (Potensic ctrl type 5)')
    this.transport.send(PacketBuilder.buildPointFlyToggle())
  }

  static cancelAutoFly() {
    useDroneStore().addLog('INFO', 'Cancel intelligent flight mode (Potensic ctrl type 99)')
    this.transport.send(PacketBuilder.buildCancelAutoFly())
  }

  static uploadMultiPoint(points: Array<{lat:number; lng:number}>) {
    const store = useDroneStore()
    store.addLog('INFO', `Upload ${points.length} waypoint(s) using Potensic function 6`)
    this.transport.send(PacketBuilder.buildMultiPoint(points))
  }

  static requestGimbalSettings() {
    useDroneStore().addLog('INFO', 'Request current gimbal settings (general command 8)')
    this.transport.send(PacketBuilder.buildGeneralCommand(8, 0))
  }

  /**
   * Set one of the three pitch presets used by the original Potensic app.
   * FlightRevGimbalSettingData: 1=0°, 3=-45°, 2=-90°. Existing synchronized
   * gimbal settings are preserved exactly as the app does.
   */
  static setGimbalPitchPreset(angle: 0 | -45 | -90): boolean {
    const store = useDroneStore()
    // Presets remain on the existing Function 0x1A path and explicitly leave
    // continuous Send4Axis target tracking.
    store.gimbalControl.mode = 'preset'
    store.gimbalControl.targetAngle = angle
    store.gimbalControl.active = false
    store.gimbalControl.command = 0
    const t = store.telemetry
    if (!t.gimbalSettingsValid) {
      store.addLog('WARN', `Gimbal ${angle}° not sent: waiting for synchronized gimbal settings`)
      this.requestGimbalSettings()
      return false
    }
    const pitchControl = angle === 0 ? 1 : angle === -45 ? 3 : 2
    const packet = PacketBuilder.buildGimbalSettings({
      pitchControl,
      pitchSpeed: t.gimbalPitchSpeed || 0,
      stableMode: t.gimbalStableMode !== false,
      fpvSmooth: t.gimbalFpvSmooth || 0,
      calibration: 0,
      tuningRoll: t.gimbalTuningRoll || 0,
      tuningYaw: t.gimbalTuningYaw || 0,
      reset: 0
    })
    store.addLog('INFO', `Set gimbal pitch preset ${angle}° (Potensic function 0x1A, pitchControl=${pitchControl})`)
    this.transport.send(packet)
    return true
  }

  static setContinuousGimbalTarget(angle: number): boolean {
    const store = useDroneStore()
    if (!Number.isFinite(angle)) return false
    const target = Math.max(-90, Math.min(30, Math.round(angle * 10) / 10))
    store.gimbalControl.targetAngle = target
    store.gimbalControl.mode = 'continuous'

    const actual = store.telemetry.gimbalPitch
    const age = Date.now() - store.gimbalControl.telemetryUpdatedAt
    if (!store.connection.usbConnected || !store.telemetry.gimbalStateValid || !Number.isFinite(actual) || age > this.GIMBAL_TELEMETRY_MAX_AGE_MS) {
      store.gimbalControl.active = false
      store.gimbalControl.command = 0
      store.addLog('WARN', `[Gimbal control] target=${target.toFixed(1)}° not activated: valid/fresh gimbal telemetry required`)
      return false
    }

    if (!store.gimbalControl.active) {
      store.addLog('INFO', `[Gimbal control] continuous target activated: target=${target.toFixed(1)}° actual=${Number(actual).toFixed(1)}°`)
    }
    store.gimbalControl.active = true
    return true
  }

  static stopContinuousGimbal(reason = 'stopped', level: 'INFO' | 'WARN' = 'INFO') {
    const store = useDroneStore()
    const wasActive = store.gimbalControl.active || store.gimbalControl.command !== 0
    store.gimbalControl.active = false
    store.gimbalControl.command = 0
    if (wasActive) store.addLog(level, `[Gimbal control] neutral: ${reason}`)
  }

  private static updateContinuousGimbalControl(): number {
    const store = useDroneStore()
    if (!store.gimbalControl.active) {
      store.gimbalControl.command = 0
      return 0
    }

    if (!store.connection.usbTransportOpen || !store.connection.usbConnected) {
      this.stopContinuousGimbal('connection lost', 'WARN')
      return 0
    }

    const actual = store.telemetry.gimbalPitch
    const age = Date.now() - store.gimbalControl.telemetryUpdatedAt
    if (!store.telemetry.gimbalStateValid || !Number.isFinite(actual) || age > this.GIMBAL_TELEMETRY_MAX_AGE_MS) {
      this.stopContinuousGimbal(`gimbal telemetry invalid/stale (${Math.max(0, age)} ms)`, 'WARN')
      return 0
    }

    const error = store.gimbalControl.targetAngle - Number(actual)
    if (Math.abs(error) <= this.GIMBAL_TARGET_TOLERANCE_DEG) {
      this.stopContinuousGimbal(`target reached: target=${store.gimbalControl.targetAngle.toFixed(1)}° actual=${Number(actual).toFixed(1)}° error=${error.toFixed(1)}°`)
      return 0
    }

    const proportional = Math.min(1, Math.abs(error) / this.GIMBAL_SLOW_ZONE_DEG)
    const magnitude = Math.round(this.GIMBAL_MIN_COMMAND + proportional * (this.GIMBAL_MAX_COMMAND - this.GIMBAL_MIN_COMMAND))
    const command = Math.sign(error) * magnitude * this.GIMBAL_DIRECTION
    store.gimbalControl.command = command

    const now = Date.now()
    if (now - this.lastGimbalLogAt >= 400 || command !== this.lastGimbalLoggedCommand) {
      store.addLog('INFO', `[Gimbal control] target=${store.gimbalControl.targetAngle.toFixed(1)}° actual=${Number(actual).toFixed(1)}° error=${error.toFixed(1)}° axis=${command}`)
      this.lastGimbalLogAt = now
      this.lastGimbalLoggedCommand = command
    }
    return command
  }

  static calibrateGimbal() {
    const store = useDroneStore()
    const t = store.telemetry
    if (!t.gimbalSettingsValid) {
      store.addLog('WARN', 'Gimbal calibration not sent: current gimbal settings have not been received yet')
      this.requestGimbalSettings()
      return false
    }
    const packet = PacketBuilder.buildGimbalSettings({
      pitchControl: t.gimbalPitchControl || 0,
      pitchSpeed: t.gimbalPitchSpeed || 0,
      stableMode: t.gimbalStableMode !== false,
      fpvSmooth: t.gimbalFpvSmooth || 0,
      calibration: 1,
      tuningRoll: t.gimbalTuningRoll || 0,
      tuningYaw: t.gimbalTuningYaw || 0,
      reset: 0
    })
    store.addLog('INFO', 'Start gimbal auto calibration using synchronized gimbal settings')
    this.transport.send(packet)
    return true
  }

  static setImuCalibrationOfficial(start: boolean) {
    useDroneStore().addLog('INFO', `${start ? 'Start' : 'Stop'} IMU calibration (Potensic general command 6)`)
    this.sendPacketWithRepeats(PacketBuilder.buildImuCalibrationOfficial(start), 3, 100)
  }

  static setRemoteCalibration(open: boolean) {
    useDroneStore().addLog('INFO', `${open ? 'Enter' : 'Exit'} RC calibration (Potensic remoter function 113)`)
    this.sendPacketWithRepeats(PacketBuilder.buildRemoteCalibration(open), 3, 100)
  }

  static setCompassCalibrationSession(enter: boolean) {
    const store = useDroneStore()
    // PotensicPro's Mini/ATOM magnetometer workflow enters/quits with function 24.
    // The actual calibration solution is calculated by the manufacturer's JNI code and cannot be recreated byte-for-byte here.
    store.addLog('INFO', `${enter ? 'Enter' : 'Exit'} compass calibration session (Potensic function 24)`)
    this.sendPacketWithRepeats(PacketBuilder.buildEnterCalibration(enter), 3, 100)
  }

  static setFindDroneBeep(start: boolean) {
    useDroneStore().addLog('INFO', `${start ? 'Start' : 'Stop'} Find My Drone beeper (Potensic general command 2)`)
    this.transport.send(PacketBuilder.buildFindDroneBeep(start))
  }

  // === Camera Actions ===

  static takePhoto() {
    CameraMediaService.takePhoto()
  }

  static startRecord() {
    CameraMediaService.startRecord()
  }

  static stopRecord() {
    CameraMediaService.stopRecord()
  }

  static toggleRecord() {
    const camera = useCameraStore()
    if (camera.recording) this.stopRecord()
    else this.startRecord()
  }

  static async saveLiveSnapshotToAndroid() {
    const store = useDroneStore()
    try {
      const saved = await AndroidMediaService.saveLiveSnapshot(RecognitionMetadataService.build('LIVE_RECO'))
      store.addLog('INFO', `Live snapshot saved on Android: ${saved.relativePath}/${saved.name}`)
    } catch (e: any) {
      store.addLog('ERROR', `Live snapshot save failed: ${e?.message || e}`)
    }
  }

  static requestIdr() {
    const store = useDroneStore()
    if (!store.connection.usbTransportOpen) {
      store.addLog('WARN', 'IDR request skipped: USB accessory is not open')
      return
    }
    const host = store.normalizedHost
    const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'
    fetch(`${httpProto}//${host}/api/video/request-idr`, { method: 'POST' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        store.addLog('INFO', 'Requested video keyframe (IDR)')
      })
      .catch((e) => store.addLog('WARN', `IDR request failed: ${e.message}`))
  }

  static initLiveView() {
    const store = useDroneStore()
    store.addLog('INFO', 'Send video initialization parameters')
    this.transport.send(PacketBuilder.buildLiveViewParams())
  }

  static activateLiveView(preferH265 = true) {
    const store = useDroneStore()
    if (!store.connection.usbTransportOpen) {
      store.addLog('WARN', 'LiveView activation deferred: USB accessory is not open')
      return
    }

    const host = store.normalizedHost
    const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'
    const codecName = preferH265 ? 'H.265 preferred' : 'compatibility decode'
    store.addLog('INFO', `Requesting backend LiveView activation (${codecName})...`)

    // The Android backend owns the initialization sequence. Sending the same camera
    // commands simultaneously from browser and backend can interleave USB writes.
    fetch(`${httpProto}//${host}/api/video/activate?codec=${preferH265 ? 'h265' : 'h264'}`, { method: 'POST' })
      .then(async r => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok || !body.activated) throw new Error(body.error || `HTTP ${r.status}`)
        store.addLog('INFO', 'Backend LiveView activation sequence started')
      })
      .catch((e) => store.addLog('WARN', `LiveView activation failed: ${e.message}`))
  }

  static sendHeartbeat() {
    this.transport.send(PacketBuilder.buildHeartbeat())
  }

  // === Custom Hex Injection ===

  static sendRawHex(hex: string, repeats = 1, intervalMs = 50) {
    const store = useDroneStore()
    const clean = hex.replace(/[\s\r\n]/g, '')
    if (!clean) return
    const bytes = ByteUtils.hexToBytes(clean)
    store.addLog('INFO', `Inject custom HEX data (${bytes.length} bytes, repeat ${repeats} times)`)
    this.sendPacketWithRepeats(bytes, repeats, intervalMs)
  }

  // === Joysticks Transmission ===

  static sendJoysticks() {
    const store = useDroneStore()
    const packet = PacketBuilder.buildFourAxisControl(
      store.userJoysticks.throttle,
      store.userJoysticks.yaw,
      store.userJoysticks.pitch,
      store.userJoysticks.roll,
      this.updateContinuousGimbalControl()
    )
    this.transport.send(packet)
  }


  static async getDroneProfile() {
    const store = useDroneStore()
    const host = store.normalizedHost
    const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'
    const r = await fetch(`${httpProto}//${host}/api/drone/profile`, { signal: AbortSignal.timeout(2500) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  }

  static async setDroneProfile(model: 'ATOM' | 'ATOM_2') {
    const store = useDroneStore()
    const host = store.normalizedHost
    const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'
    const r = await fetch(`${httpProto}//${host}/api/drone/profile?model=${model}`, { method: 'POST' })
    const body = await r.json().catch(() => ({}))
    if (!r.ok || !body.changed) throw new Error(body.error || `HTTP ${r.status}`)
    return body
  }

  // === Engineering & Debug Actions ===

  /**
   * Send Camera Interactive Debug Command (0x1200 / 0x6F)
   */
  static sendCameraTerminal(opcode: number, paramStr: string) {
    const store = useDroneStore()
    store.addLog('INFO', `[Camera terminal TX] OpCode=${opcode}, Cmd="${paramStr}"`)
    const packet = PacketBuilder.buildCameraTerminalCommand(opcode, paramStr)
    this.transport.send(packet)
  }

  /**
   * Send Custom FPV Command (HEX) (5696 / 0x1640)
   */
  static sendFpvCustomHex(hexStr: string) {
    const store = useDroneStore()
    const clean = hexStr.replace(/[\s\r\n]/g, '')
    store.addLog('INFO', `[Custom video-link command] Send: ${clean}`)
    const packet = PacketBuilder.buildFpvCustomHex(clean)
    this.transport.send(packet)
  }

  /**
   * Toggle Factory Flight Mode (5640 / 0x1608)
   */
  static setFpvFactoryFlyMode(enable: boolean) {
    const store = useDroneStore()
    store.addLog('INFO', `[Factory flight mode] Set: ${enable ? 'Enabled' : 'Disabled'}`)
    const packet = PacketBuilder.buildFpvFactoryFlyMode(enable)
    this.transport.send(packet)
  }

  /**
   * Set FPV Bandwidth (5652 / 0x1614)
   */
  static setFpvBandwidth(isOpen: boolean, bandwidthMhz: number) {
    const store = useDroneStore()
    store.addLog('INFO', `[Video bandwidth setting] switch=${isOpen}, bandwidth=${bandwidthMhz}MHz`)
    const packet = PacketBuilder.buildFpvBandwidth(isOpen, bandwidthMhz)
    this.transport.send(packet)
  }

  /**
   * Allow All Frequencies / Full Bands Unlock (5658 / 0x161A)
   */
  static allowAllRfFrequencies() {
    const store = useDroneStore()
    store.addLog('WARN', '[All-band unlock] Send command to remove band restrictions (5658)')
    const packet = PacketBuilder.buildRfAllowAllFrequencies()
    this.sendPacketWithRepeats(packet, 3, 50)
  }

  /**
   * RF Hardware Reset & Reboot (5650 / 0x1612)
   */
  static resetRf() {
    const store = useDroneStore()
    store.addLog('WARN', '[RF reset] Send RF reset command "reset\\n" (5650)')
    const packet = PacketBuilder.buildRfReset()
    this.sendPacketWithRepeats(packet, 3, 50)
  }

  /**
   * Toggle RF Real-time Probe Stream (5656 / 0x1618 -> 5913 / 0x1719)
   */
  static toggleRfProbeStream(enable: boolean) {
    const store = useDroneStore()
    store.addLog('INFO', `[RF spectrum probing] ${enable ? 'Enabled' : 'Stop'}real-time parameter reporting stream (5656)`)
    const packet = PacketBuilder.buildRfProbe(enable)
    this.transport.send(packet)
  }

  /**
   * Enter RF Test Mode (5642 / 0x160A)
   */
  static enterRfTest() {
    const store = useDroneStore()
    store.addLog('INFO', '[RF test] Enter RF test mode (5642)')
    const packet = PacketBuilder.buildEnterRfTest()
    this.transport.send(packet)
  }

  /**
   * Start IMU Calibration (0x0301 / Subcmd 23, action=3)
   */
  static startImuCalibration() {
    const store = useDroneStore()
    store.addLog('INFO', '[IMU calibration] Start IMU sensor calibration')
    const packet = PacketBuilder.buildImuCalibration(3)
    this.sendPacketWithRepeats(packet, 5, 50)
  }

  /**
   * Stop IMU Calibration (0x0301 / Subcmd 23, action=2)
   */
  static stopImuCalibration() {
    const store = useDroneStore()
    store.addLog('INFO', '[IMU calibration] Stop IMU sensor calibration')
    const packet = PacketBuilder.buildImuCalibration(2)
    this.sendPacketWithRepeats(packet, 3, 50)
  }

  /**
   * Gimbal Clear IMU (0x0801 / 5)
   */
  static clearGimbalImu() {
    const store = useDroneStore()
    store.addLog('INFO', '[Gimbal control] Clear gimbal IMU calibration data')
    const packet = PacketBuilder.buildGimbalClearImu()
    this.sendPacketWithRepeats(packet, 3, 50)
  }

  /**
   * Camera DPC Bad Pixel Calibration (0x1200 / 0x6E)
   */
  static startCameraDpc(isDark: boolean, step = 0) {
    const store = useDroneStore()
    store.addLog('INFO', `[Camera calibration] Start step ${step}${isDark ? 'dark-frame ' : 'bright-frame '}defective-pixel detection (DPC)`)
    const packet = PacketBuilder.buildCameraDpcCheck(isDark, step)
    this.transport.send(packet)
  }

  /**
   * Camera FPN Calibration (0x1200 / 0x74)
   */
  static startCameraFpn() {
    const store = useDroneStore()
    store.addLog('INFO', '[Camera calibration] Start FPN fixed-pattern-noise calibration')
    const packet = PacketBuilder.buildCameraFpnCheck()
    this.transport.send(packet)
  }

  /**
   * Query Remote ID (0x1200 / 115)
   */
  static queryRemoteId() {
    const store = useDroneStore()
    store.addLog('INFO', '[Remote ID] Query aircraft Remote ID (RID) parameters')
    const packet = PacketBuilder.buildRemoteIdQuery()
    this.transport.send(packet)
  }

  /**
   * GPS Test Mode (0x0301 / Subcmd 23)
   */
  static setGpsTest(enable: boolean) {
    const store = useDroneStore()
    store.addLog('INFO', `[GPS test] Set GPS test feature: ${enable ? 'Enabled' : 'Disabled'}`)
    const packet = PacketBuilder.buildGpsTestControl(enable)
    this.transport.send(packet)
  }

  /**
   * Beidou Satellite Switch (0x0301 / Subcmd 24)
   */
  static setBeidou(enable: boolean) {
    const store = useDroneStore()
    store.addLog('INFO', `[BeiDou] Set BeiDou system: ${enable ? 'Enabled' : 'Disabled'}`)
    const packet = PacketBuilder.buildBeidouSwitch(enable)
    this.transport.send(packet)
  }
}


