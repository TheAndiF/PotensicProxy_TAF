/**
 * USB Transport Service
 * Manages WebSocket connection to the phone and bidirectional packet flow.
 */
import { useDroneStore } from '../stores/useDroneStore'
import { PacketParser } from '../protocol/PacketParser'
import { PacketBuilder } from '../protocol/PacketBuilder'
import { ByteUtils } from '../utils/ByteUtils'
import { VideoExtractor } from '../protocol/VideoExtractor'

class UsbStreamDemuxer {
  private buffer: Uint8Array = new Uint8Array(0)

  feed(
    chunk: Uint8Array,
    onFePacket: (feType: number, payload: Uint8Array, fullPacket: Uint8Array) => void
  ) {
    if (this.buffer.length === 0) {
      this.buffer = chunk
    } else {
      const merged = new Uint8Array(this.buffer.length + chunk.length)
      merged.set(this.buffer, 0)
      merged.set(chunk, this.buffer.length)
      this.buffer = merged
    }

    let i = 0
    const limit = this.buffer.length - 16
    let lastConsumed = 0

    while (i <= limit) {
      // FE Header check: 0xFE, 0x00, 0x00, 0x00, 0x00, 0x00
      if (
        this.buffer[i] === 0xfe &&
        this.buffer[i + 1] === 0x00 &&
        this.buffer[i + 2] === 0x00 &&
        this.buffer[i + 3] === 0x00 &&
        this.buffer[i + 4] === 0x00 &&
        this.buffer[i + 5] === 0x00
      ) {
        const feType = this.buffer[i + 7]
        const len =
          ((this.buffer[i + 12] & 0xff) << 24) |
          ((this.buffer[i + 13] & 0xff) << 16) |
          ((this.buffer[i + 14] & 0xff) << 8) |
          (this.buffer[i + 15] & 0xff)

        if (len < 0 || len > 1_000_000) {
          i++
          continue
        }

        const totalLen = 16 + len
        if (i + totalLen > this.buffer.length) {
          // Packet is cut off in this read chunk, wait for next chunk
          // Discard leading bytes before this valid incomplete packet
          lastConsumed = i
          break
        }

        const payload = this.buffer.subarray(i + 16, i + totalLen)
        const fullPacket = this.buffer.subarray(i, i + totalLen)

        onFePacket(feType, payload, fullPacket)

        i += totalLen
        lastConsumed = i
      } else {
        i++
      }
    }

    if (lastConsumed > 0) {
      this.buffer = this.buffer.subarray(lastConsumed)
    } else if (this.buffer.length > 500_000) {
      this.buffer = this.buffer.subarray(this.buffer.length - 16)
    }
  }

  reset() {
    this.buffer = new Uint8Array(0)
  }
}

export class UsbTransportService {
  private static instance: UsbTransportService | null = null
  private ws: WebSocket | null = null
  private reconnectTimer: any = null
  private pollTimer: any = null
  private heartbeatTimer: any = null
  private connectRequestInFlight = false
  private demuxer = new UsbStreamDemuxer()

  static getInstance(): UsbTransportService {
    if (!this.instance) {
      this.instance = new UsbTransportService()
    }
    return this.instance
  }

  start() {
    this.loadDroneProfile()
    this.connect()
    this.startStatusPolling()
  }

  private loadDroneProfile() {
    const store = useDroneStore()
    const host = store.normalizedHost
    const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'
    fetch(`${httpProto}//${host}/api/drone/profile`, { signal: AbortSignal.timeout(2500) })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(p => {
        VideoExtractor.getInstance().setDroneModel(p.id === 'ATOM_2' ? 'ATOM_2' : 'ATOM')
        window.dispatchEvent(new CustomEvent('drone-profile-changed', { detail: p }))
        store.addLog('INFO', `Drone protocol profile: ${p.id} (${p.videoTransport})`)
      })
      .catch(() => {})
  }

  connect() {
    const store = useDroneStore()

    if (this.ws) {
      try { this.ws.close() } catch (_) {}
      this.ws = null
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    const host = store.normalizedHost
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${host}/ws/usb`

    store.addLog('INFO', `Connecting browser passthrough channel -> ${url}`)

    try {
      this.ws = new WebSocket(url)
      this.ws.binaryType = 'arraybuffer'

      this.ws.onopen = () => {
        store.connection.wsConnected = true
        store.addLog('INFO', 'Browser passthrough channel ready (WebSocket OPEN)')

        // Heartbeat is meaningful only after Android has an actual controller/drone transport.
        this.heartbeatTimer = setInterval(() => {
          if (store.connection.usbConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(PacketBuilder.buildHeartbeat())
          }
        }, 1000)
      }

      this.ws.onclose = () => {
        store.connection.wsConnected = false
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer)
          this.heartbeatTimer = null
        }
        store.addLog('WARN', 'Browser passthrough channel closed; reconnecting in 2 seconds...')
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        store.connection.wsConnected = false
      }

      this.ws.onmessage = (e: MessageEvent) => {
        let bytes: Uint8Array | null = null

        if (e.data instanceof ArrayBuffer) {
          bytes = new Uint8Array(e.data)
        } else if (typeof e.data === 'string') {
          try {
            const j = JSON.parse(e.data)
            if (j.hex) {
              bytes = ByteUtils.hexToBytes(j.hex)
              if (String(j.direction || '').toUpperCase() === 'TX') {
                // Backend-generated TX echo. Parse directly instead of feeding the
                // RX stream demuxer so LiveView/heartbeat/init packets appear in logs.
                store.addPacket(PacketParser.parse(bytes, 'TX'))
                return
              }
            }
          } catch (_) {
            bytes = ByteUtils.hexToBytes(e.data)
          }
        }

        if (bytes && bytes.length > 0) {
          store.streamStats.packetsRx++
          store.streamStats.bytesRx += bytes.length
          store.connection.usbConnected = true
          store.connection.lastRxTimestamp = Date.now()

          // Feed incoming USB byte stream continuously to demuxer (matching official AoaParser md.java)
          this.demuxer.feed(bytes, (feType, payload, fullPacket) => {
            if (feType === 0x06) {
              // Pass video payload directly into video extractor
              VideoExtractor.getInstance().feed(payload)
            } else {
              const parsed = PacketParser.parse(fullPacket, 'RX')
              store.addPacket(parsed)
            }
          })
        }
      }
    } catch (e: any) {
      store.addLog('ERROR', `WebSocket connection error: ${e.message}`)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, 2000)
  }

  send(bytes: Uint8Array) {
    const store = useDroneStore()

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(bytes)
    } else {
      // Fallback to HTTP POST
      const host = store.normalizedHost
      const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'
      fetch(`${httpProto}//${host}/api/usb/send`, {
        method: 'POST',
        body: ByteUtils.bytesToHex(bytes)
      }).catch((e) => {
        store.addLog('ERROR', `HTTP send failed: ${e.message}`)
      })
    }
  }

  private startStatusPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer)

    const poll = () => {
      const store = useDroneStore()
      const host = store.normalizedHost
      const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'

      fetch(`${httpProto}//${host}/api/status`, { signal: AbortSignal.timeout(2500) })
        .then(r => r.json())
        .then(d => {
          const wasConnected = store.connection.usbConnected
          const wasOpen = store.connection.usbTransportOpen
          store.connection.usbTransportOpen = Boolean(d.usbOpen ?? d.usbConnected ?? d.connected)
          store.connection.usbConnected = Boolean(d.usbConnected ?? d.connected ?? ((d.packetsReceived ?? 0) > 0))
          store.connection.videoStreaming = Boolean(d.videoStreaming)

          if (store.connection.usbConnected && !wasConnected) {
            store.addLog('INFO', 'Controller/drone link confirmed by RX data')
          } else if (!store.connection.usbConnected && wasConnected) {
            store.addLog('WARN', 'Controller/drone RX link lost')
          } else if (store.connection.usbTransportOpen && !wasOpen && !store.connection.usbConnected) {
            store.addLog('INFO', 'USB accessory opened; waiting for controller response...')
          }

          // Ask Android to open the accessory only when it is actually closed. If it is
          // already open but silent, the backend connection supervisor performs handshake
          // probes and controlled reopen attempts without browser-side reconnect spam.
          if (!store.connection.usbTransportOpen && !d.permissionPending && !this.connectRequestInFlight) {
            this.connectRequestInFlight = true
            fetch(`${httpProto}//${host}/api/connect`, { method: 'POST', signal: AbortSignal.timeout(3000) })
              .then(r => r.json().catch(() => ({})))
              .then(result => {
                store.connection.usbTransportOpen = Boolean(result.usbOpen ?? result.connected)
                if (result.connected) store.connection.usbConnected = true
              })
              .catch(() => {})
              .finally(() => { this.connectRequestInFlight = false })
          }
        })
        .catch(() => {
          store.connection.usbConnected = false
          store.connection.usbTransportOpen = false
        })
    }

    poll()
    this.pollTimer = setInterval(poll, 2000)
  }

  stop() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

