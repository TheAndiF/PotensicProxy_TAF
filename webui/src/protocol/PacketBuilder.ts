/**
 * Packet Construction Engine
 * Implements binary packet creation for all drone commands in pure TypeScript/Vue.
 */
import { FeTransport } from './FeTransport'
import { FfFdCommand } from './FfFdCommand'
import { PROTOCOL_HEX, CAMERA_CMDS, CMD_SHORTS } from './DroneProtocol'
import { ByteUtils } from '../utils/ByteUtils'

export class PacketBuilder {
  private static sequence = 125

  static nextSequence(): number {
    const s = this.sequence
    this.sequence = (this.sequence + 1) % 65536
    return s
  }

  // === Flight Commands ===

  static buildFlightCommand(group: number, subcmd: number): Uint8Array {
    const seq = this.nextSequence()
    const data = new Uint8Array([0x04, seq & 0xFF, (seq >> 8) & 0xFF, group & 0xFF, subcmd & 0xFF])
    const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FLIGHT, data)
    return FeTransport.wrap(inner, 0x14)
  }

  static buildTakeoff(): Uint8Array {
    return this.buildFlightCommand(0x01, 0x01)
  }

  static buildLand(): Uint8Array {
    return this.buildFlightCommand(0x02, 0x01)
  }

  static buildRTH(): Uint8Array {
    return this.buildFlightCommand(0x03, 0x01)
  }

  static buildCancelRTH(): Uint8Array {
    return this.buildFlightCommand(0x03, 0x00)
  }

  static buildEmergencyStop(): Uint8Array {
    return this.buildFlightCommand(0x01, 0x00)
  }

  // === Camera Commands ===

  static buildTakePhoto(): Uint8Array {
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.TAKE_PHOTO, null, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  static buildToggleRecord(): Uint8Array {
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.TOGGLE_RECORD, null, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  static buildIdrRequest(): Uint8Array {
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.REQUEST_IDR, null, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  static buildCameraGetAllParams(): Uint8Array {
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.GET_ALL_PARAMS, null, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  /**
   * Set Camera Function Switch (0x1200 / Subcmd 0x16)
   * Official implementation: i80.C4(boolean z) -> CameraFunction
   * Byte 0: mask (0x34 for preview + h265)
   * Byte 1: values (bit 2 = isPreviewOpen, bit 4 = isH265Open, bit 5 = isH265PreviewOpen)
   */
  static buildCameraFunction(enablePreview = true, enableH265 = true): Uint8Array {
    const mask = (enablePreview ? 0x04 : 0) | (enableH265 ? 0x30 : 0x00) | 0x04
    const bits = (enablePreview ? 0x04 : 0) | (enableH265 ? 0x30 : 0x00)
    const data = new Uint8Array([mask & 0xff, bits & 0xff, 0x00, 0x00])
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.CAMERA_FUNCTION, data, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  /**
   * Set LiveView Parameters (0x1200 / Subcmd 0xD8)
   * Official implementation: sd3.java -> h264Level(1B), h264Rate LE(2B), h265Level(1B), h265Rate LE(2B)
   */
  static buildLiveViewParams(h265 = true, bitrateKbps = 10240): Uint8Array {
    const data = new Uint8Array(6)
    data[0] = 0x00 // 1080P
    data[1] = bitrateKbps & 0xff // Little-Endian low byte
    data[2] = (bitrateKbps >> 8) & 0xff // Little-Endian high byte
    data[3] = 0x00 // 1080P
    data[4] = bitrateKbps & 0xff // Little-Endian low byte
    data[5] = (bitrateKbps >> 8) & 0xff // Little-Endian high byte
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.LIVEVIEW_PARAMS, data, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  /**
   * Camera LiveView Start (0x1200 / Subcmd 0x73, data = 0x00 0x64)
   * Official sequence packet #20: fe000000000000150000000000000009 fffd05000012730064
   */
  static buildLiveViewStart(): Uint8Array {
    const data = new Uint8Array([0x00, 0x64])
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.LIVEVIEW_START, data, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  static buildFpvSyncVersion(): Uint8Array {
    const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_SYNC_VERSION, null)
    return FeTransport.wrap(inner, 0x16)
  }

  // === System & Protocol ===

  static buildHandshake(): Uint8Array {
    return ByteUtils.hexToBytes(PROTOCOL_HEX.HANDSHAKE)
  }

  static buildHeartbeat(): Uint8Array {
    return ByteUtils.hexToBytes(PROTOCOL_HEX.HEARTBEAT)
  }

  /**
   * Full official initialization & camera wake-up sequence
   */
  static buildInitSequence(enableH265 = true): Uint8Array[] {
    return [
      PacketBuilder.buildFpvSyncVersion(),                                      // 1. FPV: Sync Version (0x1600)
      PacketBuilder.buildCameraGetAllParams(),                                   // 2. CAMERA: Get All Params (0x1200 / 0x01)
      ByteUtils.hexToBytes('fe000000000000170000000000000008fffe04007310006700'), // 3. REMOTER: Get Info
      ByteUtils.hexToBytes('fe000000000000160000000000000007fffd030035162000'), // 4. FPV: Get Settings
      ByteUtils.hexToBytes('fe00000000000014000000000000000afffd06000103007e007a'), // 5. FLIGHT: Init
      PacketBuilder.buildCameraFunction(true, enableH265),                       // 6. CAMERA: Enable Preview + H265/H264
      PacketBuilder.buildLiveViewStart(),                                        // 7. CAMERA: Start LiveView Stream (0x73)
      PacketBuilder.buildLiveViewParams(enableH265, 10240),                      // 8. CAMERA: Set 1080P 10240Kbps
      PacketBuilder.buildIdrRequest()                                            // 9. CAMERA: Request IDR Keyframe
    ]
  }

  static buildRfProbe(enable = true): Uint8Array {
    const data = new Uint8Array([enable ? 0x01 : 0x00])
    const inner = FfFdCommand.buildWithShort(CMD_SHORTS.RF_PROBE, data)
    return FeTransport.wrap(inner, 0x14)
  }

  static buildWifiDirectSwitch(enter = true): Uint8Array {
    const data = new Uint8Array(17)
    data[0] = enter ? 0x01 : 0x00
    for (let i = 1; i <= 16; i++) {
      data[i] = Math.floor(Math.random() * 256)
    }
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.WIFI_SWITCH, data, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  // === Engineering & Debugging Commands ===

  /**
   * Camera Interactive Debug Console (0x1200 / Subcmd 0x6F)
   * Sends OpCode (1 byte) + Command String (UTF-8)
   */
  static buildCameraTerminalCommand(opcode = 0, paramStr = ''): Uint8Array {
    const strBytes = new TextEncoder().encode(paramStr)
    const data = new Uint8Array(1 + strBytes.length)
    data[0] = opcode & 0xFF
    data.set(strBytes, 1)
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.DEBUG_TERMINAL, data, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  /**
   * FPV Custom Hex Command Injection (CMD 5696 / 0x1640)
   * Sends arbitrary hex payload directly to FPV MCU
   */
  static buildFpvCustomHex(hexStr: string): Uint8Array {
    const rawBytes = ByteUtils.hexToBytes(hexStr.replace(/[\s\r\n]/g, ''))
    const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_CUSTOM_DEBUG, rawBytes)
    return FeTransport.wrap(inner, 0x16)
  }

  /**
   * Factory Flight Mode Toggle (CMD 5640 / 0x1608)
   */
  static buildFpvFactoryFlyMode(enable = true): Uint8Array {
    const data = new Uint8Array([enable ? 0x01 : 0x00])
    const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_SET_FACTORY_FLY, data)
    return FeTransport.wrap(inner, 0x16)
  }

  /**
   * Set FPV Bandwidth (CMD 5652 / 0x1614)
   * payload: [isOpen (1B), bandwidth uint32 LE (4B)]
   */
  static buildFpvBandwidth(isOpen = true, bandwidthMhz = 20): Uint8Array {
    const data = new Uint8Array(5)
    data[0] = isOpen ? 0x01 : 0x00
    const view = new DataView(data.buffer)
    view.setUint32(1, bandwidthMhz, true)
    const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_SET_BANDWIDTH, data)
    return FeTransport.wrap(inner, 0x16)
  }

  /**
   * Allow All RF Frequencies / Unlock Full Bands (CMD 5658 / 0x161A)
   */
  static buildRfAllowAllFrequencies(): Uint8Array {
    const data = new Uint8Array([0x01])
    const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_ALLOW_ALL_FREQS, data)
    return FeTransport.wrap(inner, 0x16)
  }

  /**
   * RF Hardware Reset & Reboot (CMD 5650 / 0x1612)
   * Sends ASCII "reset\n" [114, 101, 115, 101, 116, 10]
   */
  static buildRfReset(): Uint8Array {
    const data = new Uint8Array([114, 101, 115, 101, 116, 10]) // "reset\n"
    const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_RF_RESET, data)
    return FeTransport.wrap(inner, 0x16)
  }

  /**
   * Enter RF Test Mode (CMD 5642 / 0x160A)
   */
  static buildEnterRfTest(): Uint8Array {
    const data = new Uint8Array([0x00])
    const inner = FfFdCommand.buildWithShort(CMD_SHORTS.FPV_ENTER_RF_TEST, data)
    return FeTransport.wrap(inner, 0x16)
  }

  /**
   * IMU Calibration Control (CMD 0x0301 / Subcmd 23 / 0x17)
   * action: 3 = start calibration, 2 = stop calibration
   */
  static buildImuCalibration(action = 3): Uint8Array {
    const data = new Uint8Array([action & 0xFF])
    const inner = FfFdCommand.buildWithCmdByte(23, data, CMD_SHORTS.FLIGHT)
    return FeTransport.wrap(inner, 0x14)
  }

  /**
   * Gimbal Reset / Clear IMU Calibration (CMD 0x0801)
   */
  static buildGimbalClearImu(): Uint8Array {
    const data = new Uint8Array([0x05])
    const inner = FfFdCommand.buildWithShort(CMD_SHORTS.GIMBAL_CONTROL, data)
    return FeTransport.wrap(inner, 0x14)
  }

  /**
   * Camera DPC Bad Pixel Calibration (CMD 0x1200 / Subcmd 0x6E)
   * isDark: false = light field test, true = dark field test
   */
  static buildCameraDpcCheck(isDark = false, step = 0): Uint8Array {
    const data = new Uint8Array([isDark ? 0x00 : 0x01, step & 0xFF, 0xA0, 0x0F]) // 40000 threshold
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.DPC_CALIBRATION, data, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  /**
   * Camera FPN Fixed Pattern Noise Calibration (CMD 0x1200 / Subcmd 0x74)
   */
  static buildCameraFpnCheck(): Uint8Array {
    const data = new Uint8Array([0x00, 0x00, 0x10])
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.FPN_CALIBRATION, data, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  /**
   * Remote ID Configuration Query (CMD 0x1200 / Subcmd 115 / 0x73)
   */
  static buildRemoteIdQuery(): Uint8Array {
    const inner = FfFdCommand.buildWithCmdByte(CAMERA_CMDS.REMOTE_ID_CONFIG, null, CMD_SHORTS.CAMERA)
    return FeTransport.wrap(inner, 0x15)
  }

  /**
   * GPS Test Mode Control (CMD 0x0301 / Subcmd 23)
   */
  static buildGpsTestControl(enable = true): Uint8Array {
    const data = new Uint8Array([enable ? 0x01 : 0x00])
    const inner = FfFdCommand.buildWithCmdByte(23, data, CMD_SHORTS.FLIGHT)
    return FeTransport.wrap(inner, 0x14)
  }

  /**
   * Beidou Satellite Switch (CMD 0x0301 / Subcmd 24)
   */
  static buildBeidouSwitch(enable = true): Uint8Array {
    const data = new Uint8Array([enable ? 0x01 : 0x00])
    const inner = FfFdCommand.buildWithCmdByte(24, data, CMD_SHORTS.FLIGHT)
    return FeTransport.wrap(inner, 0x14)
  }

  // === Joysticks & Controls ===

  /**
   * HighFrequencyData3 Control Packet (37 bytes)
   * Values range: -1000..1000
   */
  static buildControlPacket(
    throttle = 0,
    yaw = 0,
    pitch = 0,
    roll = 0,
    gimbal = 0
  ): Uint8Array {
    const out = new Uint8Array(37)
    const view = new DataView(out.buffer)
    out[0] = 3 // ID=3
    view.setUint16(1, 34, true)
    view.setInt16(17, Math.max(-1000, Math.min(1000, throttle)), true)
    view.setInt16(19, Math.max(-1000, Math.min(1000, yaw)), true)
    view.setInt16(21, Math.max(-1000, Math.min(1000, pitch)), true)
    view.setInt16(23, Math.max(-1000, Math.min(1000, roll)), true)
    view.setInt16(25, Math.max(-1000, Math.min(1000, gimbal)), true)
    return out
  }

  /**
   * Combined HFD2(35) + HFD1(55) + HFD3(37) = 127 bytes RAW
   * Sent without FE encapsulation (direct to AOA)
   */
  static buildCombinedControl(
    throttle = 0,
    yaw = 0,
    pitch = 0,
    roll = 0,
    gimbal = 0
  ): Uint8Array {
    const out = new Uint8Array(127)
    const view = new DataView(out.buffer)
    out[0] = 2; view.setUint16(1, 32, true) // HFD2
    out[35] = 1; view.setUint16(36, 52, true) // HFD1
    out.set(this.buildControlPacket(throttle, yaw, pitch, roll, gimbal), 90) // HFD3
    return out
  }
}

