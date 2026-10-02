/**
 * Packet Types & Definitions
 */
import { TelemetryData } from './drone'

export type PacketDirection = 'RX' | 'TX'

export type PacketCategory =
  | 'telemetry'   // Flight Telemetry (GPS/Altitude/speed/Voltage)
  | 'rc_sticks'   // stick control and feedback (0x0211, HFD3)
  | 'remoter'     // controller buttons and battery (0x41)
  | 'video'       // H.265 video packet (FE 0x06)
  | 'camera'      // Camera & Terminalcontrol (0x1200 / 0x15)
  | 'flight_cmd'  // flight-control action (SendCtrlData function 0x0014 / FE 0x14)
  | 'rf_fpv'      // RF and LiveView parameters (FE 0x16, 5913, 5656)
  | 'other'       // Other/raw data

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

