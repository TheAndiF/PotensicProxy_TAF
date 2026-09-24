/**
 * Packet Types & Definitions
 */
import { TelemetryData } from './drone'

export type PacketDirection = 'RX' | 'TX'

export type PacketCategory =
  | 'telemetry'   // 飞行遥测 (GPS/高度/速度/电压)
  | 'rc_sticks'   // 摇杆控制与回传 (0x0211, HFD3)
  | 'remoter'     // 遥控器按键与电池 (0x41)
  | 'video'       // H.265 视频包 (FE 0x06)
  | 'camera'      // 相机与终端控制 (0x1200 / 0x15)
  | 'flight_cmd'  // 飞控起降指令 (0x0301 / 0x14)
  | 'rf_fpv'      // 射频与图传参数 (FE 0x16, 5913, 5656)
  | 'other'       // 其它/原始数据

export interface ParsedPacket {
  id: string
  dir: PacketDirection
  time: string
  len: number
  hex: string
  feType: number | null
  feTypeName: string
  category: PacketCategory
  categoryLabel: string
  summary: string
  telemetry?: Partial<TelemetryData> | null
  details?: Record<string, any> | null
  expanded?: boolean
}

export interface PacketPreset {
  id: string
  name: string
  category: 'flight' | 'camera' | 'system'
  description: string
}
