/**
 * Drone Domain Types & Interfaces
 */

export interface TelemetryData {
  battery: number
  /** Relative flight height used by the original Potensic cockpit. */
  verticalDistance: number
  /** Separate altitude field from flight telemetry; not used as cockpit height. */
  altitude: number
  horizontalDistance: number
  horizontalSpeed: number
  verticalSpeed: number
  satellites: number
  latitude: number
  longitude: number
  flightVoltage: number
  remoterVoltage: number
  remoterBatteryPercent?: number
  phoneBatteryPercent?: number
  heading: number
  pitch: number
  roll: number
  homeLatitude?: number
  homeLongitude?: number
  homeSynced?: boolean
  windSpeed?: number
  remainedFlyTime?: number
  gpsUtcTime?: number
  tofHeight?: number
  unlocked?: boolean
  flying?: boolean
  receiveGps?: boolean
  following?: boolean
  circleMode?: boolean
  pointFly?: boolean
  returning?: boolean
  landing?: boolean
  gyroCalibrating?: boolean
  magHorizontalCalibrating?: boolean
  magVerticalCalibrating?: boolean
  remoterConnected?: boolean
  takingOff?: boolean
  flightMode?: number
  speedMode?: number
  lowPowerMode?: boolean
  needCalibration?: boolean
  geomagneticFault?: boolean
  emergencyStop?: boolean
  opticalFlow?: boolean
  gpsInterference?: boolean
  gpsLocationValid?: boolean
  gpsSpeedValid?: boolean
  gimbalNotReady?: boolean
  flightInNoFlyZone?: boolean
  findingDrone?: boolean
  escBeep?: boolean
  locatedNoFlyZone?: boolean
  restrictedZone?: boolean
  nearNoFlyZone?: boolean
  nearRestrictedZone?: boolean
  noFlyHeightLimit?: number
  noFlyDistance?: number
  limitHeight?: number
  limitDistance?: number
  returnHeight?: number
  beginnerMode?: boolean
  americaRockerMode?: boolean
  surroundRadius?: number
  surroundClockwise?: boolean
  surroundSpeed?: number
  settingSpeedMode?: number
  settingsValid?: boolean
  gimbalPitchControl?: number
  gimbalPitchSpeed?: number
  gimbalStableMode?: boolean
  gimbalFpvSmooth?: number
  gimbalCalibration?: number
  gimbalTuningRoll?: number
  gimbalTuningYaw?: number
  gimbalReset?: number
  gimbalSettingsValid?: boolean
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
  /** Backend-confirmed FE 0x06 video stream state. */
  videoStreaming: boolean
}

export interface SystemLog {
  id: string
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR'
  message: string
}
