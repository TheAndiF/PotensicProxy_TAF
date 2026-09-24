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
  private demuxer = new UsbStreamDemuxer()

  static getInstance(): UsbTransportService {
    if (!this.instance) {
      this.instance = new UsbTransportService()
    }
    return this.instance
  }

  start() {
    this.connect()
    this.startStatusPolling()
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

    store.addLog('INFO', `正在连接 USB 透传通道 -> ${url}`)

    try {
      this.ws = new WebSocket(url)
      this.ws.binaryType = 'arraybuffer'

      this.ws.onopen = () => {
        store.connection.wsConnected = true
        store.addLog('INFO', 'USB 透传通道已就绪 (WebSocket OPEN)')

        // Periodic heartbeat to keep flight controller link alive (1000ms)
        this.heartbeatTimer = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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
        store.addLog('WARN', 'USB 透传通道断开，2秒后重连...')
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
            if (j.hex) bytes = ByteUtils.hexToBytes(j.hex)
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
      store.addLog('ERROR', `WebSocket 创建异常: ${e.message}`)
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
        store.addLog('ERROR', `HTTP 发送失败: ${e.message}`)
      })
    }

    // Record TX packet in store
    const parsed = PacketParser.parse(bytes, 'TX')
    store.addPacket(parsed)
  }

  private startStatusPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = setInterval(() => {
      const store = useDroneStore()
      const host = store.normalizedHost
      const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:'

      // If we received an RX packet recently (within 4 seconds), USB is active — no need to poll HTTP!
      const timeSinceLastRx = Date.now() - (store.connection.lastRxTimestamp || 0)
      if (store.connection.lastRxTimestamp && timeSinceLastRx < 4000) {
        store.connection.usbConnected = true
        return // Skip HTTP request entirely to avoid spawning unnecessary tunnel connections
      }

      // Only query /api/status if no recent USB packets arrived
      fetch(`${httpProto}//${host}/api/status`, { signal: AbortSignal.timeout(2500) })
        .then(r => r.json())
        .then(d => {
          if (d.connected) {
            store.connection.usbConnected = true
          } else if (timeSinceLastRx >= 4000) {
            store.connection.usbConnected = false
          }
        })
        .catch(() => {
          if (timeSinceLastRx >= 4000) {
            store.connection.usbConnected = false
          }
        })
    }, 5000)
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
