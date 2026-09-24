/**
 * USB Packet Parser
 * Dissects raw binary frames from the USB accessory in pure TypeScript/Vue.
 */
import { ParsedPacket, PacketDirection } from '../types/packet'
import { FE_TYPES, CMD_SHORTS, CAMERA_CMDS } from './DroneProtocol'
import { ByteUtils } from '../utils/ByteUtils'
import { useDebugStore } from '../stores/useDebugStore'

export class PacketParser {
  static parse(bytes: Uint8Array, dir: PacketDirection = 'RX'): ParsedPacket {
    const id = Math.random().toString(36).substring(2, 9)
    const time = new Date().toLocaleTimeString()

    const res: ParsedPacket = {
      id,
      dir,
      time,
      len: bytes.length,
      hex: ByteUtils.bytesToHex(bytes),
      feType: null,
      feTypeName: 'Unknown',
      category: 'other',
      categoryLabel: '其它数据',
      summary: '',
      telemetry: null,
      expanded: false
    }

    if (!bytes || bytes.length === 0) {
      res.summary = 'Empty packet'
      return res
    }

    // 1. Check FE Transport Frame (starts with 0xFE, min 16 bytes)
    if (bytes[0] === 0xFE && bytes.length >= 16) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      const feType = bytes[7]
      const payloadLen = view.getUint32(12, false)

      res.feType = feType
      res.feTypeName = FE_TYPES[feType] || `FE 0x${feType.toString(16).padStart(2, '0')}`

      // H.265 Video Stream (0x06)
      if (feType === 0x06) {
        res.category = 'video'
        res.categoryLabel = '视频流'
        const nalType = bytes.length >= 21 ? (bytes[20] & 0x1F) : 0
        const isKey = [19, 20, 32, 33, 34].includes(nalType)
        res.summary = `H.265 视频帧 (NALU ${nalType}${isKey ? ' [IDR关键帧]' : ''}, ${payloadLen}B)`
        return res
      }

      // Inner FF FD / FF FE Frame
      if (bytes.length >= 22 && bytes[16] === 0xFF && (bytes[17] === 0xFD || bytes[17] === 0xFE)) {
        const cmdShort = view.getUint16(20, true)

        // FE 0x21: FlightRevGps Telemetry (vt1.java)
        if (feType === 0x21 && cmdShort === 0x0200 && bytes.length >= 48) {
          res.category = 'telemetry'
          res.categoryLabel = '飞行遥测'
          try {
            const flightVoltage = view.getUint16(22, true) / 1000.0
            const remoterVoltage = view.getUint16(24, true) / 100.0
            const longitude = view.getInt32(26, true) / 1e7
            const latitude = view.getInt32(30, true) / 1e7
            const satellites = bytes[34]
            const heading = view.getUint16(35, true)
            const horizontalDistance = bytes.length >= 41 ? view.getInt32(37, true) / 10.0 : 0
            let altitude = bytes.length >= 43 ? view.getInt16(41, true) / 10.0 : 0
            const horizontalSpeed = bytes.length >= 45 ? view.getUint16(43, true) / 10.0 : 0
            const verticalSpeed = bytes.length >= 47 ? view.getInt16(45, true) / 10.0 : 0
            const battery = bytes.length >= 48 ? bytes[47] : 0
            const pitch = bytes.length >= 51 ? view.getInt16(49, true) : 0
            const roll = bytes.length >= 53 ? view.getInt16(51, true) : 0

            // If full GPS telemetry packet with barometric altitude at offset 70
            if (bytes.length >= 74) {
              const baroAlt = view.getInt32(70, true) / 1000.0
              if (baroAlt !== 0) altitude = baroAlt
            }

            res.telemetry = {
              battery,
              altitude,
              horizontalDistance,
              horizontalSpeed,
              verticalSpeed,
              satellites,
              latitude,
              longitude,
              flightVoltage,
              remoterVoltage,
              heading,
              pitch,
              roll
            }
            res.details = {
              '剩余电量': `${battery}%`,
              '飞行对地高度': `${altitude.toFixed(1)} m`,
              '水平对地距离': `${horizontalDistance.toFixed(1)} m`,
              '水平飞行速度': `${horizontalSpeed.toFixed(1)} m/s`,
              '垂直升降速度': `${verticalSpeed.toFixed(1)} m/s`,
              'GPS搜星数量': `${satellites} 颗`,
              '动力电池电压': `${flightVoltage.toFixed(2)} V`,
              '遥控手柄电压': `${remoterVoltage.toFixed(2)} V`,
              '机头指向航向': `${heading}°`,
              '机身俯仰角度': `${pitch}°`,
              '机身横滚角度': `${roll}°`,
              '经纬度坐标': `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            }
            res.summary = `飞行遥测: 电量=${battery}%, 高度=${altitude.toFixed(1)}m, 航速=${horizontalSpeed.toFixed(1)}m/s, 卫星=${satellites}, 电压=${flightVoltage.toFixed(1)}V`
            return res
          } catch (e: any) {
            res.summary = '遥测解析异常: ' + e.message
            return res
          }
        }

        // FE 0x21: FlightRevAttitude (0x0201 / 513 - 三轴姿态角)
        if (feType === 0x21 && cmdShort === 0x0201 && bytes.length >= 28) {
          res.category = 'telemetry'
          res.categoryLabel = '姿态遥测'
          const pitch = view.getInt16(22, true) / 10.0
          const roll = view.getInt16(24, true) / 10.0
          const yaw = view.getInt16(26, true) / 10.0
          res.telemetry = { pitch: Math.round(pitch), roll: Math.round(roll), heading: Math.round(yaw) }
          res.details = {
            '机身俯仰角 (Pitch)': `${pitch.toFixed(1)}°`,
            '机身横滚角 (Roll)': `${roll.toFixed(1)}°`,
            '机身航向角 (Yaw)': `${yaw.toFixed(1)}°`
          }
          res.summary = `姿态航向 (513): 俯仰=${pitch.toFixed(1)}°, 横滚=${roll.toFixed(1)}°, 航向=${yaw.toFixed(1)}°`
          return res
        }

        // FE 0x21: FlightRevBattery (0x0204 / 516 - 动力电池分压与温度)
        if (feType === 0x21 && cmdShort === 0x0204 && bytes.length >= 30) {
          res.category = 'telemetry'
          res.categoryLabel = '电池遥测'
          const cell1 = view.getUint16(22, true) / 1000.0
          const cell2 = view.getUint16(24, true) / 1000.0
          const totalV = cell1 + cell2
          const current = view.getInt16(26, true)
          const temp = bytes.length >= 29 ? bytes[28] : 0
          res.telemetry = { flightVoltage: totalV }
          res.details = {
            '动力总电压': `${totalV.toFixed(2)} V`,
            '电芯 1 电压': `${cell1.toFixed(3)} V`,
            '电芯 2 电压': `${cell2.toFixed(3)} V`,
            '放电工作电流': `${current} mA`,
            '动力电池温度': `${temp} °C`
          }
          res.summary = `动力电池 (516): 总压=${totalV.toFixed(2)}V (Cell1: ${cell1.toFixed(2)}V, Cell2: ${cell2.toFixed(2)}V), 温度=${temp}℃`
          return res
        }

        // FE 0x21: FlightRevFault (0x0206 / 518 - 飞控故障诊断告警码)
        if (feType === 0x21 && cmdShort === 0x0206 && bytes.length >= 26) {
          res.category = 'telemetry'
          res.categoryLabel = '飞控告警'
          const faultCode = view.getUint32(22, true)
          const isWindWarn = (faultCode & 0x01) !== 0
          const isCompassDisturb = (faultCode & 0x02) !== 0
          const isLowBatRth = (faultCode & 0x04) !== 0
          const isNoFlyZone = (faultCode & 0x08) !== 0
          res.details = {
            '原始故障字': `0x${faultCode.toString(16).padStart(8, '0')}`,
            '大风预警': isWindWarn ? '触发 (强风警告)' : '正常',
            '地磁指南针干扰': isCompassDisturb ? '异常 (地磁受扰)' : '正常',
            '低电量强制返航': isLowBatRth ? '触发' : '正常',
            '禁飞区边缘警告': isNoFlyZone ? '触发 (禁飞边缘)' : '正常'
          }
          res.summary = `飞控告警 (518): 故障码=0x${faultCode.toString(16)}${isWindWarn ? ' [大风警告]' : ''}${isCompassDisturb ? ' [地磁受扰]' : ''}`
          return res
        }

        // FE 0x21: FlightRevRcValue (fu1.java - physical stick positions)
        if (feType === 0x21 && cmdShort === 0x0211 && bytes.length >= 34) {
          res.category = 'rc_sticks'
          res.categoryLabel = '摇杆回传'
          const rcThrottle = view.getInt16(22, true)
          const rcYaw = view.getInt16(24, true)
          const rcPitch = view.getInt16(26, true)
          const rcRoll = view.getInt16(28, true)
          const rcLeftWheel = view.getInt16(30, true)
          const rcRightWheel = view.getInt16(32, true)

          res.telemetry = { rcThrottle, rcYaw, rcPitch, rcRoll }
          res.details = {
            '油门通道 (Throttle)': rcThrottle,
            '偏航通道 (Yaw)': rcYaw,
            '俯仰通道 (Pitch)': rcPitch,
            '横滚通道 (Roll)': rcRoll,
            '左侧拨轮 (Left Wheel)': rcLeftWheel,
            '右侧拨轮 (Right Wheel)': rcRightWheel
          }
          res.summary = `硬件手柄遥控值: 油门=${rcThrottle}, 偏航=${rcYaw}, 俯仰=${rcPitch}, 横滚=${rcRoll}, 云台=${rcLeftWheel}`
          return res
        }

        // FE 0x41: Remoter Battery & State Frames
        if (feType === 0x41) {
          res.category = 'remoter'
          res.categoryLabel = '遥控器状态'

          // 0x1130: 遥控器实时控制流
          if (cmdShort === 0x1130 && bytes.length >= 34) {
            const throttle = view.getInt16(22, true)
            const yaw = view.getInt16(24, true)
            const pitch = view.getInt16(26, true)
            const roll = view.getInt16(28, true)
            const dial = view.getInt16(30, true)
            const btns = view.getUint16(32, true)
            res.details = {
              '油门量 (T)': throttle,
              '偏航量 (R)': yaw,
              '俯仰量 (E)': pitch,
              '横滚量 (A)': roll,
              '云台俯仰拨轮': dial,
              '按键状态掩码': `0x${btns.toString(16).padStart(4, '0')}`
            }
            res.summary = `手柄实时通道 (4400): T=${throttle}, Y=${yaw}, P=${pitch}, R=${roll}, 拨轮=${dial}`
            return res
          }

          if (cmdShort === 0x1131 && bytes.length >= 24) {
            const remoterVoltage = view.getUint16(22, true) / 100.0
            const remoterBatPercent = bytes.length >= 28 ? view.getFloat32(24, true) : 0
            res.telemetry = { remoterVoltage }
            res.details = {
              '遥控器电池电压': `${remoterVoltage.toFixed(2)} V`,
              ...(remoterBatPercent > 0 ? { '遥控器剩余电量': `${remoterBatPercent.toFixed(0)} %` } : {})
            }
            res.summary = `遥控器电池: ${remoterVoltage.toFixed(2)}V${remoterBatPercent > 0 ? ', ' + remoterBatPercent.toFixed(0) + '%' : ''}`
            return res
          }

          if (cmdShort === 0x1133 && bytes.length >= 37) {
            const flags = bytes[22]
            const btnRecord = ((flags >> 1) & 1) === 1
            const btnPhoto = ((flags >> 2) & 1) === 1
            const btnRTH = ((flags >> 3) & 1) === 1
            const lh = view.getUint16(25, true)
            const lv = view.getUint16(27, true)
            const rh = view.getUint16(29, true)
            const rv = view.getUint16(31, true)
            res.details = {
              '返航键 (RTH)': btnRTH ? '按下' : '松开',
              '录像按键': btnRecord ? '按下' : '松开',
              '拍照按键': btnPhoto ? '按下' : '松开',
              '左摇杆 (H, V)': `${lh}, ${lv}`,
              '右摇杆 (H, V)': `${rh}, ${rv}`
            }
            res.summary = `手柄按键与摇杆: 左(${lh},${lv}) 右(${rh},${rv})${btnRTH ? ' [RTH]' : ''}${btnRecord ? ' [录像]' : ''}${btnPhoto ? ' [拍照]' : ''}`
            return res
          }
          res.summary = `手柄状态响应 (Short=0x${cmdShort.toString(16).padStart(4, '0')}, ${payloadLen}B)`
          return res
        }

        // === Camera Debug Responses (0x1200 / FE 0x05 / FE 0x15) ===
        if (cmdShort === CMD_SHORTS.CAMERA || feType === 0x15 || feType === 0x05) {
          res.category = 'camera'
          res.categoryLabel = '相机与终端'
          const cmdByte = bytes.length > 22 ? bytes[22] : null

          // Camera Terminal Debug Output (CamRevTestDebugInfo, 0x6F / 200)
          if ((cmdByte === CAMERA_CMDS.DEBUG_TERMINAL || cmdByte === 200) && bytes.length >= 24) {
            try {
              if (dir === 'TX') {
                const opcode = bytes.length > 23 ? bytes[23] : 0
                // For TX, command string starts at byte 24 and ends before the last XOR checksum byte
                const cmdBytes = bytes.subarray(24, Math.max(24, bytes.length - 1))
                const cmdText = new TextDecoder('utf-8').decode(cmdBytes).trim()
                // Do not addTerminalLog here for TX, as DebugConsoleView already records the user TX action
                res.summary = `相机终端指令 (TX): Op=0x${opcode.toString(16).padStart(2, '0')}, "${cmdText}"`
                return res
              }

              // RX: Camera Debug Response from Drone (CamRevTestDebugInfo)
              let showInfo = ''
              const subOpcode = bytes.length > 23 ? bytes[23] : 0
              // Check standard f10 layout (status at 23, isAppend at 24, infoLen at 25, text at 26)
              if (bytes.length >= 26 && (bytes[24] === 0 || bytes[24] === 1) && bytes[25] > 0 && bytes[25] <= bytes.length - 26) {
                const infoLen = bytes[25]
                showInfo = new TextDecoder('utf-8').decode(bytes.subarray(26, 26 + infoLen)).trim()
              } else if (bytes.length >= 25 && bytes[24] > 0 && bytes[24] <= bytes.length - 25) {
                const infoLen = bytes[24]
                showInfo = new TextDecoder('utf-8').decode(bytes.subarray(25, 25 + infoLen)).trim()
              } else if (bytes.length >= 24) {
                const rawBytes = bytes.subarray(23, Math.max(23, bytes.length - 1))
                showInfo = new TextDecoder('utf-8').decode(rawBytes).replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim()
              }

              try {
                useDebugStore().addTerminalLog('RX', subOpcode, showInfo, ByteUtils.bytesToHex(bytes))
              } catch (_) {}
              res.summary = `相机终端输出 (RX): "${showInfo}"`
              return res
            } catch (e: any) {
              res.summary = `相机终端输出解析失败: ${e.message}`
              return res
            }
          }

          // Remote ID Config Response (115 / 0x73)
          if (cmdByte === CAMERA_CMDS.REMOTE_ID_CONFIG && bytes.length >= 24 && dir === 'RX') {
            const rawHex = ByteUtils.bytesToHex(bytes.subarray(22))
            try {
              useDebugStore().updateRemoteId({ status: '已读取', rawHex })
            } catch (_) {}
            res.summary = `Remote ID 配置应答 (${bytes.length - 22}B)`
            return res
          }

          // Temperature Report (0xF0 / 240 / h00)
          if ((cmdByte === CAMERA_CMDS.TEMPERATURE_REPORT || cmdByte === 0xF0) && bytes.length >= 25 && dir === 'RX') {
            try {
              const text = new TextDecoder('utf-8').decode(bytes.subarray(23)).trim()
              let soc = 0, sensor = 0, isp = 0
              const jsonMatch = text.match(/\{.*\}/)
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0])
                soc = parsed.soc || parsed.socTemp || 0
                sensor = parsed.sensor || parsed.sensorTemp || 0
                isp = parsed.isp || parsed.isp970 || 0
              } else if (bytes.length >= 26) {
                soc = bytes[23]
                sensor = bytes[24]
                isp = bytes.length >= 27 ? bytes[25] : 0
              }
              try {
                useDebugStore().updateTemperatures(soc, sensor, isp)
              } catch (_) {}
              res.summary = `芯片温度遥测: SoC=${soc}℃, Sensor=${sensor}℃, 970=${isp}℃`
              return res
            } catch (_) {}
          }
        }

        // === FPV & RF Debug Responses ===
        if (feType === 0x16 || [5909, 5910, 5911, 5913, 5656, 5658, 5640, 5650, 5696, 5632, 5633, 5634, 5635, 5636, 5637, 5641, 5642, 5643, 5649, 5651, 5652].includes(cmdShort)) {
          res.category = 'rf_fpv'
          res.categoryLabel = '射频图传'
        }

        // RF Link & Pairing State (5909 / 0x1715 - FpvRevConnectState)
        if ((cmdShort === 5909 || cmdShort === CMD_SHORTS.FPV_CONNECT_STATE) && bytes.length >= 31) {
          res.category = 'rf_fpv'
          res.categoryLabel = '链路对频'
          try {
            const signalLevel = bytes[23]
            const flags = bytes[24]
            const wirelessConnected = (flags & 0x01) !== 0
            const flightConnected = (flags & 0x02) !== 0
            const remoterConnected = (flags & 0x04) !== 0
            const cameraConnected = (flags & 0x08) !== 0
            const isHopSupport = (flags & 0x10) !== 0
            const powerAdaptive = (flags & 0x20) !== 0
            const isPairing = (flags & 0x80) !== 0

            const rfChannelMhz = view.getUint16(25, true)
            const interference = view.getUint16(27, true)
            const isHighInterference = interference < 85
            const mcs = bytes[29]
            const txMcs = bytes[30] - 2

            let rxMcs = -1
            if (bytes.length >= 33) {
              rxMcs = bytes[31] - 2
            }

            let isImgTransInterrupt = false
            let isFactoryFlight = false
            let isRemoteWirelessData = false
            let isLargeBand = false
            if (bytes.length >= 34) {
              const ext = bytes[32]
              isImgTransInterrupt = (ext & 0x01) !== 0
              isFactoryFlight = (ext & 0x02) !== 0
              isRemoteWirelessData = (ext & 0x04) !== 0
              isLargeBand = (ext & 0x08) !== 0
            }

            let countryBand: string | undefined
            if (bytes.length >= 35) {
              countryBand = `Band ${bytes[33]}`
            }

            let flightType: string | undefined
            if (bytes.length >= 36) {
              const ft = bytes[34]
              if (ft === 179) flightType = 'ATOM 2'
              else if (ft === 180) flightType = 'ATOM 2S'
              else if (ft === 181) flightType = 'ATOM 3'
              else flightType = `Type_${ft}`
            }

            // Sync to debug store
            try {
              useDebugStore().updateLinkState({
                signalLevel,
                wirelessConnected,
                flightConnected,
                remoterConnected,
                cameraConnected,
                isPairing,
                isHopSupport,
                powerAdaptive,
                rfChannelMhz,
                interference,
                isHighInterference,
                mcs,
                txMcs,
                rxMcs,
                isImgTransInterrupt,
                isFactoryFlight,
                isRemoteWirelessData,
                isLargeBand,
                countryBand,
                flightType
              })
            } catch (_) {}

            res.details = {
              '遥控手柄': remoterConnected ? '已连接 (USB就绪)' : '未连接',
              '空中无线': wirelessConnected ? '已建立 (空中链路)' : '未建立',
              '飞控通信': flightConnected ? '已连通 (可操控)' : '未连通',
              '云台相机': cameraConnected ? '已连通' : '未连通',
              '对频状态': isPairing ? '正在对频 (快闪)' : '空闲',
              '当前频点': `${rfChannelMhz} MHz`,
              '环境干扰': `${interference} (${isHighInterference ? '强干扰' : '正常'})`,
              '编码速率': `MCS ${mcs}`,
              '上行速率': txMcs >= 0 ? `MCS ${txMcs}` : 'N/A',
              '下行速率': rxMcs >= 0 ? `MCS ${rxMcs}` : 'N/A',
              '跳频支持': isHopSupport ? '支持 2.4G/5.8G' : '不支持',
              '功率自适应': powerAdaptive ? '启用' : '关闭',
              '大频宽模式': isLargeBand ? '开启' : '关闭',
              ...(flightType ? { '机型识别': flightType } : {}),
              ...(countryBand ? { '国家频段': countryBand } : {})
            }

            res.summary = `链路对频 (5909): 手柄${remoterConnected ? '已连' : '未连'}, 飞控${flightConnected ? '已连' : '未连'}, ${rfChannelMhz}MHz, 干扰${interference}${isHighInterference ? '[强干扰]' : ''}, TX=${txMcs}/RX=${rxMcs}`
            return res
          } catch (e: any) {
            res.summary = `链路状态 (5909) 解析异常: ${e.message}`
            return res
          }
        }

        // FPV Scan Frequency Results (5910 / 0x1716)
        if ((cmdShort === 5910 || cmdShort === CMD_SHORTS.FPV_SCAN_FREQ) && bytes.length >= 24) {
          res.category = 'rf_fpv'
          res.categoryLabel = '信道扫频'
          const count = Math.max(0, Math.floor((bytes.length - 23) / 2))
          res.details = {
            '扫频采集信道数': count,
            '原始扫描载荷字节': `${bytes.length - 23} B`
          }
          res.summary = `信道扫频结果 (5910): 采集到 ${count} 个频点噪声数据`
          return res
        }

        // FPV Debug / Physical Telemetry (5911 / 0x1717)
        if ((cmdShort === 5911 || cmdShort === CMD_SHORTS.FPV_DEBUG_PARAMS) && bytes.length >= 26) {
          res.category = 'rf_fpv'
          res.categoryLabel = '底层RF'
          const snr = view.getInt16(22, true)
          const loss = bytes.length >= 25 ? bytes[24] : 0
          const retry = bytes.length >= 26 ? bytes[25] : 0
          res.details = {
            '信噪比 (SNR)': `${snr} dB`,
            '下行丢包率': `${loss} %`,
            '重传比例': `${retry} %`
          }
          res.summary = `底层射频遥测 (5911): SNR=${snr}dB, 丢包=${loss}%, 重传=${retry}%`
          return res
        }

        // FPV Version Sync (5888 / 0x1700)
        if (cmdShort === 5888 || cmdShort === CMD_SHORTS.FPV_SYNC_VERSION) {
          res.category = 'rf_fpv'
          res.categoryLabel = '图传版本'
          const verText = bytes.length > 23 ? new TextDecoder('utf-8').decode(bytes.subarray(22, bytes.length - 1)).trim() : ''
          res.details = {
            '图传固件版本': verText || '已同步'
          }
          res.summary = `图传版本同步 (5888): ${verText || '已响应'}`
          return res
        }

        // RF Real-time Telemetry (5913 / 0x1719)
        if (cmdShort === CMD_SHORTS.FPV_REALTIME_REPORT && bytes.length >= 34) {
          try {
            const rcGainA = view.getInt16(22, true)
            const rcGainB = view.getInt16(24, true)
            const rcSnr = view.getInt16(26, true)
            const fcGainA = view.getInt16(28, true)
            const fcGainB = view.getInt16(30, true)
            const fcSnr = view.getInt16(32, true)
            const mcs = bytes.length >= 35 ? bytes[34] : 0

            const channels = []
            let chOffset = 36
            let chIdx = 1
            while (chOffset + 4 <= bytes.length && chIdx <= 16) {
              const noise = view.getInt16(chOffset, true)
              const snr = view.getInt16(chOffset + 2, true)
              channels.push({
                channelIndex: chIdx,
                frequencyMhz: 2400 + chIdx * 5,
                rssi: Math.round(-100 + snr / 10),
                snr,
                noiseLevel: noise
              })
              chOffset += 4
              chIdx++
            }

            try {
              useDebugStore().updateRfStats({
                rcGainA,
                rcGainB,
                rcSnr,
                fcGainA,
                fcGainB,
                fcSnr,
                mcs,
                channels: channels.length > 0 ? channels : undefined
              })
            } catch (_) {}

            res.summary = `射频实时参数 (5913): 遥控SNR=${rcSnr}dB, 飞机SNR=${fcSnr}dB, MCS=${mcs}`
            return res
          } catch (e: any) {
            res.summary = `射频实时参数解析异常: ${e.message}`
            return res
          }
        }

        // FPV Custom Command Echo / Response (5696 / 0x1640)
        if (cmdShort === CMD_SHORTS.FPV_CUSTOM_DEBUG) {
          const hex = ByteUtils.bytesToHex(bytes.subarray(22))
          try {
            useDebugStore().addFpvLog(dir, hex, '图传自定义命令 (5696)')
          } catch (_) {}
          res.summary = `图传自定义命令 (5696): ${hex}`
          return res
        }

        // RF Reset (5650 / 0x1612)
        if (cmdShort === CMD_SHORTS.FPV_RF_RESET) {
          res.summary = `射频复位重启指令 (5650)`
          return res
        }

        // Allow All Frequencies (5658 / 0x161A)
        if (cmdShort === CMD_SHORTS.FPV_ALLOW_ALL_FREQS) {
          try {
            useDebugStore().fpvSettings.allFreqUnlocked = true
          } catch (_) {}
          res.summary = `全频段强制解锁应答 (5658)`
          return res
        }

        // Factory Flight Mode (5640 / 0x1608)
        if (cmdShort === CMD_SHORTS.FPV_SET_FACTORY_FLY) {
          const enabled = bytes.length > 22 && bytes[22] === 1
          try {
            useDebugStore().fpvSettings.factoryFlyMode = enabled
          } catch (_) {}
          res.summary = `工厂飞行模式设置 (5640): ${enabled ? '已开启' : '已关闭'}`
          return res
        }

        // Flight Controller IMU / Calibration Responses (0x0301)
        if (cmdShort === CMD_SHORTS.FLIGHT || feType === 0x14 || feType === 0x31) {
          res.category = 'flight_cmd'
          res.categoryLabel = '飞控指令'
          const subcmd = bytes.length > 22 ? bytes[22] : null
          if (subcmd === 23 || subcmd === 6) {
            try {
              const stage = bytes.length >= 24 ? bytes[23] : 0
              let text = '校准中...'
              if (stage === 1) text = '第1面完成'
              else if (stage === 2) text = '第2面完成'
              else if (stage === 3) text = '正在计算零偏'
              else if (stage === 4) text = '校准成功 PASS'
              useDebugStore().updateImuCal({
                isCalibrating: stage < 4,
                stage,
                text
              })
            } catch (_) {}
            res.summary = `飞控校准控制应答 (0x0301 Sub=${subcmd})`
            return res
          }
        }

        if (feType === 0x14 || feType === 0x31) {
          res.category = 'flight_cmd'
          res.categoryLabel = '飞控指令'
        } else if (feType === 0x15 || feType === 0x05) {
          res.category = 'camera'
          res.categoryLabel = '相机与终端'
        } else if (feType === 0x16) {
          res.category = 'rf_fpv'
          res.categoryLabel = '射频图传'
        } else if (feType === 0x21 || feType === 0x32) {
          res.category = 'telemetry'
          res.categoryLabel = '飞行遥测'
        } else if (feType === 0x41 || feType === 0x17) {
          res.category = 'remoter'
          res.categoryLabel = '遥控器状态'
        }

        const cmdByte = bytes.length > 22 ? bytes[22] : null
        res.summary = `${res.feTypeName} (Short=0x${cmdShort.toString(16).padStart(4, '0')}${cmdByte !== null ? ', Cmd=0x' + cmdByte.toString(16).padStart(2, '0') : ''})`
        return res
      }

      if (feType === 0x14) {
        res.category = 'flight_cmd'
        res.categoryLabel = '飞控/心跳'
      } else if (feType === 0x21) {
        res.category = 'telemetry'
        res.categoryLabel = '飞行遥测'
      } else if (feType === 0x41) {
        res.category = 'remoter'
        res.categoryLabel = '遥控器状态'
      } else if (feType === 0x12) {
        res.category = 'other'
        res.categoryLabel = 'AOA握手'
      }

      res.summary = `${res.feTypeName} (${payloadLen}B payload)`
      return res

    }

    // 2. Check Raw HFD packets
    if ([1, 2, 3].includes(bytes[0]) && bytes.length >= 3) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      if (bytes[0] === 3 && bytes.length >= 27) {
        res.category = 'rc_sticks'
        res.categoryLabel = 'HFD3摇杆'
        const rcThrottle = view.getInt16(17, true)
        const rcYaw = view.getInt16(19, true)
        const rcPitch = view.getInt16(21, true)
        const rcRoll = view.getInt16(23, true)
        res.summary = `摇杆控制包 HFD3 (T=${rcThrottle}, Y=${rcYaw}, P=${rcPitch}, R=${rcRoll})`
        res.telemetry = { rcThrottle, rcYaw, rcPitch, rcRoll }
        return res
      }
      if (bytes[0] === 1) {
        res.category = 'telemetry'
        res.categoryLabel = 'HFD1位置'
        res.summary = '位置数据包 HFD1'
        return res
      }
      if (bytes[0] === 2) {
        res.category = 'telemetry'
        res.categoryLabel = 'HFD2状态'
        res.summary = 'GPS状态包 HFD2'
        return res
      }
    }

    res.summary = `原始数据 (${bytes.length} 字节)`
    return res
  }
}
