/**
 * Drone Domain Types & Interfaces
 */

export interface TelemetryData {
  battery: number
  altitude: number
  horizontalDistance: number
  horizontalSpeed: number
  verticalSpeed: number
  satellites: number
  latitude: number
  longitude: number
  flightVoltage: number
  remoterVoltage: number
  heading: number
  pitch: number
  roll: number
  windSpeed?: number
  rcThrottle?: number
  rcYaw?: number
  rcPitch?: number
  rcRoll?: number
}

export interface JoystickState {
  throttle: number  // -1000..1000
  yaw: number       // -1000..1000
  pitch: number     // -1000..1000
  roll: number      // -1000..1000
  gimbal?: number   // -1000..1000
}

export interface ConnectionStatus {
  /** Confirmed controller/drone link: actual RX traffic received recently. */
  usbConnected: boolean
  /** Android has opened the AOA accessory, but the controller may not have replied yet. */
  usbTransportOpen: boolean
  wsConnected: boolean
  phoneIp: string
  targetHost: string
  lastRxTimestamp?: number
}

export interface SystemLog {
  id: string
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR'
  message: string
}
