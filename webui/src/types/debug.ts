/**
 * Debugging and Engineering Console Types
 */

export interface CameraTerminalEntry {
  id: string
  time: string
  dir: 'TX' | 'RX'
  opcode: number
  text: string
  hex?: string
}

export interface DeviceTemperatures {
  socTemp: number | null
  sensorTemp: number | null
  isp970Temp: number | null
  lastUpdated: string | null
}

export interface RfChannelItem {
  channelIndex: number
  frequencyMhz: number
  rssi: number
  snr: number
  noiseLevel: number
}

export interface RfRealtimeData {
  lastUpdated: string | null
  rcGainA: number
  rcGainB: number
  rcSnr: number
  fcGainA: number
  fcGainB: number
  fcSnr: number
  mcs: number
  channels: RfChannelItem[]
}

export interface ImuCalibrationData {
  isCalibrating: boolean
  stage: number
  text: string
  faces: {
    top: boolean
    bottom: boolean
    left: boolean
    right: boolean
    front: boolean
    back: boolean
  }
  acc: { x: number; y: number; z: number }
  gyro: { x: number; y: number; z: number }
}

export interface FpvCustomCmdLog {
  id: string
  time: string
  dir: 'TX' | 'RX'
  hex: string
  description?: string
}

export interface RemoteIdData {
  countryCode: string
  uasId: string
  status: string
  rawHex?: string
}

export interface FpvConnectStateData {
  lastUpdated: string | null
  signalLevel: number
  wirelessConnected: boolean
  flightConnected: boolean
  remoterConnected: boolean
  cameraConnected: boolean
  isPairing: boolean
  isHopSupport: boolean
  powerAdaptive: boolean
  rfChannelMhz: number
  interference: number
  isHighInterference: boolean
  mcs: number
  txMcs: number
  rxMcs: number
  isImgTransInterrupt: boolean
  isFactoryFlight: boolean
  isRemoteWirelessData: boolean
  isLargeBand: boolean
  countryBand?: string
  flightType?: string
}

