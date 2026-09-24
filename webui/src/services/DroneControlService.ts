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
    store.addLog('INFO', '发送起飞指令 (重复 20 次)')
    const packet = PacketBuilder.buildTakeoff()
    this.sendPacketWithRepeats(packet, 20, 50)
  }

  static land() {
    const store = useDroneStore()
    store.addLog('INFO', '发送降落指令 (重复 20 次)')
    const packet = PacketBuilder.buildLand()
    this.sendPacketWithRepeats(packet, 20, 50)
  }

  static rth() {
    const store = useDroneStore()
    store.addLog('INFO', '发送返航指令 (重复 20 次)')
    const packet = PacketBuilder.buildRTH()
    this.sendPacketWithRepeats(packet, 20, 50)
  }

  static cancelRth() {
    const store = useDroneStore()
    store.addLog('INFO', '取消返航')
    const packet = PacketBuilder.buildCancelRTH()
    this.sendPacketWithRepeats(packet, 5, 50)
  }

  static emergencyStop() {
    const store = useDroneStore()
    store.addLog('WARN', '发送紧急急停指令 (重复 30 次)')
    const packet = PacketBuilder.buildEmergencyStop()
    this.sendPacketWithRepeats(packet, 30, 30)
  }

  // === Camera Actions ===

  static takePhoto() {
    const store = useDroneStore()
    store.addLog('INFO', '发送拍照指令')
    this.transport.send(PacketBuilder.buildTakePhoto())
  }

  static toggleRecord() {
    const store = useDroneStore()
    store.addLog('INFO', '切换录像开关')
    this.transport.send(PacketBuilder.buildToggleRecord())
  }

  static requestIdr() {
    const store = useDroneStore()
    store.addLog('INFO', '请求关键帧 (IDR)')
    this.transport.send(PacketBuilder.buildIdrRequest())
    const host = store.normalizedHost
    const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'
    fetch(`${httpProto}//${host}/api/video/request-idr`, { method: 'POST' }).catch(() => {})
  }

  static initLiveView() {
    const store = useDroneStore()
    store.addLog('INFO', '发送图传初始化参数')
    this.transport.send(PacketBuilder.buildLiveViewParams())
  }

  static activateLiveView(preferH265 = true) {
    const store = useDroneStore()
    const codecName = preferH265 ? 'H.265 (HEVC)' : 'H.264 (AVC 兼容)'
    store.addLog('INFO', `正在执行无人机相机唤醒与推流激活序列 [${codecName}] (InitSequence + 1080P Params + IDR)...`)

    // 1. Send official full initialization sequence
    const initSeq = PacketBuilder.buildInitSequence(preferH265)
    initSeq.forEach((pkt, idx) => {
      setTimeout(() => {
        this.transport.send(pkt)
      }, idx * 40)
    })

    const baseDelay = initSeq.length * 40 + 60

    // 2. Send 1080P 10240Kbps LiveView parameters
    setTimeout(() => {
      this.transport.send(PacketBuilder.buildLiveViewParams(preferH265, 10240))
    }, baseDelay)

    // 3. Request initial keyframe (IDR) multiple times
    setTimeout(() => {
      this.transport.send(PacketBuilder.buildIdrRequest())
    }, baseDelay + 80)

    setTimeout(() => {
      this.transport.send(PacketBuilder.buildIdrRequest())
    }, baseDelay + 250)

    setTimeout(() => {
      this.transport.send(PacketBuilder.buildIdrRequest())
    }, baseDelay + 500)

    // 4. Send heartbeat to ensure link stays active
    setTimeout(() => {
      this.transport.send(PacketBuilder.buildHeartbeat())
    }, baseDelay + 700)
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
    store.addLog('INFO', `注入自定义 HEX 数据 (${bytes.length} 字节, 重复 ${repeats} 次)`)
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

  // === Engineering & Debug Actions ===

  /**
   * Send Camera Interactive Debug Command (0x1200 / 0x6F)
   */
  static sendCameraTerminal(opcode: number, paramStr: string) {
    const store = useDroneStore()
    store.addLog('INFO', `[相机终端发送] OpCode=${opcode}, Cmd="${paramStr}"`)
    const packet = PacketBuilder.buildCameraTerminalCommand(opcode, paramStr)
    this.transport.send(packet)
  }

  /**
   * Send Custom FPV Command (HEX) (5696 / 0x1640)
   */
  static sendFpvCustomHex(hexStr: string) {
    const store = useDroneStore()
    const clean = hexStr.replace(/[\s\r\n]/g, '')
    store.addLog('INFO', `[图传自定义命令] 发送: ${clean}`)
    const packet = PacketBuilder.buildFpvCustomHex(clean)
    this.transport.send(packet)
  }

  /**
   * Toggle Factory Flight Mode (5640 / 0x1608)
   */
  static setFpvFactoryFlyMode(enable: boolean) {
    const store = useDroneStore()
    store.addLog('INFO', `[工厂飞行模式] 设置: ${enable ? '开启' : '关闭'}`)
    const packet = PacketBuilder.buildFpvFactoryFlyMode(enable)
    this.transport.send(packet)
  }

  /**
   * Set FPV Bandwidth (5652 / 0x1614)
   */
  static setFpvBandwidth(isOpen: boolean, bandwidthMhz: number) {
    const store = useDroneStore()
    store.addLog('INFO', `[图传频宽设置] 开关=${isOpen}, 频宽=${bandwidthMhz}MHz`)
    const packet = PacketBuilder.buildFpvBandwidth(isOpen, bandwidthMhz)
    this.transport.send(packet)
  }

  /**
   * Allow All Frequencies / Full Bands Unlock (5658 / 0x161A)
   */
  static allowAllRfFrequencies() {
    const store = useDroneStore()
    store.addLog('WARN', '[全频段解锁] 发送解除所有频段限制指令 (5658)')
    const packet = PacketBuilder.buildRfAllowAllFrequencies()
    this.sendPacketWithRepeats(packet, 3, 50)
  }

  /**
   * RF Hardware Reset & Reboot (5650 / 0x1612)
   */
  static resetRf() {
    const store = useDroneStore()
    store.addLog('WARN', '[射频复位] 发送射频复位指令 "reset\\n" (5650)')
    const packet = PacketBuilder.buildRfReset()
    this.sendPacketWithRepeats(packet, 3, 50)
  }

  /**
   * Toggle RF Real-time Probe Stream (5656 / 0x1618 -> 5913 / 0x1719)
   */
  static toggleRfProbeStream(enable: boolean) {
    const store = useDroneStore()
    store.addLog('INFO', `[射频频谱探测] ${enable ? '开启' : '停止'}实时参数上报流 (5656)`)
    const packet = PacketBuilder.buildRfProbe(enable)
    this.transport.send(packet)
  }

  /**
   * Enter RF Test Mode (5642 / 0x160A)
   */
  static enterRfTest() {
    const store = useDroneStore()
    store.addLog('INFO', '[射频测试] 进入射频测试模式 (5642)')
    const packet = PacketBuilder.buildEnterRfTest()
    this.transport.send(packet)
  }

  /**
   * Start IMU Calibration (0x0301 / Subcmd 23, action=3)
   */
  static startImuCalibration() {
    const store = useDroneStore()
    store.addLog('INFO', '[IMU标定] 启动 IMU 传感器标定流程')
    const packet = PacketBuilder.buildImuCalibration(3)
    this.sendPacketWithRepeats(packet, 5, 50)
  }

  /**
   * Stop IMU Calibration (0x0301 / Subcmd 23, action=2)
   */
  static stopImuCalibration() {
    const store = useDroneStore()
    store.addLog('INFO', '[IMU标定] 停止 IMU 传感器标定流程')
    const packet = PacketBuilder.buildImuCalibration(2)
    this.sendPacketWithRepeats(packet, 3, 50)
  }

  /**
   * Gimbal Clear IMU (0x0801 / 5)
   */
  static clearGimbalImu() {
    const store = useDroneStore()
    store.addLog('INFO', '[云台控制] 清除云台 IMU 标定数据')
    const packet = PacketBuilder.buildGimbalClearImu()
    this.sendPacketWithRepeats(packet, 3, 50)
  }

  /**
   * Camera DPC Bad Pixel Calibration (0x1200 / 0x6E)
   */
  static startCameraDpc(isDark: boolean, step = 0) {
    const store = useDroneStore()
    store.addLog('INFO', `[相机标定] 开始第 ${step} 步${isDark ? '暗场' : '亮场'}坏点检测 (DPC)`)
    const packet = PacketBuilder.buildCameraDpcCheck(isDark, step)
    this.transport.send(packet)
  }

  /**
   * Camera FPN Calibration (0x1200 / 0x74)
   */
  static startCameraFpn() {
    const store = useDroneStore()
    store.addLog('INFO', '[相机标定] 开始 FPN 固定模式噪声消除校准')
    const packet = PacketBuilder.buildCameraFpnCheck()
    this.transport.send(packet)
  }

  /**
   * Query Remote ID (0x1200 / 115)
   */
  static queryRemoteId() {
    const store = useDroneStore()
    store.addLog('INFO', '[Remote ID] 查询无人机远程识别 (RID) 参数')
    const packet = PacketBuilder.buildRemoteIdQuery()
    this.transport.send(packet)
  }

  /**
   * GPS Test Mode (0x0301 / Subcmd 23)
   */
  static setGpsTest(enable: boolean) {
    const store = useDroneStore()
    store.addLog('INFO', `[GPS测试] 设置 GPS 测试功能: ${enable ? '开启' : '关闭'}`)
    const packet = PacketBuilder.buildGpsTestControl(enable)
    this.transport.send(packet)
  }

  /**
   * Beidou Satellite Switch (0x0301 / Subcmd 24)
   */
  static setBeidou(enable: boolean) {
    const store = useDroneStore()
    store.addLog('INFO', `[北斗卫星] 设置北斗系统: ${enable ? '开启' : '关闭'}`)
    const packet = PacketBuilder.buildBeidouSwitch(enable)
    this.transport.send(packet)
  }
}

