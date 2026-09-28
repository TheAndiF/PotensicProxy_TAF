/**
 * High-Level Drone Control Service
 * Coordinates command construction and scheduled transmissions.
 */
import { UsbTransportService } from './UsbTransportService'
import { PacketBuilder } from '../protocol/PacketBuilder'
import { ByteUtils } from '../utils/ByteUtils'
import { useDroneStore } from '../stores/useDroneStore'

export class DroneControlService {
  private static transport = UsbTransportService.getInstance()

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

  static takeoff() {
    const store = useDroneStore()
    store.addLog('INFO', 'Send takeoff command (repeat 20 times)')
    const packet = PacketBuilder.buildTakeoff()
    this.sendPacketWithRepeats(packet, 20, 50)
  }

  static land() {
    const store = useDroneStore()
    store.addLog('INFO', 'Send landing command (repeat 20 times)')
    const packet = PacketBuilder.buildLand()
    this.sendPacketWithRepeats(packet, 20, 50)
  }

  static rth() {
    const store = useDroneStore()
    store.addLog('INFO', 'Send RTH command (repeat 20 times)')
    const packet = PacketBuilder.buildRTH()
    this.sendPacketWithRepeats(packet, 20, 50)
  }

  static cancelRth() {
    const store = useDroneStore()
    store.addLog('INFO', 'Cancel RTH')
    const packet = PacketBuilder.buildCancelRTH()
    this.sendPacketWithRepeats(packet, 5, 50)
  }

  static emergencyStop() {
    const store = useDroneStore()
    store.addLog('WARN', 'Send Emergency Stop command (repeat 30 times)')
    const packet = PacketBuilder.buildEmergencyStop()
    this.sendPacketWithRepeats(packet, 30, 30)
  }

  // === Camera Actions ===

  static takePhoto() {
    const store = useDroneStore()
    store.addLog('INFO', 'Send photo command')
    this.transport.send(PacketBuilder.buildTakePhoto())
  }

  static toggleRecord() {
    const store = useDroneStore()
    store.addLog('INFO', 'Toggle recording')
    this.transport.send(PacketBuilder.buildToggleRecord())
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
    const packet = PacketBuilder.buildCombinedControl(
      store.userJoysticks.throttle,
      store.userJoysticks.yaw,
      store.userJoysticks.pitch,
      store.userJoysticks.roll,
      store.userJoysticks.gimbal || 0
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


