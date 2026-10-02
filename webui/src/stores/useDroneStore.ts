/**
 * Pinia Store for Drone State & Packet Stream
 * Java-like Model/Store pattern
 */
import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { TelemetryData, JoystickState, ConnectionStatus, SystemLog } from '../types/drone'
import { ParsedPacket } from '../types/packet'

export const DEFAULT_TARGET_HOST = '127.0.0.1:9090'

export const useDroneStore = defineStore('drone', () => {
  const getInitialHost = () => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('potensic_target_host')
      if (saved && saved.trim()) return saved.trim()
    }
    // If opened on public server domain/ip directly (not localhost)
    if (typeof window !== 'undefined' && window.location && window.location.host &&
        !window.location.host.startsWith('localhost') && !window.location.host.startsWith('127.0.0.1')) {
      return window.location.host
    }
    return DEFAULT_TARGET_HOST
  }

  // Connection State
  const connection = reactive<ConnectionStatus>({
    usbConnected: false,
    usbTransportOpen: false,
    wsConnected: false,
    videoStreaming: false,
    phoneIp: '127.0.0.1',
    targetHost: getInitialHost()
  })

  const normalizedHost = computed(() => {
    let host = connection.targetHost.trim() || DEFAULT_TARGET_HOST
    if (!host.includes(':')) {
      host = `${host}:9090`
    }
    return host
  })

  // Telemetry
  const telemetry = reactive<TelemetryData>({
    battery: -1,
    verticalDistance: 0,
    altitude: 0,
    horizontalDistance: 0,
    horizontalSpeed: 0,
    verticalSpeed: 0,
    satellites: 0,
    latitude: 0,
    longitude: 0,
    flightVoltage: 0,
    remoterVoltage: 0,
    remoterBatteryPercent: undefined,
    phoneBatteryPercent: undefined,
    heading: 0,
    pitch: 0,
    roll: 0,
    homeLatitude: 0,
    homeLongitude: 0,
    homeSynced: false,
    windSpeed: 0,
    remainedFlyTime: 0,
    gpsUtcTime: 0,
    tofHeight: 0,
    unlocked: false,
    flying: false,
    receiveGps: false,
    following: false,
    circleMode: false,
    pointFly: false,
    returning: false,
    landing: false,
    gyroCalibrating: false,
    magHorizontalCalibrating: false,
    magVerticalCalibrating: false,
    remoterConnected: false,
    takingOff: false,
    flightMode: 2,
    speedMode: -1,
    lowPowerMode: false,
    needCalibration: false,
    geomagneticFault: false,
    emergencyStop: false,
    opticalFlow: false,
    gpsInterference: false,
    gpsLocationValid: false,
    gpsSpeedValid: false,
    gimbalNotReady: false,
    flightInNoFlyZone: false,
    findingDrone: false,
    escBeep: false,
    locatedNoFlyZone: false,
    restrictedZone: false,
    nearNoFlyZone: false,
    nearRestrictedZone: false,
    noFlyHeightLimit: 0,
    noFlyDistance: 0,
    limitHeight: 0,
    limitDistance: 0,
    returnHeight: 0,
    beginnerMode: false,
    americaRockerMode: true,
    surroundRadius: 0,
    surroundClockwise: true,
    surroundSpeed: 0,
    settingSpeedMode: -1,
    settingsValid: false,
    gimbalPitchControl: 0,
    gimbalPitchSpeed: 0,
    gimbalStableMode: true,
    gimbalFpvSmooth: 0,
    gimbalCalibration: 0,
    gimbalTuningRoll: 0,
    gimbalTuningYaw: 0,
    gimbalReset: 0,
    gimbalSettingsValid: false,
    gimbalRoll: 0,
    gimbalPitch: 0,
    gimbalYaw: 0,
    gimbalRollSpeed: 0,
    gimbalPitchSpeedActual: 0,
    gimbalYawSpeed: 0,
    gimbalErrorStatus: 0,
    gimbalPitchChanging: false,
    gimbalControlPitch: 0,
    gimbalStateValid: false,
    rcThrottle: 0,
    rcYaw: 0,
    rcPitch: 0,
    rcRoll: 0
  })

  // Continuous gimbal target control. The actual pitch remains telemetry-owned;
  // this state only contains the requested target and the Send4Axis actuator value.
  const gimbalControl = reactive({
    targetAngle: 0,
    active: false,
    command: 0,
    mode: 'preset' as 'preset' | 'continuous',
    telemetryUpdatedAt: 0
  })

  // User Virtual Joysticks
  const userJoysticks = reactive<JoystickState>({
    throttle: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    gimbal: 0
  })

  // Hardware RC Controller Echo
  const rcHardwareJoysticks = reactive<JoystickState>({
    throttle: 0,
    yaw: 0,
    pitch: 0,
    roll: 0
  })

  // Network & Packet Stats
  const streamStats = reactive({
    packetsRx: 0,
    packetsTx: 0,
    bytesRx: 0,
    bytesTx: 0
  })

  // Lists
  const packets = ref<ParsedPacket[]>([])
  const logs = ref<SystemLog[]>([])
  const activeTab = ref<'cockpit' | 'mission' | 'map' | 'gallery' | 'usb' | 'debug'>('cockpit')
  const ignoreTelemetryAtIngestion = ref(false)

  // Incoming packets are batched before touching Vue's reactive array. This keeps
  // the USB monitor responsive under high RX rates while preserving the latest
  // 1000 packets for export.
  const PACKET_BUFFER_LIMIT = 1000
  const PACKET_UI_FLUSH_MS = 100
  let pendingPackets: ParsedPacket[] = []
  let packetFlushTimer: ReturnType<typeof setTimeout> | null = null

  function flushPendingPackets() {
    if (packetFlushTimer) {
      clearTimeout(packetFlushTimer)
      packetFlushTimer = null
    }
    if (pendingPackets.length === 0) return

    const batch = pendingPackets
    pendingPackets = []
    // addPacket() receives packets oldest -> newest. The UI is newest-first.
    packets.value.unshift(...batch.reverse())
    if (packets.value.length > PACKET_BUFFER_LIMIT) {
      packets.value.splice(PACKET_BUFFER_LIMIT)
    }
  }

  function schedulePacketFlush() {
    if (packetFlushTimer) return
    packetFlushTimer = setTimeout(flushPendingPackets, PACKET_UI_FLUSH_MS)
  }

  function getPacketSnapshot(): ParsedPacket[] {
    // Do not force a reactive UI update while saving. Merge the not-yet-rendered
    // batch with the rendered ring buffer into a stable newest-first snapshot.
    return [...pendingPackets].reverse().concat(packets.value).slice(0, PACKET_BUFFER_LIMIT)
  }

  // Actions
  function addLog(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
    logs.value.push({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    })
    if (logs.value.length > 500) {
      logs.value.shift()
    }
  }

  function addPacket(packet: ParsedPacket) {
    if (packet.dir === 'RX') {
      streamStats.packetsRx++
      streamStats.bytesRx += packet.len
      connection.usbConnected = true
      connection.lastRxTimestamp = Date.now()
    } else {
      streamStats.packetsTx++
      streamStats.bytesTx += packet.len
    }

    if (packet.telemetry) {
      Object.assign(telemetry, packet.telemetry)
      if (packet.telemetry.gimbalStateValid !== undefined ||
          packet.telemetry.gimbalPitch !== undefined ||
          packet.telemetry.gimbalControlPitch !== undefined) {
        gimbalControl.telemetryUpdatedAt = Date.now()
      }
      if (packet.telemetry.rcThrottle !== undefined) {
        rcHardwareJoysticks.throttle = packet.telemetry.rcThrottle
        rcHardwareJoysticks.yaw = packet.telemetry.rcYaw || 0
        rcHardwareJoysticks.pitch = packet.telemetry.rcPitch || 0
        rcHardwareJoysticks.roll = packet.telemetry.rcRoll || 0
      }
    }

    // If ingestion drop is enabled, skip repetitive background telemetry to protect buffer
    if (ignoreTelemetryAtIngestion.value && (packet.category === 'telemetry' || packet.category === 'rc_sticks' || packet.category === 'video')) {
      return
    }

    pendingPackets.push(packet)
    // Bound even the short-lived pending queue if the browser is heavily loaded.
    if (pendingPackets.length > PACKET_BUFFER_LIMIT) {
      pendingPackets = pendingPackets.slice(-PACKET_BUFFER_LIMIT)
    }
    schedulePacketFlush()
  }

  function clearPackets() {
    if (packetFlushTimer) {
      clearTimeout(packetFlushTimer)
      packetFlushTimer = null
    }
    pendingPackets = []
    packets.value = []
  }

  function clearLogs() {
    logs.value = []
  }


  function applyBackendState(state: any) {
    if (!state || typeof state !== 'object') return
    if (state.telemetry && typeof state.telemetry === 'object') {
      Object.assign(telemetry, state.telemetry)
      if (state.telemetry.gimbalStateValid !== undefined ||
          state.telemetry.gimbalPitch !== undefined ||
          state.telemetry.gimbalControlPitch !== undefined) {
        gimbalControl.telemetryUpdatedAt = Date.now()
      }
    }
    const measured = state.control?.measured
    if (measured && typeof measured === 'object') {
      rcHardwareJoysticks.throttle = Number(measured.throttle || 0)
      rcHardwareJoysticks.yaw = Number(measured.yaw || 0)
      rcHardwareJoysticks.pitch = Number(measured.pitch || 0)
      rcHardwareJoysticks.roll = Number(measured.roll || 0)
      rcHardwareJoysticks.gimbal = Number(measured.gimbal || 0)
    }
    if (state.video && typeof state.video === 'object') {
      connection.videoStreaming = Boolean(state.video.streaming)
    }
    if (state.connection && typeof state.connection === 'object') {
      connection.usbTransportOpen = Boolean(state.connection.transportOpen)
      connection.usbConnected = Boolean(state.connection.linkReady)
      if (state.connection.lastRxMs) connection.lastRxTimestamp = Number(state.connection.lastRxMs)
    }
  }

  function setTargetHost(host: string) {
    connection.targetHost = host
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('potensic_target_host', host)
    }
  }

  return {
    connection,
    normalizedHost,
    telemetry,
    gimbalControl,
    userJoysticks,
    rcHardwareJoysticks,
    streamStats,
    packets,
    logs,
    activeTab,
    ignoreTelemetryAtIngestion,
    addLog,
    addPacket,
    getPacketSnapshot,
    flushPendingPackets,
    clearPackets,
    clearLogs,
    applyBackendState,
    setTargetHost
  }
})
