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
    wsConnected: false,
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
    battery: 0,
    altitude: 0,
    horizontalDistance: 0,
    horizontalSpeed: 0,
    verticalSpeed: 0,
    satellites: 0,
    latitude: 0,
    longitude: 0,
    flightVoltage: 0,
    remoterVoltage: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    windSpeed: 0,
    rcThrottle: 0,
    rcYaw: 0,
    rcPitch: 0,
    rcRoll: 0
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
  const activeTab = ref<'cockpit' | 'usb' | 'debug' | 'logs'>('cockpit')
  const ignoreTelemetryAtIngestion = ref(false)

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

    packets.value.unshift(packet)
    if (packets.value.length > 1000) {
      packets.value.pop()
    }
  }

  function clearPackets() {
    packets.value = []
  }

  function clearLogs() {
    logs.value = []
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
    userJoysticks,
    rcHardwareJoysticks,
    streamStats,
    packets,
    logs,
    activeTab,
    ignoreTelemetryAtIngestion,
    addLog,
    addPacket,
    clearPackets,
    clearLogs,
    setTargetHost
  }
})
