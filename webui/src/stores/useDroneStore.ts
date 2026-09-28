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
    homeLatitude: 0,
    homeLongitude: 0,
    homeSynced: false,
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
    getPacketSnapshot,
    flushPendingPackets,
    clearPackets,
    clearLogs,
    setTargetHost
  }
})
